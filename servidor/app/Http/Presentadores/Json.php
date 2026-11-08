<?php

namespace App\Http\Presentadores;

use App\Models\AtencionMesa;
use App\Models\Comanda;
use App\Models\Mesa;
use App\Models\Producto;
use App\Models\Reserva;
use App\Models\Usuario;

/** Formato JSON que la API devuelve para cada entidad. */
class Json
{
    public static function usuario(Usuario $u): array
    {
        return ['id' => $u->id, 'nombre' => $u->nombre, 'email' => $u->email, 'rol' => $u->rol?->nombre, 'id_rol' => $u->id_rol, 'activo' => (bool) $u->activo];
    }

    public static function producto(Producto $p): array
    {
        return [
            'id' => $p->id, 'nombre' => $p->nombre, 'descripcion' => $p->descripcion, 'precio' => $p->precio,
            'disponible' => $p->disponible, 'plato_del_dia' => $p->plato_del_dia, 'emoji' => $p->emoji,
            'id_categoria' => $p->id_categoria, 'categoria' => $p->categoria?->nombre,
        ];
    }

    public static function mesa(Mesa $m): array
    {
        $a = $m->relationLoaded('atencionActiva') ? $m->atencionActiva : null;

        return [
            'id' => $m->id, 'numero' => $m->numero, 'nombre' => $m->nombre, 'capacidad' => $m->capacidad,
            'forma' => $m->forma, 'pos_x' => $m->pos_x, 'pos_y' => $m->pos_y,
            'estado' => $m->estado->value, 'estado_etiqueta' => $m->estado->etiqueta(),
            'atencion' => $a ? [
                'id' => $a->id, 'inicio' => $a->inicio->toIso8601String(), 'minutos' => $a->minutosTranscurridos(),
                'comensales' => $a->comensales, 'mozo' => $a->mozo?->nombre, 'total' => $a->total(),
            ] : null,
        ];
    }

    public static function atencion(AtencionMesa $a): array
    {
        $a->loadMissing('mesa', 'mozo', 'comandas.detalles.producto', 'pagos.medioPago', 'reserva.cliente');

        return [
            'id' => $a->id, 'estado' => $a->estado, 'comensales' => $a->comensales,
            'inicio' => $a->inicio->toIso8601String(), 'fin' => $a->fin?->toIso8601String(),
            'minutos' => $a->minutosTranscurridos(), 'total' => $a->total(),
            'mesa' => ['id' => $a->mesa->id, 'nombre' => $a->mesa->nombre, 'estado' => $a->mesa->estado->value, 'capacidad' => $a->mesa->capacidad],
            'mozo' => $a->mozo?->nombre,
            'reserva' => $a->reserva ? ['id' => $a->reserva->id, 'cliente' => $a->reserva->cliente?->nombre] : null,
            'comandas' => $a->comandas->sortBy('id')->values()->map(fn ($c) => self::comanda($c, false))->all(),
            'pagos' => $a->pagos->map(fn ($p) => ['id' => $p->id, 'monto' => $p->monto, 'medio' => $p->medioPago?->nombre, 'fecha' => $p->created_at?->toIso8601String()])->all(),
        ];
    }

    public static function comanda(Comanda $c, bool $conMesa = true): array
    {
        $c->loadMissing('detalles.producto', 'mozo');
        $datos = [
            'id' => $c->id, 'codigo' => $c->codigo(), 'estado' => $c->estado->value, 'estado_etiqueta' => $c->estado->etiqueta(),
            'fecha_hora' => $c->fecha_hora->toIso8601String(), 'observaciones' => $c->observaciones,
            'mozo' => $c->mozo?->nombre, 'total' => $c->total(), 'id_atencion' => $c->id_atencion,
            'items' => $c->detalles->map(fn ($d) => [
                'id_producto' => $d->id_producto, 'producto' => $d->producto?->nombre, 'cantidad' => $d->cantidad,
                'precio_unitario' => $d->precio_unitario, 'subtotal' => $d->subtotal(), 'observaciones' => $d->observaciones,
            ])->all(),
        ];
        if ($conMesa) {
            $c->loadMissing('atencion.mesa');
            $datos['mesa'] = $c->atencion?->mesa?->nombre;
        }

        return $datos;
    }

    public static function reserva(Reserva $r): array
    {
        $r->loadMissing('cliente', 'mesa');

        return [
            'id' => $r->id, 'fecha_hora' => $r->fecha_hora->format('Y-m-d\TH:i'), 'cantidad' => $r->cantidad,
            'estado' => $r->estado, 'observaciones' => $r->observaciones,
            'cliente' => ['id' => $r->cliente->id, 'nombre' => $r->cliente->nombre, 'telefono' => $r->cliente->telefono],
            'mesa' => $r->mesa ? ['id' => $r->mesa->id, 'nombre' => $r->mesa->nombre, 'estado' => $r->mesa->estado->value] : null,
        ];
    }
}
