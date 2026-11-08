<?php

namespace Database\Seeders;

use App\Models\Rol;
use App\Models\Usuario;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * prueba: datos base + datos de ejemplo del prototipo.
     * produccion: sólo datos base y el administrador indicado en PROD_ADMIN_EMAIL / PROD_ADMIN_PASSWORD.
     */
    public function run(): void
    {
        $this->call(BaseSeeder::class);

        if (config('cyanbox.modo') === 'prueba') {
            if (! Usuario::exists()) {
                $this->call(DemoSeeder::class);
            }

            return;
        }

        $email = env('PROD_ADMIN_EMAIL');
        $clave = env('PROD_ADMIN_PASSWORD');
        if ($email && $clave && ! Usuario::where('email', $email)->exists()) {
            Usuario::create([
                'nombre' => 'Administrador', 'email' => mb_strtolower($email), 'password' => $clave,
                'id_rol' => Rol::where('nombre', Rol::ADMIN)->value('id'), 'activo' => true,
            ]);
        }
    }
}
