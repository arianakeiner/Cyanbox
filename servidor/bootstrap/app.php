<?php

use App\Exceptions\ReglaNegocioException;
use App\Http\Middleware\AutenticarToken;
use App\Http\Middleware\VerificarRol;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'auth.token' => AutenticarToken::class,
            'rol' => VerificarRol::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Reglas de negocio y transiciones de estado inválidas → 422 con mensaje para el usuario.
        $exceptions->render(fn (ReglaNegocioException $e) => response()->json([
            'message' => $e->getMessage(), 'regla' => $e->regla,
        ], 422));

        // Registro inexistente → 404 en castellano.
        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['message' => $e->getPrevious() instanceof ModelNotFoundException
                    ? 'El registro solicitado no existe o fue eliminado.'
                    : 'La ruta solicitada no existe.'], 404);
            }
        });

        // Errores de base de datos: no se exponen detalles internos.
        $exceptions->render(function (QueryException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }
            $codigo = (string) $e->getCode();
            if (str_starts_with($codigo, '23')) { // violación de integridad (FK, único)
                return response()->json(['message' => 'La operación no se puede realizar porque el registro está relacionado con otros datos o ya existe.'], 409);
            }
            report($e);

            return response()->json(['message' => 'No se pudo acceder a la base de datos. Verificá que el servicio de persistencia esté conectado.'], 503);
        });
    })->create();
