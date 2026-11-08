<?php

use App\Http\Controllers\Api\AtencionController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoriaController;
use App\Http\Controllers\Api\ComandaController;
use App\Http\Controllers\Api\EstadoController;
use App\Http\Controllers\Api\InventarioController;
use App\Http\Controllers\Api\ListaEsperaController;
use App\Http\Controllers\Api\MesaController;
use App\Http\Controllers\Api\ProductoController;
use App\Http\Controllers\Api\ReporteController;
use App\Http\Controllers\Api\ReservaController;
use Illuminate\Support\Facades\Route;

/*
| API REST de Cyanbox (prefijo /api).
| Roles: admin, mozo, cocina, caja, recepcion. El admin puede todo.
*/

Route::get('estado', EstadoController::class);
Route::post('login', [AuthController::class, 'login'])->middleware('throttle:10,1');

Route::middleware('auth.token')->group(function () {
    Route::get('yo', [AuthController::class, 'yo']);
    Route::post('logout', [AuthController::class, 'logout']);

    // Lectura común a todos los perfiles
    Route::get('mesas', [MesaController::class, 'index']);
    Route::get('mesas/{mesa}', [MesaController::class, 'show']);
    Route::get('categorias', [CategoriaController::class, 'index']);
    Route::get('productos', [ProductoController::class, 'index']);
    Route::get('productos/{producto}', [ProductoController::class, 'show']);
    Route::get('medios-pago', [AtencionController::class, 'mediosPago']);
    Route::get('atenciones', [AtencionController::class, 'index']);
    Route::get('atenciones/{atencion}', [AtencionController::class, 'show']);
    Route::get('comandas', [ComandaController::class, 'index']);
    Route::get('comandas/{comanda}', [ComandaController::class, 'show']);
    Route::get('reservas', [ReservaController::class, 'index']);
    Route::get('reservas/{reserva}', [ReservaController::class, 'show']);
    Route::get('lista-espera', [ListaEsperaController::class, 'index']);

    // Salón: apertura de mesa y pedidos
    Route::middleware('rol:mozo,recepcion')->group(function () {
        Route::post('atenciones', [AtencionController::class, 'store']);
    });
    Route::middleware('rol:mozo')->group(function () {
        Route::post('comandas', [ComandaController::class, 'store']);
        Route::post('comandas/{comanda}/confirmar', [ComandaController::class, 'confirmar']);
        Route::post('comandas/{comanda}/cancelar', [ComandaController::class, 'cancelar']);
        Route::post('atenciones/{atencion}/solicitar-cuenta', [AtencionController::class, 'solicitarCuenta']);
    });

    // Cocina avanza la preparación; el mozo marca la entrega
    Route::middleware('rol:cocina,mozo')->post('comandas/{comanda}/avanzar', [ComandaController::class, 'avanzar']);
    Route::middleware('rol:cocina')->patch('productos/{producto}/disponibilidad', [ProductoController::class, 'disponibilidad']);

    // Caja: cobro y cierre
    Route::middleware('rol:caja')->group(function () {
        Route::post('atenciones/{atencion}/iniciar-cobro', [AtencionController::class, 'iniciarCobro']);
        Route::post('atenciones/{atencion}/pago', [AtencionController::class, 'pagar']);
    });

    // Recepción: reservas y lista de espera
    Route::middleware('rol:recepcion')->group(function () {
        Route::post('reservas', [ReservaController::class, 'store']);
        Route::put('reservas/{reserva}', [ReservaController::class, 'update']);
        Route::delete('reservas/{reserva}', [ReservaController::class, 'destroy']);
        Route::post('reservas/{reserva}/cancelar', [ReservaController::class, 'cancelar']);
        Route::post('reservas/{reserva}/reservar-mesa', [ReservaController::class, 'reservarMesa']);
        Route::post('lista-espera', [ListaEsperaController::class, 'store']);
        Route::put('lista-espera/{espera}', [ListaEsperaController::class, 'update']);
        Route::delete('lista-espera/{espera}', [ListaEsperaController::class, 'destroy']);
    });
    Route::middleware('rol:recepcion,mozo')->group(function () {
        Route::post('reservas/{reserva}/llegada', [ReservaController::class, 'llegada']);
        Route::post('lista-espera/{espera}/asignar', [ListaEsperaController::class, 'asignar']);
    });

    // Administración (sólo admin)
    Route::middleware('rol:admin')->group(function () {
        Route::post('categorias', [CategoriaController::class, 'store']);
        Route::put('categorias/{categoria}', [CategoriaController::class, 'update']);
        Route::delete('categorias/{categoria}', [CategoriaController::class, 'destroy']);
        Route::post('productos', [ProductoController::class, 'store']);
        Route::put('productos/{producto}', [ProductoController::class, 'update']);
        Route::delete('productos/{producto}', [ProductoController::class, 'destroy']);
        Route::post('mesas', [MesaController::class, 'store']);
        Route::put('mesas/{mesa}', [MesaController::class, 'update']);
        Route::delete('mesas/{mesa}', [MesaController::class, 'destroy']);
        Route::get('ingredientes', [InventarioController::class, 'ingredientes']);
        Route::post('ingredientes', [InventarioController::class, 'guardarIngrediente']);
        Route::put('ingredientes/{ingrediente}', [InventarioController::class, 'guardarIngrediente']);
        Route::get('recetas', [InventarioController::class, 'recetas']);
        Route::get('reportes/resumen', [ReporteController::class, 'resumen']);
    });
});
