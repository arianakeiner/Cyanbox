<?php

namespace Tests;

use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /** Inicia sesión con un usuario de prueba y devuelve los encabezados con el token. */
    protected function comoUsuario(string $email): array
    {
        $token = $this->postJson('/api/login', ['email' => $email, 'password' => DemoSeeder::CLAVE])
            ->assertOk()->json('token');

        return ['Authorization' => "Bearer {$token}", 'Accept' => 'application/json'];
    }
}
