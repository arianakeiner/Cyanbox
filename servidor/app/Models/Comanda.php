<?php

namespace App\Models;

use App\Enums\EstadoComanda;
use App\Exceptions\ReglaNegocioException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Comanda extends Model
{
    protected $table = 'comandas';
    protected $fillable = ['id_atencion', 'id_usuario', 'fecha_hora', 'estado', 'observaciones'];

    protected function casts(): array
    {
        return ['fecha_hora' => 'datetime', 'estado' => EstadoComanda::class];
    }

    public function atencion(): BelongsTo
    {
        return $this->belongsTo(AtencionMesa::class, 'id_atencion');
    }

    public function mozo(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'id_usuario');
    }

    public function detalles(): HasMany
    {
        return $this->hasMany(DetalleComanda::class, 'id_comanda');
    }

    public function total(): float
    {
        return round($this->detalles->sum(fn (DetalleComanda $d) => $d->subtotal()), 2);
    }

    public function codigo(): string
    {
        return 'C-'.str_pad((string) $this->id, 3, '0', STR_PAD_LEFT);
    }

    public function pasarA(EstadoComanda $destino): void
    {
        if (! $this->estado->puedePasarA($destino)) {
            throw new ReglaNegocioException(
                "La comanda {$this->codigo()} está {$this->estado->etiqueta()} y no puede pasar a {$destino->etiqueta()}.",
                'estado-comanda'
            );
        }
        $this->estado = $destino;
        $this->save();
    }
}
