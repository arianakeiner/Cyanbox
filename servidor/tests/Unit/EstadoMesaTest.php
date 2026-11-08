<?php

namespace Tests\Unit;

use App\Enums\EstadoMesa;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * PU-01 · Transiciones del diagrama de estados de Mesa (Etapa 2, Figura 9).
 */
class EstadoMesaTest extends TestCase
{
    public static function transicionesValidas(): array
    {
        return [
            'sin reserva' => [EstadoMesa::Disponible, EstadoMesa::Ocupada],
            'asignar reserva' => [EstadoMesa::Disponible, EstadoMesa::Reservada],
            'cliente llega' => [EstadoMesa::Reservada, EstadoMesa::Ocupada],
            'cancelar reserva' => [EstadoMesa::Reservada, EstadoMesa::Disponible],
            'solicita cuenta' => [EstadoMesa::Ocupada, EstadoMesa::SolicitaCuenta],
            'iniciar cobro' => [EstadoMesa::SolicitaCuenta, EstadoMesa::PendientePago],
            'confirmar pago' => [EstadoMesa::PendientePago, EstadoMesa::Disponible],
        ];
    }

    public static function transicionesInvalidas(): array
    {
        return [
            'liberar mesa ocupada sin cobrar' => [EstadoMesa::Ocupada, EstadoMesa::Disponible],
            'cobrar sin pedir la cuenta' => [EstadoMesa::Ocupada, EstadoMesa::PendientePago],
            'pedir cuenta en mesa libre' => [EstadoMesa::Disponible, EstadoMesa::SolicitaCuenta],
            'reservar mesa ocupada' => [EstadoMesa::Ocupada, EstadoMesa::Reservada],
            'volver a ocupada tras pedir cuenta' => [EstadoMesa::SolicitaCuenta, EstadoMesa::Ocupada],
        ];
    }

    #[DataProvider('transicionesValidas')]
    public function test_permite_las_transiciones_del_diagrama(EstadoMesa $desde, EstadoMesa $hacia): void
    {
        $this->assertTrue($desde->puedePasarA($hacia));
    }

    #[DataProvider('transicionesInvalidas')]
    public function test_rechaza_transiciones_que_no_estan_en_el_diagrama(EstadoMesa $desde, EstadoMesa $hacia): void
    {
        $this->assertFalse($desde->puedePasarA($hacia));
    }

    public function test_rn01_solo_los_estados_de_atencion_cuentan_como_mesa_no_disponible(): void
    {
        $this->assertFalse(EstadoMesa::Disponible->tieneAtencionActiva());
        $this->assertFalse(EstadoMesa::Reservada->tieneAtencionActiva());
        $this->assertTrue(EstadoMesa::Ocupada->tieneAtencionActiva());
        $this->assertTrue(EstadoMesa::SolicitaCuenta->tieneAtencionActiva());
        $this->assertTrue(EstadoMesa::PendientePago->tieneAtencionActiva());
    }
}
