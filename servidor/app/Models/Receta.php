<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/** Relación conceptual plato-ingredientes. El descuento automático de stock sigue pendiente (RF-19). */
class Receta extends Model
{
    protected $table = 'recetas';
    protected $fillable = ['id_producto'];

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class, 'id_producto');
    }

    public function ingredientes(): BelongsToMany
    {
        return $this->belongsToMany(Ingrediente::class, 'receta_ingrediente', 'id_receta', 'id_ingrediente')->withPivot('cantidad');
    }
}
