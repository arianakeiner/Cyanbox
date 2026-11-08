<?php

namespace Database\Seeders;

use App\Models\MedioPago;
use App\Models\Rol;
use Illuminate\Database\Seeder;

/** Datos mínimos que necesita el sistema en cualquier modo. Se puede ejecutar varias veces. */
class BaseSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            Rol::ADMIN => 'Gestión general, carta, mesas, stock y reportes',
            Rol::MOZO => 'Mesas, carta y pedidos',
            Rol::COCINA => 'Comandas y preparación',
            Rol::CAJA => 'Cuenta, pago y cierre de mesa',
            Rol::RECEPCION => 'Reservas y lista de espera',
        ];
        foreach ($roles as $nombre => $descripcion) {
            Rol::updateOrCreate(['nombre' => $nombre], ['descripcion' => $descripcion]);
        }

        foreach (['Efectivo', 'Débito', 'Crédito', 'Transferencia / QR'] as $medio) {
            MedioPago::firstOrCreate(['nombre' => $medio]);
        }
    }
}
