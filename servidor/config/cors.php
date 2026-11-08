<?php

// Los orígenes permitidos dependen del modo: en prueba, el cliente local (localhost:5173);
// en producción, la lista PROD_CLIENTES_PERMITIDOS del .env (separada por comas, * = cualquiera).
$produccion = strtolower((string) env('CYANBOX_MODO', 'prueba')) === 'produccion';

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => $produccion
        ? array_values(array_filter(array_map('trim', explode(',', (string) env('PROD_CLIENTES_PERMITIDOS', '*')))))
        : ['http://localhost:5173', 'http://127.0.0.1:5173'],
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
