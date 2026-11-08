<?php

namespace App\Http\Middleware;

use App\Models\Usuario;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Autenticación por token (RNF-04). El cliente envía "Authorization: Bearer <token>".
 * En la base sólo se guarda el hash SHA-256 del token.
 */
class AutenticarToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();
        $usuario = $token
            ? Usuario::with('rol')->where('api_token', hash('sha256', $token))->first()
            : null;

        if (! $usuario || ! $usuario->activo || ($usuario->token_expira && $usuario->token_expira->isPast())) {
            return response()->json(['message' => 'La sesión no es válida o venció. Ingresá nuevamente.'], 401);
        }

        Auth::setUser($usuario);

        return $next($request);
    }
}
