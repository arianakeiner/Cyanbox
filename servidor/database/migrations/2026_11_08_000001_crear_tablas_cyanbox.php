<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Modelo de datos de Cyanbox, basado en el DER de la Etapa 2 (Figura 3).
 *
 * Correcciones respecto del DER preliminar:
 *  - detalles_comanda.id_comanda  (faltaba la FK hacia Comanda)
 *  - productos.id_categoria       (faltaba la FK hacia Categoria)
 *  - pagos.id_medio_pago          (faltaba la FK hacia MedioPago)
 *  - movimientos_stock.id_ingrediente (la relación figuraba "a definir")
 * Agregados por decisión de diseño:
 *  - atenciones_mesa.id_usuario / id_reserva / comensales (quién atiende y de dónde vino)
 *  - lista_espera (RF-03, figura en el prototipo y no en el DER)
 *  - usuarios.password / api_token (autenticación, RNF-04)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $t) {
            $t->id();
            $t->string('nombre', 30)->unique();
            $t->string('descripcion', 120)->nullable();
        });

        Schema::create('usuarios', function (Blueprint $t) {
            $t->id();
            $t->string('nombre', 80);
            $t->string('email', 120)->unique();
            $t->string('password');
            $t->foreignId('id_rol')->constrained('roles')->restrictOnDelete();
            $t->boolean('activo')->default(true);
            $t->string('api_token', 64)->nullable()->unique();
            $t->timestamp('token_expira')->nullable();
            $t->timestamps();
        });

        Schema::create('categorias', function (Blueprint $t) {
            $t->id();
            $t->string('nombre', 60)->unique();
            $t->unsignedSmallInteger('orden')->default(0);
            $t->timestamps();
        });

        Schema::create('productos', function (Blueprint $t) {
            $t->id();
            $t->foreignId('id_categoria')->constrained('categorias')->restrictOnDelete();
            $t->string('nombre', 80)->unique();
            $t->string('descripcion', 200)->nullable();
            $t->decimal('precio', 10, 2);
            $t->boolean('disponible')->default(true);
            $t->boolean('plato_del_dia')->default(false);
            $t->string('emoji', 8)->nullable();
            $t->timestamps();
        });

        Schema::create('mesas', function (Blueprint $t) {
            $t->id();
            $t->unsignedSmallInteger('numero')->unique();
            $t->string('nombre', 40);
            $t->unsignedSmallInteger('capacidad');
            $t->string('forma', 10)->default('round');      // round | rect (dibujo del mapa)
            $t->unsignedSmallInteger('pos_x')->default(10);  // posición en el mapa (%)
            $t->unsignedSmallInteger('pos_y')->default(10);
            $t->string('estado', 20)->default('disponible'); // ver App\Enums\EstadoMesa
            $t->timestamps();
        });

        Schema::create('clientes', function (Blueprint $t) {
            $t->id();
            $t->string('nombre', 80);
            $t->string('telefono', 30)->nullable();
            $t->timestamps();
        });

        Schema::create('reservas', function (Blueprint $t) {
            $t->id();
            $t->foreignId('id_cliente')->constrained('clientes')->restrictOnDelete();
            $t->foreignId('id_mesa')->nullable()->constrained('mesas')->nullOnDelete();
            $t->dateTime('fecha_hora');
            $t->unsignedSmallInteger('cantidad');
            $t->string('estado', 20)->default('pendiente'); // pendiente | confirmada | cumplida | cancelada
            $t->string('observaciones', 200)->nullable();
            $t->timestamps();
            $t->index(['fecha_hora']);
        });

        Schema::create('lista_espera', function (Blueprint $t) {
            $t->id();
            $t->string('nombre', 80);
            $t->string('telefono', 30)->nullable();
            $t->unsignedSmallInteger('cantidad');
            $t->string('estado', 20)->default('esperando'); // esperando | asignado | retirado
            $t->timestamps();
        });

        Schema::create('atenciones_mesa', function (Blueprint $t) {
            $t->id();
            $t->foreignId('id_mesa')->constrained('mesas')->restrictOnDelete();
            $t->foreignId('id_usuario')->nullable()->constrained('usuarios')->nullOnDelete();
            $t->foreignId('id_reserva')->nullable()->constrained('reservas')->nullOnDelete();
            $t->unsignedSmallInteger('comensales')->default(1);
            $t->dateTime('inicio');
            $t->dateTime('fin')->nullable();
            $t->string('estado', 20)->default('activa'); // activa | cerrada
            $t->timestamps();
        });

        Schema::create('comandas', function (Blueprint $t) {
            $t->id();
            $t->foreignId('id_atencion')->constrained('atenciones_mesa')->restrictOnDelete();
            $t->foreignId('id_usuario')->nullable()->constrained('usuarios')->nullOnDelete();
            $t->dateTime('fecha_hora');
            $t->string('estado', 20)->default('borrador'); // ver App\Enums\EstadoComanda
            $t->string('observaciones', 200)->nullable();
            $t->timestamps();
        });

        Schema::create('detalles_comanda', function (Blueprint $t) {
            $t->id();
            $t->foreignId('id_comanda')->constrained('comandas')->cascadeOnDelete();
            $t->foreignId('id_producto')->constrained('productos')->restrictOnDelete();
            $t->unsignedSmallInteger('cantidad');
            $t->decimal('precio_unitario', 10, 2); // precio al momento del pedido
            $t->string('observaciones', 150)->nullable();
        });

        Schema::create('medios_pago', function (Blueprint $t) {
            $t->id();
            $t->string('nombre', 40)->unique();
        });

        Schema::create('pagos', function (Blueprint $t) {
            $t->id();
            $t->foreignId('id_atencion')->constrained('atenciones_mesa')->restrictOnDelete();
            $t->foreignId('id_medio_pago')->constrained('medios_pago')->restrictOnDelete();
            $t->decimal('monto', 10, 2);
            $t->string('estado', 20)->default('confirmado');
            $t->timestamps();
        });

        // ---- Stock, recetas y proveedores (modelado / evolución) ----
        Schema::create('ingredientes', function (Blueprint $t) {
            $t->id();
            $t->string('nombre', 80)->unique();
            $t->string('unidad', 15)->default('u');
            $t->decimal('stock_actual', 10, 2)->default(0);
            $t->decimal('stock_minimo', 10, 2)->default(0);
            $t->timestamps();
        });

        Schema::create('recetas', function (Blueprint $t) {
            $t->id();
            $t->foreignId('id_producto')->unique()->constrained('productos')->cascadeOnDelete();
            $t->timestamps();
        });

        Schema::create('receta_ingrediente', function (Blueprint $t) {
            $t->foreignId('id_receta')->constrained('recetas')->cascadeOnDelete();
            $t->foreignId('id_ingrediente')->constrained('ingredientes')->restrictOnDelete();
            $t->decimal('cantidad', 10, 2);
            $t->primary(['id_receta', 'id_ingrediente']);
        });

        Schema::create('proveedores', function (Blueprint $t) {
            $t->id();
            $t->string('nombre', 80);
            $t->string('telefono', 30)->nullable();
            $t->timestamps();
        });

        Schema::create('movimientos_stock', function (Blueprint $t) {
            $t->id();
            $t->foreignId('id_ingrediente')->constrained('ingredientes')->restrictOnDelete();
            $t->string('tipo', 15); // ingreso | egreso | ajuste
            $t->decimal('cantidad', 10, 2);
            $t->dateTime('fecha_hora');
            $t->timestamps();
        });
    }

    public function down(): void
    {
        foreach ([
            'movimientos_stock', 'proveedores', 'receta_ingrediente', 'recetas', 'ingredientes',
            'pagos', 'medios_pago', 'detalles_comanda', 'comandas', 'atenciones_mesa',
            'lista_espera', 'reservas', 'clientes', 'mesas', 'productos', 'categorias', 'usuarios', 'roles',
        ] as $tabla) {
            Schema::dropIfExists($tabla);
        }
    }
};
