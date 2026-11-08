<?php

namespace App\Http\Controllers\Api;

use App\Enums\EstadoComanda;
use App\Http\Controllers\Controller;
use App\Http\Presentadores\Json;
use App\Models\AtencionMesa;
use App\Models\Comanda;
use App\Services\ComandaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Toma de pedidos (RF-08, RF-10, RF-12) y pantalla de cocina (RF-11). */
class ComandaController extends Controller
{
    public function __construct(private ComandaService $servicio) {}

    /** Por defecto devuelve las comandas que cocina tiene que resolver. */
    public function index(Request $request): JsonResponse
    {
        $estados = $request->query('estados')
            ? explode(',', $request->query('estados'))
            : [EstadoComanda::PendienteCocina->value, EstadoComanda::EnPreparacion->value, EstadoComanda::Lista->value];

        $comandas = Comanda::with('detalles.producto', 'mozo', 'atencion.mesa')
            ->whereIn('estado', $estados)->orderBy('fecha_hora')->get();

        return response()->json($comandas->map(fn ($c) => Json::comanda($c)));
    }

    public function store(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'id_atencion' => 'required|integer|exists:atenciones_mesa,id',
            'items' => 'required|array|min:1',
            'items.*.id_producto' => 'required|integer|exists:productos,id',
            'items.*.cantidad' => 'required|integer|min:1|max:99',
            'items.*.observaciones' => 'nullable|string|max:150',
            'observaciones' => 'nullable|string|max:200',
            'enviar' => 'boolean',
        ]);
        $comanda = $this->servicio->crear(
            AtencionMesa::with('mesa')->findOrFail($datos['id_atencion']),
            $datos['items'],
            $datos['observaciones'] ?? null,
            $request->user(),
            $datos['enviar'] ?? true,
        );

        return response()->json(Json::comanda($comanda), 201);
    }

    public function show(Comanda $comanda): JsonResponse
    {
        return response()->json(Json::comanda($comanda));
    }

    public function avanzar(Comanda $comanda): JsonResponse
    {
        return response()->json(Json::comanda($this->servicio->avanzar($comanda)));
    }

    public function confirmar(Comanda $comanda): JsonResponse
    {
        return response()->json(Json::comanda($this->servicio->confirmar($comanda)));
    }

    public function cancelar(Comanda $comanda): JsonResponse
    {
        return response()->json(Json::comanda($this->servicio->cancelar($comanda)));
    }
}
