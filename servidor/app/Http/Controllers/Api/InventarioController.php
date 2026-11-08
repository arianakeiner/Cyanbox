<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ingrediente;
use App\Models\MovimientoStock;
use App\Models\Receta;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** Stock y recetas (RF-17, RF-18). El descuento automático por receta (RF-19) sigue pendiente de validación. */
class InventarioController extends Controller
{
    public function ingredientes(): JsonResponse
    {
        return response()->json(Ingrediente::orderBy('nombre')->get()->map(fn ($i) => $i->toArray() + ['bajo_minimo' => $i->bajoMinimo()]));
    }

    public function guardarIngrediente(Request $request, ?Ingrediente $ingrediente = null): JsonResponse
    {
        $datos = $request->validate([
            'nombre' => ['required', 'string', 'max:80', Rule::unique('ingredientes', 'nombre')->ignore($ingrediente?->id)],
            'unidad' => 'required|string|max:15',
            'stock_actual' => 'required|numeric|min:0',
            'stock_minimo' => 'required|numeric|min:0',
        ]);

        $ingrediente = DB::transaction(function () use ($ingrediente, $datos) {
            $anterior = $ingrediente?->stock_actual ?? 0;
            $ingrediente = $ingrediente ? tap($ingrediente)->update($datos) : Ingrediente::create($datos);
            if ((float) $datos['stock_actual'] !== (float) $anterior) {
                MovimientoStock::create([
                    'id_ingrediente' => $ingrediente->id, 'tipo' => 'ajuste',
                    'cantidad' => $datos['stock_actual'] - $anterior, 'fecha_hora' => now(),
                ]);
            }

            return $ingrediente;
        });

        return response()->json($ingrediente->toArray() + ['bajo_minimo' => $ingrediente->bajoMinimo()], $request->isMethod('post') ? 201 : 200);
    }

    public function recetas(): JsonResponse
    {
        return response()->json(Receta::with('producto', 'ingredientes')->get()->map(fn ($r) => [
            'id' => $r->id, 'producto' => $r->producto->nombre,
            'ingredientes' => $r->ingredientes->map(fn ($i) => ['nombre' => $i->nombre, 'cantidad' => (float) $i->pivot->cantidad, 'unidad' => $i->unidad]),
        ]));
    }
}
