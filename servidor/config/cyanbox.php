<?php

/*
| Configuración propia de Cyanbox.
| CYANBOX_MODO = prueba | produccion (se elige en el primer arranque con iniciar.php).
*/
$modo = strtolower((string) env('CYANBOX_MODO', 'prueba')) === 'produccion' ? 'produccion' : 'prueba';

return [
    'modo' => $modo,

    'servidor' => [
        'host' => $modo === 'produccion' ? env('PROD_SERVIDOR_HOST', '0.0.0.0') : '127.0.0.1',
        'puerto' => (int) ($modo === 'produccion' ? env('PROD_SERVIDOR_PUERTO', 8000) : 8000),
    ],

    // Orígenes (URL de los clientes web) que pueden consumir la API.
    'clientes_permitidos' => $modo === 'produccion'
        ? array_values(array_filter(array_map('trim', explode(',', (string) env('PROD_CLIENTES_PERMITIDOS', '*')))))
        : ['http://localhost:5173', 'http://127.0.0.1:5173'],

    // Duración estimada de una reserva (minutos) para detectar superposiciones en la misma mesa.
    'duracion_reserva_min' => (int) env('CYANBOX_DURACION_RESERVA_MIN', 120),

    // Horas de validez del token de sesión.
    'horas_token' => (int) env('CYANBOX_HORAS_TOKEN', 12),
];
