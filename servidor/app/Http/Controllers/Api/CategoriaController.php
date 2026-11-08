<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Categoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CategoriaController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Categoria::withCount('productos')->orderBy('orden')->orderBy('nombre')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'nombre' => 'required|string|max:60|unique:categorias,nombre',
            'orden' => 'nullable|integer|min:0',
        ]);

        return response()->json(Categoria::create(['nombre' => $datos['nombre'], 'orden' => $datos['orden'] ?? 0])->refresh(), 201);
    }

    public function update(Request $request, Categoria $categoria): JsonResponse
    {
        $datos = $request->validate([
            'nombre' => ['required', 'string', 'max:60', Rule::unique('categorias', 'nombre')->ignore($categoria->id)],
            'orden' => 'nullable|integer|min:0',
        ]);
        $categoria->update(['nombre' => $datos['nombre'], 'orden' => $datos['orden'] ?? $categoria->orden]);

        return response()->json($categoria);
    }

    public function destroy(Categoria $categoria): JsonResponse
    {
        if ($categoria->productos()->exists()) {
            return response()->json(['message' => "No se puede eliminar \"{$categoria->nombre}\" porque tiene productos. Movelos a otra categoría primero."], 409);
        }
        $categoria->delete();

        return response()->json(['message' => 'Categoría eliminada.']);
    }
}
