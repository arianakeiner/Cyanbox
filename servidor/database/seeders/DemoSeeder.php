<?php

namespace Database\Seeders;

use App\Enums\EstadoComanda;
use App\Enums\EstadoMesa;
use App\Models\AtencionMesa;
use App\Models\Categoria;
use App\Models\Cliente;
use App\Models\Comanda;
use App\Models\Ingrediente;
use App\Models\ListaEspera;
use App\Models\MedioPago;
use App\Models\Mesa;
use App\Models\Pago;
use App\Models\Producto;
use App\Models\Proveedor;
use App\Models\Receta;
use App\Models\Reserva;
use App\Models\Rol;
use App\Models\Usuario;
use Illuminate\Database\Seeder;

/**
 * Datos de ejemplo para el modo prueba. Replican el prototipo validado con el cliente
 * (salón de 48 cubiertos, carta, comandas, reservas y stock).
 */
class DemoSeeder extends Seeder
{
    public const CLAVE = 'cyanbox123';

    public function run(): void
    {
        $this->call(BaseSeeder::class);
        $rol = Rol::pluck('id', 'nombre');
        $usuarios = [
            ['Administrador', 'admin@cyanbox.local', Rol::ADMIN],
            ['Joel Alvarez', 'mozo@cyanbox.local', Rol::MOZO],
            ['Ariana Keiner', 'mozo2@cyanbox.local', Rol::MOZO],
            ['Cocina', 'cocina@cyanbox.local', Rol::COCINA],
            ['Caja', 'caja@cyanbox.local', Rol::CAJA],
            ['Recepción', 'recepcion@cyanbox.local', Rol::RECEPCION],
        ];
        foreach ($usuarios as [$nombre, $email, $r]) {
            Usuario::updateOrCreate(['email' => $email], ['nombre' => $nombre, 'password' => self::CLAVE, 'id_rol' => $rol[$r], 'activo' => true]);
        }
        $joel = Usuario::where('email', 'mozo@cyanbox.local')->first();
        $ariana = Usuario::where('email', 'mozo2@cyanbox.local')->first();

        // ---- Carta ----
        $cats = [];
        foreach (['Entrada fría', 'Entrada caliente', 'Principal', 'Postre', 'Bebidas'] as $i => $nombre) {
            $cats[$nombre] = Categoria::create(['nombre' => $nombre, 'orden' => $i + 1])->id;
        }
        $carta = [
            ['Bruschettas', 'Entrada fría', 5200, '🥖', 'Tomate, albahaca y aceite de oliva', true, false],
            ['Tabla de quesos', 'Entrada fría', 7900, '🧀', 'Selección de quesos y acompañamientos', true, false],
            ['Empanadas', 'Entrada caliente', 2300, '🥟', 'Carne cortada a cuchillo', true, false],
            ['Rabas', 'Entrada caliente', 9800, '🍤', 'Con limón y alioli', true, false],
            ['Bife a la criolla', 'Principal', 14200, '🥩', 'Con papas españolas y salsa criolla', false, false],
            ['Milanesa napolitana', 'Principal', 12600, '🍽️', 'Con papas fritas', true, true],
            ['Risotto de hongos', 'Principal', 11900, '🍚', 'Arroz cremoso, hongos y parmesano', true, false],
            ['Pasta casera', 'Principal', 10800, '🍝', 'Salsa a elección', true, false],
            ['Flan casero', 'Postre', 4200, '🍮', 'Con dulce de leche o crema', true, false],
            ['Brownie con helado', 'Postre', 5100, '🍫', 'Chocolate, nueces y helado', true, false],
            ['Agua mineral', 'Bebidas', 2200, '💧', 'Con o sin gas', true, false],
            ['Limonada', 'Bebidas', 3600, '🍋', 'Menta y jengibre opcional', true, false],
            ['Gaseosa', 'Bebidas', 2800, '🥤', 'Línea regular o sin azúcar', true, false],
        ];
        $prod = [];
        foreach ($carta as [$nombre, $cat, $precio, $emoji, $desc, $disp, $dia]) {
            $prod[$nombre] = Producto::create([
                'nombre' => $nombre, 'id_categoria' => $cats[$cat], 'precio' => $precio, 'emoji' => $emoji,
                'descripcion' => $desc, 'disponible' => $disp, 'plato_del_dia' => $dia,
            ]);
        }

        // ---- Salón (posiciones del prototipo) ----
        $plano = [
            [1, 'Mesa 1', 4, 'round', 6, 16], [2, 'Mesa 2', 4, 'round', 27, 14], [3, 'Mesa 3', 4, 'round', 47, 15],
            [4, 'Mesa 4', 4, 'round', 68, 15], [5, 'Mesa 5', 4, 'round', 15, 46], [6, 'Mesa 6', 4, 'round', 38, 45],
            [7, 'Mesa 7', 4, 'round', 61, 46], [8, 'Mesa 8', 2, 'rect', 84, 45], [9, 'Mesa 9', 2, 'rect', 12, 73],
            [10, 'Mesa 10', 2, 'rect', 43, 73], [11, 'Ejecutiva', 6, 'rect', 72, 73],
        ];
        $mesa = [];
        foreach ($plano as [$numero, $nombre, $cap, $forma, $x, $y]) {
            $mesa[$numero] = Mesa::create(['numero' => $numero, 'nombre' => $nombre, 'capacidad' => $cap, 'forma' => $forma, 'pos_x' => $x, 'pos_y' => $y, 'estado' => EstadoMesa::Disponible]);
        }

        // ---- Reservas ----
        $hoy = now()->startOfDay();
        $reservas = [
            [0, '20:30', 'Lucía Gómez', '11 5555-8821', 4, 2, Reserva::CONFIRMADA],
            [0, '21:15', 'Martín Díaz', '11 5555-4310', 2, 10, Reserva::CONFIRMADA],
            [0, '21:45', 'Carla Benítez', '11 5555-3109', 6, 11, Reserva::PENDIENTE],
            [1, '20:00', 'Familia Romero', '11 5555-7720', 5, null, Reserva::CONFIRMADA],
            [1, '21:30', 'Paula Ríos', '11 5555-2054', 2, 9, Reserva::CONFIRMADA],
            [2, '13:30', 'Equipo Delta (almuerzo)', '11 5555-9012', 6, 11, Reserva::PENDIENTE],
            [3, '21:00', 'Sofía Luna', '11 5555-6643', 4, null, Reserva::CONFIRMADA],
        ];
        foreach ($reservas as [$dia, $hora, $nombre, $tel, $cant, $nroMesa, $estado]) {
            [$h, $m] = explode(':', $hora);
            Reserva::create([
                'id_cliente' => Cliente::create(['nombre' => $nombre, 'telefono' => $tel])->id,
                'id_mesa' => $nroMesa ? $mesa[$nroMesa]->id : null,
                'fecha_hora' => $hoy->copy()->addDays($dia)->setTime((int) $h, (int) $m),
                'cantidad' => $cant, 'estado' => $estado,
            ]);
        }
        // Mesas 2 y 10 apartadas para las reservas de esta noche (como en el prototipo).
        $mesa[2]->update(['estado' => EstadoMesa::Reservada]);
        $mesa[10]->update(['estado' => EstadoMesa::Reservada]);

        ListaEspera::create(['nombre' => 'Familia Suárez', 'cantidad' => 5, 'estado' => ListaEspera::ESPERANDO, 'created_at' => now()->subMinutes(12)]);
        ListaEspera::create(['nombre' => 'Nicolás R.', 'cantidad' => 2, 'estado' => ListaEspera::ESPERANDO, 'created_at' => now()->subMinutes(7)]);

        // ---- Atenciones activas y comandas en curso ----
        $abrir = function (int $nro, int $minutos, int $comensales, Usuario $mozo, EstadoMesa $estado) use ($mesa) {
            $mesa[$nro]->update(['estado' => $estado]);

            return AtencionMesa::create(['id_mesa' => $mesa[$nro]->id, 'id_usuario' => $mozo->id, 'comensales' => $comensales, 'inicio' => now()->subMinutes($minutos), 'estado' => AtencionMesa::ACTIVA]);
        };
        $comanda = function (AtencionMesa $a, Usuario $mozo, int $hace, EstadoComanda $estado, array $items, ?string $obs = null) use ($prod) {
            $c = Comanda::create(['id_atencion' => $a->id, 'id_usuario' => $mozo->id, 'fecha_hora' => now()->subMinutes($hace), 'estado' => $estado, 'observaciones' => $obs]);
            foreach ($items as [$cant, $nombre]) {
                $c->detalles()->create(['id_producto' => $prod[$nombre]->id, 'cantidad' => $cant, 'precio_unitario' => $prod[$nombre]->precio]);
            }

            return $c;
        };

        $a3 = $abrir(3, 38, 3, $joel, EstadoMesa::Ocupada);
        $comanda($a3, $joel, 30, EstadoComanda::EnPreparacion, [[2, 'Empanadas'], [1, 'Milanesa napolitana']], 'Empanadas bien calientes');
        $a4 = $abrir(4, 71, 4, $ariana, EstadoMesa::SolicitaCuenta);
        $comanda($a4, $ariana, 60, EstadoComanda::Entregada, [[1, 'Tabla de quesos'], [2, 'Pasta casera'], [2, 'Limonada']]);
        $a6 = $abrir(6, 22, 2, $joel, EstadoMesa::Ocupada);
        $comanda($a6, $joel, 4, EstadoComanda::PendienteCocina, [[1, 'Risotto de hongos'], [2, 'Limonada']], '1 risotto sin cebolla');
        $a8 = $abrir(8, 54, 2, $ariana, EstadoMesa::Ocupada);
        $comanda($a8, $ariana, 20, EstadoComanda::Lista, [[1, 'Milanesa napolitana'], [1, 'Pasta casera']]);

        // ---- Historial cerrado para reportes ----
        $medios = MedioPago::pluck('id')->all();
        $historial = [
            [['Milanesa napolitana', 2], ['Gaseosa', 2]], [['Pasta casera', 1], ['Agua mineral', 1]],
            [['Empanadas', 6], ['Limonada', 3]], [['Risotto de hongos', 2], ['Flan casero', 2]],
            [['Milanesa napolitana', 1], ['Brownie con helado', 1]], [['Rabas', 1], ['Bruschettas', 1], ['Gaseosa', 2]],
            [['Milanesa napolitana', 3], ['Agua mineral', 2]], [['Tabla de quesos', 1], ['Limonada', 2]],
        ];
        foreach ($historial as $i => $items) {
            $inicio = now()->subDays($i + 1)->setTime(20, 10 * $i % 60);
            $a = AtencionMesa::create(['id_mesa' => $mesa[($i % 9) + 1]->id, 'id_usuario' => ($i % 2 ? $ariana : $joel)->id, 'comensales' => 2, 'inicio' => $inicio, 'fin' => $inicio->copy()->addMinutes(55 + $i * 4), 'estado' => AtencionMesa::CERRADA]);
            $c = Comanda::create(['id_atencion' => $a->id, 'id_usuario' => $a->id_usuario, 'fecha_hora' => $inicio->copy()->addMinutes(5), 'estado' => EstadoComanda::Entregada]);
            foreach ($items as [$nombre, $cant]) {
                $c->detalles()->create(['id_producto' => $prod[$nombre]->id, 'cantidad' => $cant, 'precio_unitario' => $prod[$nombre]->precio]);
            }
            $pago = Pago::create(['id_atencion' => $a->id, 'id_medio_pago' => $medios[$i % count($medios)], 'monto' => $c->load('detalles')->total(), 'estado' => 'confirmado']);
            $pago->forceFill(['created_at' => $a->fin, 'updated_at' => $a->fin])->save();
        }

        // ---- Stock, recetas y proveedores (modelo conceptual) ----
        $stock = [
            ['Carne vacuna', 'kg', 4, 6], ['Papas', 'kg', 14, 8], ['Tomate', 'kg', 3, 4], ['Queso mozzarella', 'kg', 5, 3],
            ['Harina', 'kg', 9, 5], ['Champiñones', 'kg', 1.2, 2], ['Gaseosa cola', 'u.', 28, 12], ['Limón', 'u.', 18, 10],
        ];
        $ing = [];
        foreach ($stock as [$nombre, $unidad, $actual, $min]) {
            $ing[$nombre] = Ingrediente::create(['nombre' => $nombre, 'unidad' => $unidad, 'stock_actual' => $actual, 'stock_minimo' => $min]);
        }
        $recetas = [
            'Milanesa napolitana' => [['Carne vacuna', 0.25], ['Tomate', 0.05], ['Queso mozzarella', 0.08], ['Papas', 0.3]],
            'Risotto de hongos' => [['Champiñones', 0.12]],
            'Limonada' => [['Limón', 2]],
        ];
        foreach ($recetas as $producto => $lista) {
            $r = Receta::create(['id_producto' => $prod[$producto]->id]);
            foreach ($lista as [$nombre, $cant]) {
                $r->ingredientes()->attach($ing[$nombre]->id, ['cantidad' => $cant]);
            }
        }
        Proveedor::create(['nombre' => 'Frigorífico Crespo', 'telefono' => '343 555-1020']);
        Proveedor::create(['nombre' => 'Verdulería Central', 'telefono' => '343 555-3344']);
    }
}
