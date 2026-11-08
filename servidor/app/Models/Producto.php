<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Producto extends Model
{
    protected $table = 'productos';
    protected $fillable = ['id_categoria', 'nombre', 'descripcion', 'precio', 'disponible', 'plato_del_dia', 'emoji'];

    protected function casts(): array
    {
        return ['precio' => 'float', 'disponible' => 'boolean', 'plato_del_dia' => 'boolean'];
    }

    public function categoria(): BelongsTo
    {
        return $this->belongsTo(Categoria::class, 'id_categoria');
    }

    public function receta(): HasOne
    {
        return $this->hasOne(Receta::class, 'id_producto');
    }
}
