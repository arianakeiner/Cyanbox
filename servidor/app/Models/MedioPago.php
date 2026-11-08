<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MedioPago extends Model
{
    protected $table = 'medios_pago';
    public $timestamps = false;
    protected $fillable = ['nombre'];
}
