<?php

namespace App\Services;

use App\Enums\EstadoMesa;
use App\Exceptions\ReglaNegocioException;
use App\Models\AtencionMesa;
use App\Models\Cliente;
use App\Models\Mesa;
use App\Models\Reserva;
use App\Models\Usuario;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Reservas: alta, modificación, cancelación y llegada del cliente.
 */
class ReservaService
{
    public function __construct(private AtencionService $atenciones) {}

    /**
     * Valida las reglas de una reserva (los campos obligatorios se validan en el controlador).
     * - La cantidad de personas no puede superar la capacidad de la mesa.
     * - No puede haber dos reservas vigentes superpuestas en la misma mesa.
     * - No se duplica la misma reserva (mismo cliente, mismo día y hora).
     */
    public function validar(array $datos, ?Reserva $actual = null): void
    {
        $fecha = Carbon::parse($datos['fecha_hora']);

        if (! $actual && $fecha->lt(now()->subMinutes(5))) {
            throw new ReglaNegocioException('No se puede registrar una reserva en una fecha u hora pasada.');
        }

        if (! empty($datos['id_mesa'])) {
            $mesa = Mesa::findOrFail($datos['id_mesa']);
            if ((int) $datos['cantidad'] > $mesa->capacidad) {
                throw new ReglaNegocioException("{$mesa->nombre} tiene capacidad para {$mesa->capacidad} personas.");
            }

            $duracion = (int) config('cyanbox.duracion_reserva_min', 120);
            $superpuesta = Reserva::where('id_mesa', $mesa->id)
                ->whereIn('estado', [Reserva::PENDIENTE, Reserva::CONFIRMADA])
                ->when($actual, fn ($q) => $q->where('id', '!=', $actual->id))
                ->whereBetween('fecha_hora', [$fecha->copy()->subMinutes($duracion - 1), $fecha->copy()->addMinutes($duracion - 1)])
                ->with('cliente')->first();
            if ($superpuesta) {
                throw new ReglaNegocioException(
                    "{$mesa->nombre} ya está reservada a las {$superpuesta->fecha_hora->format('H:i')} ({$superpuesta->cliente->nombre})."
                );
            }
        }

        $duplicada = Reserva::query()
            ->whereIn('estado', [Reserva::PENDIENTE, Reserva::CONFIRMADA])
            ->where('fecha_hora', $fecha)
            ->when($actual, fn ($q) => $q->where('id', '!=', $actual->id))
            ->whereHas('cliente', fn ($q) => $q->whereRaw('lower(nombre) = ?', [mb_strtolower(trim($datos['nombre']))]))
            ->exists();
        if ($duplicada) {
            throw new ReglaNegocioException("Ya existe una reserva a nombre de {$datos['nombre']} para ese día y horario.");
        }
    }

    public function crear(array $datos): Reserva
    {
        $this->validar($datos);

        return DB::transaction(function () use ($datos) {
            $cliente = Cliente::firstOrCreate(
                ['nombre' => trim($datos['nombre']), 'telefono' => $datos['telefono'] ?? null]
            );

            return Reserva::create([
                'id_cliente' => $cliente->id,
                'id_mesa' => $datos['id_mesa'] ?? null,
                'fecha_hora' => Carbon::parse($datos['fecha_hora']),
                'cantidad' => (int) $datos['cantidad'],
                'estado' => $datos['estado'] ?? Reserva::PENDIENTE,
                'observaciones' => $datos['observaciones'] ?? null,
            ])->load('cliente', 'mesa');
        });
    }

    public function actualizar(Reserva $reserva, array $datos): Reserva
    {
        if (! $reserva->estaVigente()) {
            throw new ReglaNegocioException('Sólo se pueden modificar reservas pendientes o confirmadas.');
        }
        $datos += ['nombre' => $reserva->cliente->nombre];
        $this->validar($datos, $reserva);

        return DB::transaction(function () use ($reserva, $datos) {
            $reserva->cliente->update(['nombre' => trim($datos['nombre']), 'telefono' => $datos['telefono'] ?? $reserva->cliente->telefono]);
            $nuevoEstado = $datos['estado'] ?? $reserva->estado;
            if (($datos['id_mesa'] ?? null) != $reserva->id_mesa || $nuevoEstado === Reserva::CANCELADA) {
                $this->liberarMesaReservada($reserva);
            }
            $reserva->update([
                'id_mesa' => $datos['id_mesa'] ?? null,
                'fecha_hora' => Carbon::parse($datos['fecha_hora']),
                'cantidad' => (int) $datos['cantidad'],
                'estado' => $nuevoEstado,
                'observaciones' => $datos['observaciones'] ?? $reserva->observaciones,
            ]);

            return $reserva->refresh()->load('cliente', 'mesa');
        });
    }

    /** Disponible → Reservada: la mesa se aparta para el grupo que está por llegar. */
    public function reservarMesa(Reserva $reserva): Mesa
    {
        if (! $reserva->estaVigente() || ! $reserva->mesa) {
            throw new ReglaNegocioException('La reserva debe estar vigente y tener una mesa asignada.');
        }
        $reserva->mesa->pasarA(EstadoMesa::Reservada);
        if ($reserva->estado === Reserva::PENDIENTE) {
            $reserva->update(['estado' => Reserva::CONFIRMADA]);
        }

        return $reserva->mesa;
    }

    /** Llegada del cliente: Reservada/Disponible → Ocupada y la reserva queda cumplida. */
    public function registrarLlegada(Reserva $reserva, ?Usuario $usuario = null, ?int $idMesa = null): AtencionMesa
    {
        if (! $reserva->estaVigente()) {
            throw new ReglaNegocioException('La reserva no está vigente.');
        }
        $mesa = $idMesa ? Mesa::findOrFail($idMesa) : $reserva->mesa;
        if (! $mesa) {
            throw new ReglaNegocioException('Indicá en qué mesa se ubica el grupo.');
        }
        // Si se cambia de mesa, la que estaba apartada vuelve a Disponible.
        if ($reserva->mesa && $reserva->mesa->id !== $mesa->id) {
            $this->liberarMesaReservada($reserva);
        }

        return $this->atenciones->abrir($mesa, min($reserva->cantidad, $mesa->capacidad), $usuario, $reserva);
    }

    public function cancelar(Reserva $reserva): Reserva
    {
        if (! $reserva->estaVigente()) {
            throw new ReglaNegocioException('La reserva ya no está vigente.');
        }
        $this->liberarMesaReservada($reserva);
        $reserva->update(['estado' => Reserva::CANCELADA]);

        return $reserva;
    }

    public function eliminar(Reserva $reserva): void
    {
        if ($reserva->estado === Reserva::CUMPLIDA) {
            throw new ReglaNegocioException('Una reserva cumplida forma parte del historial y no se puede eliminar.');
        }
        $this->liberarMesaReservada($reserva);
        $reserva->delete();
    }

    /** Reservada → Disponible (cancelar), sólo si la mesa estaba apartada para esta reserva. */
    private function liberarMesaReservada(Reserva $reserva): void
    {
        $mesa = $reserva->mesa()->first();
        if ($mesa && $mesa->estado === EstadoMesa::Reservada && $reserva->estaVigente()) {
            $mesa->pasarA(EstadoMesa::Disponible);
        }
    }
}
