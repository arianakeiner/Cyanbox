<?php

namespace Tests\Feature;

use App\Models\Mesa;
use App\Models\Producto;
use App\Models\Reserva;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * PI-01 · Recorrido completo de una atención, tal como recomendó el docente en la Etapa 2:
 * reserva → ocupación de mesa → toma de pedido → seguimiento de comanda → cierre de la atención.
 * Interactúan la API (interfaz), los servicios (lógica de negocio) y la base de datos (persistencia).
 */
class CircuitoAtencionTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    protected string $seeder = DemoSeeder::class;

    public function test_recorrido_completo_desde_la_reserva_hasta_liberar_la_mesa(): void
    {
        $recepcion = $this->comoUsuario('recepcion@cyanbox.local');
        $mozo = $this->comoUsuario('mozo@cyanbox.local');
        $cocina = $this->comoUsuario('cocina@cyanbox.local');
        $caja = $this->comoUsuario('caja@cyanbox.local');
        $mesa = Mesa::where('nombre', 'Mesa 7')->first();

        // 1. Recepción registra la reserva y aparta la mesa.
        $reservaId = $this->postJson('/api/reservas', [
            'nombre' => 'Grupo Prueba', 'telefono' => '343 555-0000', 'cantidad' => 3,
            'fecha_hora' => now()->addHour()->format('Y-m-d H:i'), 'id_mesa' => $mesa->id,
        ], $recepcion)->assertCreated()->json('id');
        $this->postJson("/api/reservas/{$reservaId}/reservar-mesa", [], $recepcion)->assertOk();
        $this->assertSame('reservada', $mesa->refresh()->estado->value);

        // 2. Llega el cliente: la mesa pasa a ocupada y se abre la atención.
        $atencionId = $this->postJson("/api/reservas/{$reservaId}/llegada", [], $mozo)
            ->assertCreated()->assertJsonPath('mesa.estado', 'ocupada')->json('id');
        $this->assertSame(Reserva::CUMPLIDA, Reserva::find($reservaId)->estado);

        // 3. El mozo toma el pedido y la comanda llega a cocina.
        $milanesa = Producto::where('nombre', 'Milanesa napolitana')->first();
        $limonada = Producto::where('nombre', 'Limonada')->first();
        $comandaId = $this->postJson('/api/comandas', [
            'id_atencion' => $atencionId,
            'items' => [['id_producto' => $milanesa->id, 'cantidad' => 2], ['id_producto' => $limonada->id, 'cantidad' => 3]],
            'observaciones' => 'Una sin sal',
        ], $mozo)->assertCreated()->assertJsonPath('estado', 'pendiente_cocina')->json('id');

        $this->getJson('/api/comandas', $cocina)->assertOk()->assertJsonFragment(['id' => $comandaId, 'mesa' => 'Mesa 7']);

        // 4. Cocina avanza la preparación y el mozo entrega.
        $this->postJson("/api/comandas/{$comandaId}/avanzar", [], $cocina)->assertJsonPath('estado', 'en_preparacion');
        $this->postJson("/api/comandas/{$comandaId}/avanzar", [], $cocina)->assertJsonPath('estado', 'lista');
        $this->postJson("/api/comandas/{$comandaId}/avanzar", [], $mozo)->assertJsonPath('estado', 'entregada');

        // 5. Pedido adicional en la misma atención (RN-05).
        $this->postJson('/api/comandas', [
            'id_atencion' => $atencionId, 'items' => [['id_producto' => $limonada->id, 'cantidad' => 1]],
        ], $mozo)->assertCreated();

        $total = 2 * 12600 + 4 * 3600;
        $this->getJson("/api/atenciones/{$atencionId}", $mozo)->assertJsonPath('total', $total)->assertJsonCount(2, 'comandas');

        // 6. Cuenta, cobro y cierre: la mesa vuelve a estar disponible (RN-08).
        $this->postJson("/api/atenciones/{$atencionId}/solicitar-cuenta", [], $mozo)->assertJsonPath('mesa.estado', 'solicita_cuenta');
        $this->postJson("/api/atenciones/{$atencionId}/iniciar-cobro", [], $caja)->assertJsonPath('mesa.estado', 'pendiente_pago');
        $this->postJson("/api/atenciones/{$atencionId}/pago", ['id_medio_pago' => 2, 'monto' => $total], $caja)
            ->assertOk()->assertJsonPath('estado', 'cerrada')->assertJsonPath('mesa.estado', 'disponible');

        $this->assertDatabaseHas('pagos', ['id_atencion' => $atencionId, 'monto' => $total]);
        $this->assertDatabaseHas('atenciones_mesa', ['id' => $atencionId, 'estado' => 'cerrada']);
        $this->assertSame('disponible', $mesa->refresh()->estado->value);
    }

    public function test_reglas_de_negocio_bloquean_operaciones_invalidas(): void
    {
        $mozo = $this->comoUsuario('mozo@cyanbox.local');
        $ocupada = Mesa::where('nombre', 'Mesa 3')->first();
        $agotado = Producto::where('disponible', false)->first();

        // RN-01: no se abre una segunda atención en una mesa ocupada.
        $this->postJson('/api/atenciones', ['id_mesa' => $ocupada->id, 'comensales' => 2], $mozo)
            ->assertStatus(422)->assertJsonPath('regla', 'RN-01');

        // RN-03: un producto agotado no se puede pedir.
        $atencion = $ocupada->atencionActiva;
        $this->postJson('/api/comandas', ['id_atencion' => $atencion->id, 'items' => [['id_producto' => $agotado->id, 'cantidad' => 1]]], $mozo)
            ->assertStatus(422)->assertJsonPath('regla', 'RN-03');

        // No se cobra una mesa que no pidió la cuenta.
        $caja = $this->comoUsuario('caja@cyanbox.local');
        $this->postJson("/api/atenciones/{$atencion->id}/pago", ['id_medio_pago' => 1, 'monto' => 999999], $caja)->assertStatus(422);
        $this->assertSame('ocupada', $ocupada->refresh()->estado->value);
    }
}
