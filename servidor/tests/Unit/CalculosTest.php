<?php

namespace Tests\Unit;

use App\Models\DetalleComanda;
use App\Models\Ingrediente;
use PHPUnit\Framework\TestCase;

/**
 * PU-03 · Cálculos de importe y alerta de stock.
 */
class CalculosTest extends TestCase
{
    public function test_subtotal_usa_el_precio_guardado_en_el_pedido(): void
    {
        $detalle = new DetalleComanda(['cantidad' => 3, 'precio_unitario' => 2300]);

        $this->assertSame(6900.0, $detalle->subtotal());
    }

    public function test_alerta_de_stock_cuando_la_existencia_llega_al_minimo(): void
    {
        $this->assertTrue((new Ingrediente(['stock_actual' => 1.2, 'stock_minimo' => 2]))->bajoMinimo());
        $this->assertTrue((new Ingrediente(['stock_actual' => 2, 'stock_minimo' => 2]))->bajoMinimo());
        $this->assertFalse((new Ingrediente(['stock_actual' => 14, 'stock_minimo' => 8]))->bajoMinimo());
    }
}
