<?php

namespace Tests\Feature;

use App\Models\Categoria;
use App\Models\Mesa;
use App\Models\Producto;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * PI-02 · Operaciones CRUD desde la API hasta la base de datos, con sus validaciones:
 * duplicados, campos obligatorios, superposición de reservas y eliminaciones protegidas.
 */
class CrudTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    protected string $seeder = DemoSeeder::class;

    public function test_crud_de_productos_con_validaciones(): void
    {
        $admin = $this->comoUsuario('admin@cyanbox.local');
        $postres = Categoria::where('nombre', 'Postre')->first();

        // Create
        $id = $this->postJson('/api/productos', ['nombre' => 'Panqueques', 'id_categoria' => $postres->id, 'precio' => 4500], $admin)
            ->assertCreated()->json('id');
        $this->assertDatabaseHas('productos', ['id' => $id, 'nombre' => 'Panqueques', 'disponible' => true]);

        // Read
        $this->getJson("/api/productos/{$id}", $admin)->assertOk()->assertJsonPath('categoria', 'Postre');

        // Update
        $this->putJson("/api/productos/{$id}", ['nombre' => 'Panqueques con dulce', 'id_categoria' => $postres->id, 'precio' => 4800], $admin)
            ->assertOk()->assertJsonPath('precio', 4800);

        // Validaciones: duplicado y campos obligatorios
        $this->postJson('/api/productos', ['nombre' => 'Empanadas', 'id_categoria' => $postres->id, 'precio' => 100], $admin)
            ->assertStatus(422)->assertJsonValidationErrors('nombre');
        $this->postJson('/api/productos', ['nombre' => '', 'precio' => 0], $admin)
            ->assertStatus(422)->assertJsonValidationErrors(['nombre', 'id_categoria', 'precio']);

        // Delete
        $this->deleteJson("/api/productos/{$id}", [], $admin)->assertOk();
        $this->assertDatabaseMissing('productos', ['id' => $id]);

        // Un producto usado en comandas no se borra (se conserva el historial)
        $usado = Producto::where('nombre', 'Milanesa napolitana')->first();
        $this->deleteJson("/api/productos/{$usado->id}", [], $admin)->assertStatus(409);
    }

    public function test_crud_de_reservas_y_control_de_superposicion(): void
    {
        $recepcion = $this->comoUsuario('recepcion@cyanbox.local');
        $mesa = Mesa::where('nombre', 'Mesa 5')->first();
        $hora = now()->addDays(2)->setTime(21, 0)->format('Y-m-d H:i');

        $id = $this->postJson('/api/reservas', ['nombre' => 'Ana Pérez', 'cantidad' => 4, 'fecha_hora' => $hora, 'id_mesa' => $mesa->id], $recepcion)
            ->assertCreated()->json('id');

        // Misma mesa a una hora superpuesta: rechazada
        $this->postJson('/api/reservas', ['nombre' => 'Otro Cliente', 'cantidad' => 2, 'fecha_hora' => now()->addDays(2)->setTime(22, 0)->format('Y-m-d H:i'), 'id_mesa' => $mesa->id], $recepcion)
            ->assertStatus(422);
        // Más personas que la capacidad: rechazada
        $this->postJson('/api/reservas', ['nombre' => 'Grupo Grande', 'cantidad' => 8, 'fecha_hora' => $hora, 'id_mesa' => $mesa->id], $recepcion)
            ->assertStatus(422);
        // Reserva duplicada (mismo cliente, misma fecha y hora)
        $this->postJson('/api/reservas', ['nombre' => 'ana pérez', 'cantidad' => 2, 'fecha_hora' => $hora], $recepcion)
            ->assertStatus(422);

        $this->putJson("/api/reservas/{$id}", ['nombre' => 'Ana Pérez', 'cantidad' => 3, 'fecha_hora' => $hora, 'id_mesa' => $mesa->id, 'estado' => 'confirmada'], $recepcion)
            ->assertOk()->assertJsonPath('cantidad', 3)->assertJsonPath('estado', 'confirmada');

        $this->deleteJson("/api/reservas/{$id}", [], $recepcion)->assertOk();
        $this->assertDatabaseMissing('reservas', ['id' => $id]);
    }

    public function test_crud_de_mesas_y_categorias_con_campos_opcionales_vacios(): void
    {
        $admin = $this->comoUsuario('admin@cyanbox.local');

        $id = $this->postJson('/api/mesas', ['numero' => 12, 'nombre' => 'Terraza', 'capacidad' => 4, 'forma' => null, 'pos_x' => null, 'pos_y' => null], $admin)
            ->assertCreated()->assertJsonPath('forma', 'round')->assertJsonPath('estado', 'disponible')->json('id');
        $this->postJson('/api/mesas', ['numero' => 12, 'nombre' => 'Otra', 'capacidad' => 2], $admin)->assertStatus(422)->assertJsonValidationErrors('numero');
        $this->putJson("/api/mesas/{$id}", ['numero' => 12, 'nombre' => 'Terraza', 'capacidad' => 6, 'pos_x' => 40, 'pos_y' => 80], $admin)->assertJsonPath('capacidad', 6);
        $this->deleteJson("/api/mesas/{$id}", [], $admin)->assertOk();

        // Una mesa con historial de atenciones no se elimina.
        $usada = Mesa::where('nombre', 'Mesa 3')->first();
        $this->deleteJson("/api/mesas/{$usada->id}", [], $admin)->assertStatus(409);

        $cat = $this->postJson('/api/categorias', ['nombre' => 'Cafetería', 'orden' => null], $admin)->assertCreated()->assertJsonPath('orden', 0)->json('id');
        $this->deleteJson("/api/categorias/{$cat}", [], $admin)->assertOk();
        $conProductos = Categoria::where('nombre', 'Principal')->first();
        $this->deleteJson("/api/categorias/{$conProductos->id}", [], $admin)->assertStatus(409);
    }

    public function test_permisos_por_rol(): void
    {
        $mozo = $this->comoUsuario('mozo@cyanbox.local');
        $this->postJson('/api/mesas', ['numero' => 20, 'nombre' => 'Mesa 20', 'capacidad' => 4], $mozo)->assertForbidden();
        $this->getJson('/api/mesas')->assertUnauthorized();
    }
}
