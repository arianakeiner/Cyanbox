<?php

namespace App\Models;

use App\Enums\EstadoMesa;
use App\Exceptions\ReglaNegocioException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Mesa extends Model
{
    protected $table = 'mesas';
    protected $fillable = ['numero', 'nombre', 'capacidad', 'forma', 'pos_x', 'pos_y', 'estado'];

    protected function casts(): array
    {
        return ['estado' => EstadoMesa::class, 'numero' => 'integer', 'capacidad' => 'integer', 'pos_x' => 'integer', 'pos_y' => 'integer'];
    }

    public function atenciones(): HasMany
    {
        return $this->hasMany(AtencionMesa::class, 'id_mesa');
    }

    public function atencionActiva(): HasOne
    {
        return $this->hasOne(AtencionMesa::class, 'id_mesa')->where('estado', AtencionMesa::ACTIVA); // RN-01: como máximo una por mesa
    }

    public function reservas(): HasMany
    {
        return $this->hasMany(Reserva::class, 'id_mesa');
    }

    /** Aplica una transición del diagrama de estados o lanza un error de regla de negocio. */
    public function pasarA(EstadoMesa $destino): void
    {
        if (! $this->estado->puedePasarA($destino)) {
            throw new ReglaNegocioException(
                "{$this->nombre} está {$this->estado->etiqueta()} y no puede pasar a {$destino->etiqueta()}.",
                'estado-mesa'
            );
        }
        $this->estado = $destino;
        $this->save();
    }
}
