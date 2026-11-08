<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Pago extends Model
{
    protected $table = 'pagos';
    protected $fillable = ['id_atencion', 'id_medio_pago', 'monto', 'estado'];

    protected function casts(): array
    {
        return ['monto' => 'float'];
    }

    public function atencion(): BelongsTo
    {
        return $this->belongsTo(AtencionMesa::class, 'id_atencion');
    }

    public function medioPago(): BelongsTo
    {
        return $this->belongsTo(MedioPago::class, 'id_medio_pago');
    }
}
