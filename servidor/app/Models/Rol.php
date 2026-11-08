<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Rol extends Model
{
    public const ADMIN = 'admin';
    public const MOZO = 'mozo';
    public const COCINA = 'cocina';
    public const CAJA = 'caja';
    public const RECEPCION = 'recepcion';

    protected $table = 'roles';
    public $timestamps = false;
    protected $fillable = ['nombre', 'descripcion'];

    public function usuarios(): HasMany
    {
        return $this->hasMany(Usuario::class, 'id_rol');
    }
}
