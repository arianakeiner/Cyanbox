<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MovimientoStock extends Model
{
    protected $table = 'movimientos_stock';
    protected $fillable = ['id_ingrediente', 'tipo', 'cantidad', 'fecha_hora'];

    protected function casts(): array
    {
        return ['cantidad' => 'float', 'fecha_hora' => 'datetime'];
    }

    public function ingrediente(): BelongsTo
    {
        return $this->belongsTo(Ingrediente::class, 'id_ingrediente');
    }
}
