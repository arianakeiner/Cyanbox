<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Ingrediente extends Model
{
    protected $table = 'ingredientes';
    protected $fillable = ['nombre', 'unidad', 'stock_actual', 'stock_minimo'];

    protected function casts(): array
    {
        return ['stock_actual' => 'float', 'stock_minimo' => 'float'];
    }

    public function movimientos(): HasMany
    {
        return $this->hasMany(MovimientoStock::class, 'id_ingrediente');
    }

    /** Alerta de stock (RF-17): existencia en o por debajo del mínimo. */
    public function bajoMinimo(): bool
    {
        return $this->stock_actual <= $this->stock_minimo;
    }
}
