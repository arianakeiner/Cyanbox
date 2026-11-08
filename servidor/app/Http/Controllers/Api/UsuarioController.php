<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Presentadores\Json;
use App\Models\AtencionMesa;
use App\Models\Comanda;
use App\Models\Rol;
use App\Models\Usuario;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Administración de usuarios y roles (RF-21). */
class UsuarioController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Usuario::with('rol')->orderBy('nombre')->get()->map(fn ($u) => Json::usuario($u)));
    }

    public function roles(): JsonResponse
    {
        return response()->json(Rol::orderBy('id')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $datos = $this->validar($request);
        $usuario = Usuario::create($datos + ['activo' => $datos['activo'] ?? true]);

        return response()->json(Json::usuario($usuario->load('rol')), 201);
    }

    public function update(Request $request, Usuario $usuario): JsonResponse
    {
        $datos = $this->validar($request, $usuario);
        if ($usuario->id === $request->user()->id && (($datos['activo'] ?? true) === false || (int) $datos['id_rol'] !== $usuario->id_rol)) {
            return response()->json(['message' => 'No podés desactivarte ni cambiar tu propio rol.'], 422);
        }
        if (empty($datos['password'])) {
            unset($datos['password']);
        }
        $usuario->update($datos);
        if (! $usuario->activo) {
            $usuario->forceFill(['api_token' => null, 'token_expira' => null])->save(); // cierra su sesión
        }

        return response()->json(Json::usuario($usuario->load('rol')));
    }

    public function destroy(Request $request, Usuario $usuario): JsonResponse
    {
        if ($usuario->id === $request->user()->id) {
            return response()->json(['message' => 'No podés eliminar tu propio usuario.'], 422);
        }
        if (AtencionMesa::where('id_usuario', $usuario->id)->exists() || Comanda::where('id_usuario', $usuario->id)->exists()) {
            return response()->json(['message' => "{$usuario->nombre} tiene atenciones o comandas en el historial. En lugar de eliminarlo, desactivalo."], 409);
        }
        $usuario->delete();

        return response()->json(['message' => 'Usuario eliminado.']);
    }

    private function validar(Request $request, ?Usuario $usuario = null): array
    {
        $request->merge(['email' => mb_strtolower(trim((string) $request->input('email')))]);

        return $request->validate([
            'nombre' => 'required|string|max:80',
            'email' => ['required', 'email', 'max:120', Rule::unique('usuarios', 'email')->ignore($usuario?->id)],
            'id_rol' => 'required|integer|exists:roles,id',
            'password' => [$usuario ? 'nullable' : 'required', 'string', 'min:8', 'max:72'],
            'activo' => 'boolean',
        ]);
    }
}
