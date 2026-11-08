<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DetalleComanda extends Model
{
    protected $table = 'detalles_comanda';
    public $timestamps = false;
    protected $fillable = ['id_comanda', 'id_producto', 'cantidad', 'precio_unitario', 'observaciones'];

    protected function casts(): array
    {
        return ['cantidad' => 'integer', 'precio_unitario' => 'float'];
    }

    public function comanda(): BelongsTo
    {
        return $this->belongsTo(Comanda::class, 'id_comanda');
    }

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class, 'id_producto');
    }

    public function subtotal(): float
    {
        return round($this->cantidad * $this->precio_unitario, 2);
    }
}
