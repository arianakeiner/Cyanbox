<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Reserva extends Model
{
    public const PENDIENTE = 'pendiente';
    public const CONFIRMADA = 'confirmada';
    public const CUMPLIDA = 'cumplida';
    public const CANCELADA = 'cancelada';
    public const ESTADOS = [self::PENDIENTE, self::CONFIRMADA, self::CUMPLIDA, self::CANCELADA];

    protected $table = 'reservas';
    protected $fillable = ['id_cliente', 'id_mesa', 'fecha_hora', 'cantidad', 'estado', 'observaciones'];

    protected function casts(): array
    {
        return ['fecha_hora' => 'datetime', 'cantidad' => 'integer'];
    }

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(Cliente::class, 'id_cliente');
    }

    public function mesa(): BelongsTo
    {
        return $this->belongsTo(Mesa::class, 'id_mesa');
    }

    public function estaVigente(): bool
    {
        return in_array($this->estado, [self::PENDIENTE, self::CONFIRMADA], true);
    }
}
