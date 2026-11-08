<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Permisos por rol (RNF-05). Uso en rutas: ->middleware('rol:mozo,caja').
 * El administrador tiene acceso a todo.
 */
class VerificarRol
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $usuario = $request->user();
        if (! $usuario || ! $usuario->tieneRol(...$roles)) {
            $perfil = $usuario?->rol?->nombre ?? 'sin perfil';

            return response()->json(['message' => "Tu perfil ({$perfil}) no tiene permiso para realizar esta acción."], 403);
        }

        return $next($request);
    }
}
