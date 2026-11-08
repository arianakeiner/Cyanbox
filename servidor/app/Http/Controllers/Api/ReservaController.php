<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Presentadores\Json;
use App\Models\Reserva;
use App\Services\ReservaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/** Reservas (RF-02): CRUD completo, asignación de mesa y llegada del cliente. */
class ReservaController extends Controller
{
    public function __construct(private ReservaService $servicio) {}

    public function index(Request $request): JsonResponse
    {
        $reservas = Reserva::with('cliente', 'mesa')
            ->when($request->query('fecha'), fn ($q, $f) => $q->whereDate('fecha_hora', Carbon::parse($f)->toDateString()))
            ->when($request->query('desde'), fn ($q, $f) => $q->where('fecha_hora', '>=', Carbon::parse($f)->startOfDay()))
            ->when($request->query('hasta'), fn ($q, $f) => $q->where('fecha_hora', '<=', Carbon::parse($f)->endOfDay()))
            ->orderBy('fecha_hora')->get();

        return response()->json($reservas->map(fn ($r) => Json::reserva($r)));
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(Json::reserva($this->servicio->crear($this->validar($request))), 201);
    }

    public function show(Reserva $reserva): JsonResponse
    {
        return response()->json(Json::reserva($reserva));
    }

    public function update(Request $request, Reserva $reserva): JsonResponse
    {
        return response()->json(Json::reserva($this->servicio->actualizar($reserva, $this->validar($request, true))));
    }

    public function destroy(Reserva $reserva): JsonResponse
    {
        $this->servicio->eliminar($reserva);

        return response()->json(['message' => 'Reserva eliminada.']);
    }

    public function cancelar(Reserva $reserva): JsonResponse
    {
        return response()->json(Json::reserva($this->servicio->cancelar($reserva)));
    }

    public function reservarMesa(Reserva $reserva): JsonResponse
    {
        $this->servicio->reservarMesa($reserva);

        return response()->json(Json::reserva($reserva->refresh()));
    }

    public function llegada(Request $request, Reserva $reserva): JsonResponse
    {
        $datos = $request->validate(['id_mesa' => 'nullable|integer|exists:mesas,id']);
        $atencion = $this->servicio->registrarLlegada($reserva, $request->user(), $datos['id_mesa'] ?? null);

        return response()->json(Json::atencion($atencion), 201);
    }

    private function validar(Request $request, bool $edicion = false): array
    {
        return $request->validate([
            'nombre' => 'required|string|max:80',
            'telefono' => 'nullable|string|max:30',
            'fecha_hora' => 'required|date',
            'cantidad' => 'required|integer|min:1|max:30',
            'id_mesa' => 'nullable|integer|exists:mesas,id',
            'estado' => 'nullable|in:'.implode(',', $edicion ? Reserva::ESTADOS : [Reserva::PENDIENTE, Reserva::CONFIRMADA]),
            'observaciones' => 'nullable|string|max:200',
        ]);
    }
}
