<?php

use Illuminate\Support\Facades\Route;

// Este servicio sólo expone la API. La aplicación web es el servicio "cliente".
Route::get('/', fn () => response()->json([
    'servicio' => 'Cyanbox · servicio de persistencia',
    'api' => url('/api'),
    'estado' => url('/api/estado'),
]));
