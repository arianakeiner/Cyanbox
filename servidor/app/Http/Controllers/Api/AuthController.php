<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Presentadores\Json;
use App\Models\Usuario;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $datos = $request->validate(['email' => 'required|email', 'password' => 'required|string']);

        $usuario = Usuario::with('rol')->where('email', mb_strtolower($datos['email']))->first();
        if (! $usuario || ! Hash::check($datos['password'], $usuario->password)) {
            return response()->json(['message' => 'El correo o la contraseña no son correctos.'], 422);
        }
        if (! $usuario->activo) {
            return response()->json(['message' => 'El usuario está desactivado. Consultá con el administrador.'], 403);
        }

        $token = Str::random(60);
        $usuario->forceFill([
            'api_token' => hash('sha256', $token),
            'token_expira' => now()->addHours((int) config('cyanbox.horas_token', 12)),
        ])->save();

        return response()->json(['token' => $token, 'usuario' => Json::usuario($usuario)]);
    }

    public function yo(Request $request): JsonResponse
    {
        return response()->json(Json::usuario($request->user()));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->forceFill(['api_token' => null, 'token_expira' => null])->save();

        return response()->json(['message' => 'Sesión cerrada.']);
    }
}
