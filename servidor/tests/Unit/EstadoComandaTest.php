<?php

namespace Tests\Unit;

use App\Enums\EstadoComanda;
use PHPUnit\Framework\TestCase;

/**
 * PU-02 · Recorrido de una comanda según el diagrama de estados (Etapa 2, Figura 10).
 */
class EstadoComandaTest extends TestCase
{
    public function test_recorre_los_estados_en_orden_hasta_entregada(): void
    {
        $recorrido = [];
        $estado = EstadoComanda::Borrador;
        while ($estado) {
            $recorrido[] = $estado->value;
            $estado = $estado->siguiente();
        }

        $this->assertSame(['borrador', 'enviada', 'pendiente_cocina', 'en_preparacion', 'lista', 'entregada'], $recorrido);
    }

    public function test_no_permite_saltear_estados(): void
    {
        $this->assertFalse(EstadoComanda::Borrador->puedePasarA(EstadoComanda::Lista));
        $this->assertFalse(EstadoComanda::PendienteCocina->puedePasarA(EstadoComanda::Entregada));
        $this->assertFalse(EstadoComanda::Lista->puedePasarA(EstadoComanda::EnPreparacion));
    }

    public function test_solo_se_cancela_en_borrador(): void
    {
        $this->assertTrue(EstadoComanda::Borrador->puedePasarA(EstadoComanda::Cancelada));
        $this->assertFalse(EstadoComanda::Enviada->puedePasarA(EstadoComanda::Cancelada));
        $this->assertFalse(EstadoComanda::EnPreparacion->puedePasarA(EstadoComanda::Cancelada));
    }
}
