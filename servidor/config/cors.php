<?php

// Los orígenes permitidos dependen del modo: en prueba, cualquiera (datos de ejemplo, uso en la red local);
// en producción, la lista PROD_CLIENTES_PERMITIDOS del .env (separada por comas, * = cualquiera).
$produccion = strtolower((string) env('CYANBOX_MODO', 'prueba')) === 'produccion';

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => $produccion
        ? array_values(array_filter(array_map('trim', explode(',', (string) env('PROD_CLIENTES_PERMITIDOS', '*')))))
        : ['*'], // prueba: la app puede abrirse desde esta computadora, una tablet de la red o la APK
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
