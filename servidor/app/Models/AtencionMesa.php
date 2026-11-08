<?php

namespace App\Models;

use App\Enums\EstadoComanda;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Cada atención concreta de una mesa (decisión de diseño de la Etapa 2):
 * guarda inicio, fin, comandas y pago, y permite reutilizar la mesa física muchas veces.
 */
class AtencionMesa extends Model
{
    public const ACTIVA = 'activa';
    public const CERRADA = 'cerrada';

    protected $table = 'atenciones_mesa';
    protected $fillable = ['id_mesa', 'id_usuario', 'id_reserva', 'comensales', 'inicio', 'fin', 'estado'];

    protected function casts(): array
    {
        return ['inicio' => 'datetime', 'fin' => 'datetime', 'comensales' => 'integer'];
    }

    public function mesa(): BelongsTo
    {
        return $this->belongsTo(Mesa::class, 'id_mesa');
    }

    public function mozo(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'id_usuario');
    }

    public function reserva(): BelongsTo
    {
        return $this->belongsTo(Reserva::class, 'id_reserva');
    }

    public function comandas(): HasMany
    {
        return $this->hasMany(Comanda::class, 'id_atencion');
    }

    public function pagos(): HasMany
    {
        return $this->hasMany(Pago::class, 'id_atencion');
    }

    public function estaActiva(): bool
    {
        return $this->estado === self::ACTIVA;
    }

    /** Total consumido: suma de las comandas no canceladas. */
    public function total(): float
    {
        $this->loadMissing('comandas.detalles');

        return round($this->comandas
            ->reject(fn (Comanda $c) => $c->estado === EstadoComanda::Cancelada)
            ->sum(fn (Comanda $c) => $c->total()), 2);
    }

    /** RN-02: el tiempo de ocupación se calcula desde la apertura de la atención. */
    public function minutosTranscurridos(): int
    {
        return (int) $this->inicio->diffInMinutes($this->fin ?? now());
    }
}
