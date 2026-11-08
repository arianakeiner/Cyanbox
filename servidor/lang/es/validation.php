<?php

// Mensajes de validación en castellano para la API de Cyanbox.
return [
    'array' => 'El campo :attribute debe ser una lista.',
    'boolean' => 'El campo :attribute debe ser verdadero o falso.',
    'date' => 'El campo :attribute no es una fecha válida.',
    'email' => 'El campo :attribute debe ser un correo electrónico válido.',
    'exists' => 'El valor seleccionado en :attribute no existe.',
    'gt' => ['numeric' => 'El campo :attribute debe ser mayor que :value.'],
    'in' => 'El valor seleccionado en :attribute no es válido.',
    'integer' => 'El campo :attribute debe ser un número entero.',
    'max' => [
        'numeric' => 'El campo :attribute no puede ser mayor que :max.',
        'string' => 'El campo :attribute no puede tener más de :max caracteres.',
        'array' => 'El campo :attribute no puede tener más de :max elementos.',
    ],
    'min' => [
        'numeric' => 'El campo :attribute debe ser al menos :min.',
        'string' => 'El campo :attribute debe tener al menos :min caracteres.',
        'array' => 'El campo :attribute debe tener al menos :min elemento(s).',
    ],
    'numeric' => 'El campo :attribute debe ser un número.',
    'required' => 'El campo :attribute es obligatorio.',
    'string' => 'El campo :attribute debe ser texto.',
    'unique' => 'Ya existe un registro con ese :attribute.',

    'attributes' => [
        'nombre' => 'nombre', 'email' => 'correo', 'password' => 'contraseña', 'precio' => 'precio',
        'id_categoria' => 'categoría', 'id_mesa' => 'mesa', 'id_atencion' => 'atención', 'id_medio_pago' => 'medio de pago',
        'numero' => 'número', 'capacidad' => 'capacidad', 'cantidad' => 'cantidad de personas', 'comensales' => 'comensales',
        'fecha_hora' => 'fecha y hora', 'telefono' => 'teléfono', 'monto' => 'monto', 'items' => 'productos',
        'items.*.cantidad' => 'cantidad', 'items.*.id_producto' => 'producto', 'stock_actual' => 'existencia',
        'stock_minimo' => 'stock mínimo', 'id_rol' => 'rol', 'unidad' => 'unidad',
    ],
];
