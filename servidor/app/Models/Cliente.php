<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Cliente extends Model
{
    protected $table = 'clientes';
    protected $fillable = ['nombre', 'telefono'];

    public function reservas(): HasMany
    {
        return $this->hasMany(Reserva::class, 'id_cliente');
    }
}
