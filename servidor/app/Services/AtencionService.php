<?php

namespace App\Services;

use App\Enums\EstadoMesa;
use App\Exceptions\ReglaNegocioException;
use App\Models\AtencionMesa;
use App\Models\MedioPago;
use App\Models\Mesa;
use App\Models\Pago;
use App\Models\Reserva;
use App\Models\Usuario;
use Illuminate\Support\Facades\DB;

/**
 * Circuito de atención de una mesa: apertura, solicitud de cuenta, cobro y cierre.
 */
class AtencionService
{
    /**
     * Abre una atención (la mesa pasa a Ocupada).
     * RN-01: no se puede abrir si la mesa ya tiene una atención activa.
     * RN-02: el tiempo de ocupación se cuenta desde este momento.
     */
    public function abrir(Mesa $mesa, int $comensales, ?Usuario $mozo = null, ?Reserva $reserva = null): AtencionMesa
    {
        return DB::transaction(function () use ($mesa, $comensales, $mozo, $reserva) {
            $mesa = Mesa::lockForUpdate()->findOrFail($mesa->id);

            if ($mesa->estado->tieneAtencionActiva()) {
                throw new ReglaNegocioException("{$mesa->nombre} ya tiene una atención activa.", 'RN-01');
            }
            if ($comensales < 1 || $comensales > $mesa->capacidad) {
                throw new ReglaNegocioException("{$mesa->nombre} admite entre 1 y {$mesa->capacidad} personas.");
            }

            // Si la mesa estaba reservada, se vincula la reserva vigente que la ocupa.
            if (! $reserva && $mesa->estado === EstadoMesa::Reservada) {
                $reserva = Reserva::where('id_mesa', $mesa->id)
                    ->whereIn('estado', [Reserva::PENDIENTE, Reserva::CONFIRMADA])
                    ->orderBy('fecha_hora')->first();
            }

            $mesa->pasarA(EstadoMesa::Ocupada);

            $atencion = AtencionMesa::create([
                'id_mesa' => $mesa->id,
                'id_usuario' => $mozo?->id,
                'id_reserva' => $reserva?->id,
                'comensales' => $comensales,
                'inicio' => now(),
                'estado' => AtencionMesa::ACTIVA,
            ]);

            if ($reserva) {
                $reserva->update(['estado' => Reserva::CUMPLIDA, 'id_mesa' => $mesa->id]);
            }

            return $atencion;
        });
    }

    /** Ocupada → Solicita cuenta. */
    public function solicitarCuenta(AtencionMesa $atencion): AtencionMesa
    {
        $this->exigirActiva($atencion);
        $atencion->mesa->pasarA(EstadoMesa::SolicitaCuenta);

        return $atencion->refresh();
    }

    /** Solicita cuenta → Pendiente de pago. */
    public function iniciarCobro(AtencionMesa $atencion): AtencionMesa
    {
        $this->exigirActiva($atencion);
        $atencion->mesa->pasarA(EstadoMesa::PendientePago);

        return $atencion->refresh();
    }

    /**
     * Registra el pago, cierra la atención y libera la mesa (RN-08).
     * Pago básico, sin integración con pasarela (RF-22 queda fuera de la versión).
     */
    public function confirmarPago(AtencionMesa $atencion, MedioPago $medio, float $monto): Pago
    {
        return DB::transaction(function () use ($atencion, $medio, $monto) {
            $this->exigirActiva($atencion);
            $total = $atencion->total();

            if ($total <= 0) {
                throw new ReglaNegocioException('La atención no tiene consumos para cobrar.');
            }
            if (round($monto, 2) < $total) {
                throw new ReglaNegocioException('El monto ingresado es menor al total de la cuenta ($ '.number_format($total, 2, ',', '.').').');
            }

            $atencion->mesa->pasarA(EstadoMesa::Disponible); // exige estar en Pendiente de pago

            $pago = Pago::create([
                'id_atencion' => $atencion->id,
                'id_medio_pago' => $medio->id,
                'monto' => $total,
                'estado' => 'confirmado',
            ]);

            $atencion->update(['estado' => AtencionMesa::CERRADA, 'fin' => now()]);

            return $pago;
        });
    }

    private function exigirActiva(AtencionMesa $atencion): void
    {
        if (! $atencion->estaActiva()) {
            throw new ReglaNegocioException('La atención ya fue cerrada.');
        }
    }
}
