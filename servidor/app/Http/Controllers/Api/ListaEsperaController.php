<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Presentadores\Json;
use App\Models\ListaEspera;
use App\Models\Mesa;
use App\Services\AtencionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Lista de espera (RF-03, segunda prioridad). */
class ListaEsperaController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(ListaEspera::where('estado', ListaEspera::ESPERANDO)->orderBy('created_at')->get());
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(ListaEspera::create($this->validar($request) + ['estado' => ListaEspera::ESPERANDO]), 201);
    }

    public function update(Request $request, ListaEspera $espera): JsonResponse
    {
        $espera->update($this->validar($request));

        return response()->json($espera);
    }

    public function destroy(ListaEspera $espera): JsonResponse
    {
        $espera->update(['estado' => ListaEspera::RETIRADO]);

        return response()->json(['message' => 'Grupo retirado de la lista de espera.']);
    }

    /** Ubica al grupo en una mesa disponible y abre la atención. */
    public function asignar(Request $request, ListaEspera $espera, AtencionService $atenciones): JsonResponse
    {
        $datos = $request->validate(['id_mesa' => 'required|integer|exists:mesas,id']);
        $mesa = Mesa::findOrFail($datos['id_mesa']);
        $atencion = $atenciones->abrir($mesa, min($espera->cantidad, $mesa->capacidad), $request->user());
        $espera->update(['estado' => ListaEspera::ASIGNADO]);

        return response()->json(Json::atencion($atencion), 201);
    }

    private function validar(Request $request): array
    {
        return $request->validate([
            'nombre' => 'required|string|max:80',
            'telefono' => 'nullable|string|max:30',
            'cantidad' => 'required|integer|min:1|max:30',
        ]);
    }
}
