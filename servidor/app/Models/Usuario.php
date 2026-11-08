<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;

class Usuario extends Authenticatable
{
    protected $table = 'usuarios';
    protected $fillable = ['nombre', 'email', 'password', 'id_rol', 'activo'];
    protected $hidden = ['password', 'api_token', 'token_expira'];

    protected function casts(): array
    {
        return ['password' => 'hashed', 'activo' => 'boolean', 'token_expira' => 'datetime'];
    }

    public function rol(): BelongsTo
    {
        return $this->belongsTo(Rol::class, 'id_rol');
    }

    public function tieneRol(string ...$roles): bool
    {
        $nombre = $this->rol?->nombre;

        return $nombre === Rol::ADMIN || in_array($nombre, $roles, true);
    }
}
