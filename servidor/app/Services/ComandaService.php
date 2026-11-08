<?php

namespace App\Services;

use App\Enums\EstadoComanda;
use App\Enums\EstadoMesa;
use App\Exceptions\ReglaNegocioException;
use App\Models\AtencionMesa;
use App\Models\Comanda;
use App\Models\Producto;
use App\Models\Usuario;
use Illuminate\Support\Facades\DB;

/**
 * Toma de pedidos y seguimiento de comandas.
 */
class ComandaService
{
    /**
     * Crea una comanda para una atención activa.
     * RN-03: un producto no disponible no puede agregarse.
     * RN-04: la comanda queda asociada a la atención de la mesa.
     * RN-05: una misma atención puede tener varias comandas (pedidos adicionales).
     *
     * @param  array<int, array{id_producto:int, cantidad:int, observaciones?:string|null}>  $items
     * @param  bool  $enviar  true: se confirma y llega a cocina; false: queda en Borrador.
     */
    public function crear(AtencionMesa $atencion, array $items, ?string $observaciones = null, ?Usuario $mozo = null, bool $enviar = true): Comanda
    {
        if (! $atencion->estaActiva()) {
            throw new ReglaNegocioException('No se puede tomar un pedido en una atención cerrada.', 'RN-04');
        }
        if ($atencion->mesa->estado !== EstadoMesa::Ocupada) {
            throw new ReglaNegocioException("{$atencion->mesa->nombre} ya solicitó la cuenta; no admite pedidos nuevos.");
        }
        if (count($items) === 0) {
            throw new ReglaNegocioException('El pedido no tiene productos.');
        }

        $productos = Producto::whereIn('id', array_column($items, 'id_producto'))->get()->keyBy('id');
        foreach ($items as $item) {
            $producto = $productos->get($item['id_producto']);
            if (! $producto) {
                throw new ReglaNegocioException('Uno de los productos del pedido no existe.');
            }
            if (! $producto->disponible) {
                throw new ReglaNegocioException("{$producto->nombre} no está disponible y no puede agregarse al pedido.", 'RN-03');
            }
            if ((int) $item['cantidad'] < 1) {
                throw new ReglaNegocioException("La cantidad de {$producto->nombre} debe ser al menos 1.");
            }
        }

        return DB::transaction(function () use ($atencion, $items, $observaciones, $mozo, $enviar, $productos) {
            $comanda = Comanda::create([
                'id_atencion' => $atencion->id,
                'id_usuario' => $mozo?->id,
                'fecha_hora' => now(),
                'estado' => EstadoComanda::Borrador,
                'observaciones' => $observaciones,
            ]);

            foreach ($items as $item) {
                $comanda->detalles()->create([
                    'id_producto' => $item['id_producto'],
                    'cantidad' => (int) $item['cantidad'],
                    'precio_unitario' => $productos[$item['id_producto']]->precio, // precio vigente al pedir
                    'observaciones' => $item['observaciones'] ?? null,
                ]);
            }

            if ($enviar) {
                $this->confirmar($comanda);
            }

            return $comanda->load('detalles.producto');
        });
    }

    /** Borrador → Enviada → Pendiente en cocina (el servicio la recibe y la pone en la cola de cocina). */
    public function confirmar(Comanda $comanda): Comanda
    {
        $comanda->pasarA(EstadoComanda::Enviada);
        $comanda->pasarA(EstadoComanda::PendienteCocina);

        return $comanda;
    }

    /** Pendiente en cocina → En preparación → Lista → Entregada. */
    public function avanzar(Comanda $comanda): Comanda
    {
        $siguiente = $comanda->estado->siguiente();
        if (! $siguiente || $comanda->estado === EstadoComanda::Borrador || $comanda->estado === EstadoComanda::Enviada) {
            throw new ReglaNegocioException("La comanda {$comanda->codigo()} no puede avanzar desde {$comanda->estado->etiqueta()}.", 'estado-comanda');
        }
        $comanda->pasarA($siguiente);

        return $comanda;
    }

    public function cancelar(Comanda $comanda): Comanda
    {
        $comanda->pasarA(EstadoComanda::Cancelada);

        return $comanda;
    }
}
