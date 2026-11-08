<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/** Lo usa el servicio cliente al iniciar para verificar que el servicio de persistencia esté activo. */
class EstadoController extends Controller
{
    public function __invoke(): JsonResponse
    {
        try {
            DB::connection()->getPdo();
            $bd = 'ok';
        } catch (\Throwable) {
            $bd = 'sin conexión';
        }

        return response()->json([
            'servicio' => 'cyanbox-persistencia',
            'version' => '1.0.0',
            'modo' => config('cyanbox.modo'),
            'base_de_datos' => ['motor' => DB::getDefaultConnection(), 'estado' => $bd],
            'hora_servidor' => now()->toIso8601String(),
        ], $bd === 'ok' ? 200 : 503);
    }
}
