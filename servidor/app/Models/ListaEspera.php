<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ListaEspera extends Model
{
    public const ESPERANDO = 'esperando';
    public const ASIGNADO = 'asignado';
    public const RETIRADO = 'retirado';

    protected $table = 'lista_espera';
    protected $fillable = ['nombre', 'telefono', 'cantidad', 'estado'];

    protected function casts(): array
    {
        return ['cantidad' => 'integer'];
    }
}
