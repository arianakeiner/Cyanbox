<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Presentadores\Json;
use App\Models\DetalleComanda;
use App\Models\Producto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Carta digital (RF-05, RF-06, RF-07) y su administración (RF-21). */
class ProductoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $productos = Producto::with('categoria')
            ->when($request->boolean('solo_disponibles'), fn ($q) => $q->where('disponible', true))
            ->orderBy('id_categoria')->orderBy('nombre')->get();

        return response()->json($productos->map(fn ($p) => Json::producto($p)));
    }

    public function show(Producto $producto): JsonResponse
    {
        return response()->json(Json::producto($producto->load('categoria')));
    }

    public function store(Request $request): JsonResponse
    {
        $producto = Producto::create($this->validar($request))->refresh();

        return response()->json(Json::producto($producto->load('categoria')), 201);
    }

    public function update(Request $request, Producto $producto): JsonResponse
    {
        $producto->update($this->validar($request, $producto));

        return response()->json(Json::producto($producto->load('categoria')));
    }

    /** Cambio rápido de disponibilidad (agotado / disponible). */
    public function disponibilidad(Request $request, Producto $producto): JsonResponse
    {
        $datos = $request->validate(['disponible' => 'required|boolean']);
        $producto->update($datos);

        return response()->json(Json::producto($producto->load('categoria')));
    }

    public function destroy(Producto $producto): JsonResponse
    {
        if (DetalleComanda::where('id_producto', $producto->id)->exists()) {
            return response()->json([
                'message' => "\"{$producto->nombre}\" figura en comandas anteriores y no se puede eliminar para no perder el historial. Podés marcarlo como no disponible.",
            ], 409);
        }
        $producto->delete();

        return response()->json(['message' => 'Producto eliminado.']);
    }

    private function validar(Request $request, ?Producto $producto = null): array
    {
        $datos = $request->validate([
            'nombre' => ['required', 'string', 'max:80', Rule::unique('productos', 'nombre')->ignore($producto?->id)],
            'id_categoria' => 'required|integer|exists:categorias,id',
            'descripcion' => 'nullable|string|max:200',
            'precio' => 'required|numeric|gt:0|max:99999999',
            'disponible' => 'boolean',
            'plato_del_dia' => 'boolean',
            'emoji' => 'nullable|string|max:8',
        ]);
        $datos['nombre'] = trim($datos['nombre']);

        return $datos;
    }
}
