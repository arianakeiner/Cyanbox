<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Presentadores\Json;
use App\Models\Mesa;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Mapa del salón (RF-01, RF-04) y configuración de mesas (RF-21). */
class MesaController extends Controller
{
    public function index(): JsonResponse
    {
        $mesas = Mesa::with('atencionActiva.mozo', 'atencionActiva.comandas.detalles')->orderBy('numero')->get();

        return response()->json($mesas->map(fn ($m) => Json::mesa($m)));
    }

    public function show(Mesa $mesa): JsonResponse
    {
        return response()->json(Json::mesa($mesa->load('atencionActiva.mozo', 'atencionActiva.comandas.detalles')));
    }

    public function store(Request $request): JsonResponse
    {
        $datos = $this->validar($request);
        $mesa = Mesa::create($datos + ['estado' => 'disponible'])->refresh();

        return response()->json(Json::mesa($mesa), 201);
    }

    public function update(Request $request, Mesa $mesa): JsonResponse
    {
        $datos = $this->validar($request, $mesa);
        if ($mesa->estado->tieneAtencionActiva() && $datos['capacidad'] < $mesa->atencionActiva?->comensales) {
            return response()->json(['message' => 'La mesa está ocupada por más personas que la nueva capacidad.'], 422);
        }
        $mesa->update($datos);

        return response()->json(Json::mesa($mesa->refresh()));
    }

    public function destroy(Mesa $mesa): JsonResponse
    {
        if ($mesa->estado->tieneAtencionActiva()) {
            return response()->json(['message' => "{$mesa->nombre} tiene una atención activa y no se puede eliminar."], 409);
        }
        if ($mesa->atenciones()->exists()) {
            return response()->json(['message' => "{$mesa->nombre} tiene atenciones en el historial y no se puede eliminar."], 409);
        }
        $mesa->delete();

        return response()->json(['message' => 'Mesa eliminada.']);
    }

    private function validar(Request $request, ?Mesa $mesa = null): array
    {
        $datos = $request->validate([
            'numero' => ['required', 'integer', 'min:1', Rule::unique('mesas', 'numero')->ignore($mesa?->id)],
            'nombre' => 'required|string|max:40',
            'capacidad' => 'required|integer|min:1|max:30',
            'forma' => 'nullable|in:round,rect',
            'pos_x' => 'nullable|integer|min:0|max:100',
            'pos_y' => 'nullable|integer|min:0|max:100',
        ]);

        // Los datos opcionales del dibujo que vienen vacíos toman el valor por defecto de la tabla.
        return array_filter($datos, fn ($v) => $v !== null);
    }
}
