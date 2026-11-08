<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Presentadores\Json;
use App\Models\AtencionMesa;
use App\Models\MedioPago;
use App\Models\Mesa;
use App\Services\AtencionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Atención de mesa: apertura, cuenta, cobro y cierre (RF-13, RF-14). */
class AtencionController extends Controller
{
    public function __construct(private AtencionService $servicio) {}

    public function index(Request $request): JsonResponse
    {
        $atenciones = AtencionMesa::query()
            ->when($request->query('estado'), fn ($q, $e) => $q->where('estado', $e))
            ->latest('inicio')->limit(100)->get();

        return response()->json($atenciones->map(fn ($a) => Json::atencion($a)));
    }

    public function store(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'id_mesa' => 'required|integer|exists:mesas,id',
            'comensales' => 'required|integer|min:1',
        ]);
        $atencion = $this->servicio->abrir(Mesa::findOrFail($datos['id_mesa']), $datos['comensales'], $request->user());

        return response()->json(Json::atencion($atencion), 201);
    }

    public function show(AtencionMesa $atencion): JsonResponse
    {
        return response()->json(Json::atencion($atencion));
    }

    public function solicitarCuenta(AtencionMesa $atencion): JsonResponse
    {
        return response()->json(Json::atencion($this->servicio->solicitarCuenta($atencion)));
    }

    public function iniciarCobro(AtencionMesa $atencion): JsonResponse
    {
        return response()->json(Json::atencion($this->servicio->iniciarCobro($atencion)));
    }

    public function pagar(Request $request, AtencionMesa $atencion): JsonResponse
    {
        $datos = $request->validate([
            'id_medio_pago' => 'required|integer|exists:medios_pago,id',
            'monto' => 'required|numeric|gt:0',
        ]);
        $this->servicio->confirmarPago($atencion, MedioPago::findOrFail($datos['id_medio_pago']), (float) $datos['monto']);

        return response()->json(Json::atencion($atencion->refresh()));
    }

    public function mediosPago(): JsonResponse
    {
        return response()->json(MedioPago::orderBy('id')->get());
    }
}
