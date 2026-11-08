<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AtencionMesa;
use App\Models\Pago;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Reportes básicos (RF-16): platos vendidos, medios de pago e historial. */
class ReporteController extends Controller
{
    public function resumen(Request $request): JsonResponse
    {
        $dias = max(1, min(365, (int) $request->query('dias', 30)));
        $desde = now()->subDays($dias)->startOfDay();

        $platos = DB::table('detalles_comanda as d')
            ->join('comandas as c', 'c.id', '=', 'd.id_comanda')
            ->join('productos as p', 'p.id', '=', 'd.id_producto')
            ->where('c.estado', '!=', 'cancelada')->where('c.estado', '!=', 'borrador')
            ->where('c.fecha_hora', '>=', $desde)
            ->groupBy('p.id', 'p.nombre')
            ->selectRaw('p.nombre, SUM(d.cantidad) as cantidad, SUM(d.cantidad * d.precio_unitario) as importe')
            ->orderByDesc('cantidad')->limit(8)->get();

        $medios = Pago::query()->join('medios_pago as m', 'm.id', '=', 'pagos.id_medio_pago')
            ->where('pagos.created_at', '>=', $desde)
            ->groupBy('m.nombre')->selectRaw('m.nombre, COUNT(*) as cantidad, SUM(pagos.monto) as importe')->get();

        $cerradas = AtencionMesa::where('estado', AtencionMesa::CERRADA)->where('fin', '>=', $desde)->get();

        return response()->json([
            'dias' => $dias,
            'atenciones_cerradas' => $cerradas->count(),
            'facturacion' => round((float) Pago::where('created_at', '>=', $desde)->sum('monto'), 2),
            'ticket_promedio' => $cerradas->count() ? round((float) Pago::where('created_at', '>=', $desde)->avg('monto'), 2) : 0,
            'minutos_promedio' => $cerradas->count() ? (int) round($cerradas->avg(fn ($a) => $a->minutosTranscurridos())) : 0,
            'platos_mas_vendidos' => $platos,
            'medios_de_pago' => $medios,
        ]);
    }
}
