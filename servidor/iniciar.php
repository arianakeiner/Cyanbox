<?php

/**
 * CYANBOX · Arranque del servicio de persistencia (API + base de datos).
 *
 * Uso:
 *   php iniciar.php              → usa el modo guardado en .env (la primera vez lo pregunta)
 *   php iniciar.php prueba       → fuerza modo prueba (todo en localhost, sin configurar nada)
 *   php iniciar.php produccion   → fuerza modo producción (lee las variables PROD_* del .env)
 *   php iniciar.php prueba --reiniciar-datos   → borra la base de prueba y vuelve a cargar los datos de ejemplo
 */

const RAIZ = __DIR__;
chdir(RAIZ);

function decir(string $texto = ''): void { echo $texto.PHP_EOL; }
function error_y_salir(string $texto): never { fwrite(STDERR, PHP_EOL."  ✖ {$texto}".PHP_EOL.PHP_EOL); exit(1); }
function artisan(string $comando): int { passthru(escapeshellarg(PHP_BINARY).' artisan '.$comando, $codigo); return $codigo; }

function normalizar_modo(?string $valor): ?string
{
    $v = strtolower(trim((string) $valor));
    $v = strtr($v, ['ó' => 'o', 'Ó' => 'o']);
    return match (true) {
        in_array($v, ['prueba', 'pruebas', 'test', 'testing', 'p', 'local', 'demo'], true) => 'prueba',
        in_array($v, ['produccion', 'prod', 'production', 'producción'], true) => 'produccion',
        default => null,
    };
}

/** Lee el .env como arreglo clave => valor (formato simple KEY=valor). */
function leer_env(string $archivo): array
{
    $datos = [];
    foreach (file($archivo, FILE_IGNORE_NEW_LINES) ?: [] as $linea) {
        if (preg_match('/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/', $linea, $m)) {
            $datos[$m[1]] = trim($m[2], " \t\"'");
        }
    }
    // Las variables de entorno del sistema (por ejemplo, las de Docker) tienen prioridad sobre el .env.
    foreach (getenv() as $clave => $valor) {
        if ($valor !== '' && str_starts_with($clave, 'PROD_')) $datos[$clave] = $valor;
    }
    return $datos;
}

function escribir_env(string $archivo, string $clave, string $valor): void
{
    $contenido = file_get_contents($archivo);
    $linea = "{$clave}={$valor}";
    $contenido = preg_match("/^{$clave}=.*$/m", $contenido)
        ? preg_replace("/^{$clave}=.*$/m", $linea, $contenido)
        : rtrim($contenido).PHP_EOL.$linea.PHP_EOL;
    file_put_contents($archivo, $contenido);
}

/** Direcciones IPv4 de este equipo en la red local. */
function direcciones_red(): array
{
    $ips = [];
    foreach (function_exists('net_get_interfaces') ? (net_get_interfaces() ?: []) : [] as $interfaz) {
        foreach ($interfaz['unicast'] ?? [] as $u) {
            $ip = $u['address'] ?? '';
            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) && ! str_starts_with($ip, '127.')) $ips[] = $ip;
        }
    }
    return array_values(array_unique($ips));
}

decir();
decir('  ┌──────────────────────────────────────────────┐');
decir('  │  CYANBOX · Servicio de persistencia (API)     │');
decir('  └──────────────────────────────────────────────┘');

// 1. Requisitos
if (version_compare(PHP_VERSION, '8.3.0', '<')) {
    error_y_salir('Se necesita PHP 8.3 o superior (versión actual: '.PHP_VERSION.').');
}
foreach (['pdo', 'mbstring', 'openssl'] as $ext) {
    if (! extension_loaded($ext)) error_y_salir("Falta la extensión de PHP \"{$ext}\". Activala en php.ini.");
}
if (! is_dir(RAIZ.'/vendor')) {
    decir('  • Instalando dependencias (composer install)... sólo la primera vez.');
    passthru('composer install --no-interaction --prefer-dist', $c);
    if ($c !== 0) error_y_salir('No se pudieron instalar las dependencias. Verificá que Composer esté instalado (https://getcomposer.org).');
}

// 2. Archivo .env
$env = RAIZ.'/.env';
if (! file_exists($env)) {
    copy(RAIZ.'/.env.example', $env);
    decir('  • Se creó el archivo .env a partir de .env.example');
}

// 3. Modo de ejecución: argumento > valor guardado > pregunta
$argumentos = array_slice($argv, 1);
$reiniciar = in_array('--reiniciar-datos', $argumentos, true);
$modoArg = null;
foreach ($argumentos as $a) {
    if (! str_starts_with($a, '--')) $modoArg = $a;
}
$modo = normalizar_modo($modoArg) ?? normalizar_modo(leer_env($env)['CYANBOX_MODO'] ?? '');
if ($modoArg && ! normalizar_modo($modoArg)) {
    error_y_salir("Modo \"{$modoArg}\" no reconocido. Usá \"prueba\" o \"produccion\".");
}
while (! $modo) {
    decir();
    decir('  ¿En qué modo querés iniciar?');
    decir('    prueba      → todo en este equipo (localhost). No hay que configurar nada.');
    decir('    produccion  → usa los datos del servidor y la base remota que figuran en .env');
    echo '  Modo [prueba]: ';
    $respuesta = trim((string) fgets(STDIN));
    $modo = normalizar_modo($respuesta !== '' ? $respuesta : 'prueba');
}
escribir_env($env, 'CYANBOX_MODO', $modo);
putenv("CYANBOX_MODO={$modo}");
decir("  • Modo: ".strtoupper($modo).' (guardado en .env)');

// 4. Validación de configuración en producción
$vars = leer_env($env);
if ($modo === 'produccion') {
    $faltan = array_filter(
        ['PROD_SERVIDOR_HOST', 'PROD_SERVIDOR_PUERTO', 'PROD_DB_HOST', 'PROD_DB_PORT', 'PROD_DB_DATABASE', 'PROD_DB_USERNAME'],
        fn ($k) => ($vars[$k] ?? '') === ''
    );
    if ($faltan) {
        error_y_salir("Faltan datos de producción en .env: ".implode(', ', $faltan).".\n    Completalos y volvé a ejecutar, o iniciá en modo prueba: php iniciar.php prueba");
    }
    $host = $vars['PROD_SERVIDOR_HOST'];
    $puerto = (int) $vars['PROD_SERVIDOR_PUERTO'];
} else {
    // 0.0.0.0: la API también responde a las tablets conectadas a la misma red Wi-Fi.
    $host = '0.0.0.0';
    $puerto = 8000;
    $sqlite = RAIZ.'/database/cyanbox_prueba.sqlite';
    if ($reiniciar && file_exists($sqlite)) {
        unlink($sqlite);
        decir('  • Base de prueba eliminada: se vuelve a crear con los datos de ejemplo.');
    }
    if (! file_exists($sqlite)) {
        touch($sqlite);
    }
}

// 5. Clave de la aplicación
if (($vars['APP_KEY'] ?? '') === '') {
    artisan('key:generate --force --no-interaction -q');
    decir('  • Se generó la clave de la aplicación (APP_KEY).');
}

// 6. Base de datos: conexión, tablas y datos iniciales
artisan('config:clear -q');
decir('  • Verificando la base de datos...');
if (artisan('db:show -q') !== 0) {
    error_y_salir($modo === 'produccion'
        ? "No se pudo conectar a la base de datos {$vars['PROD_DB_DATABASE']} en {$vars['PROD_DB_HOST']}:{$vars['PROD_DB_PORT']}.\n    Revisá PROD_DB_* en .env, que PostgreSQL esté encendido y que el usuario tenga permisos."
        : 'No se pudo abrir la base SQLite de prueba (database/cyanbox_prueba.sqlite).');
}
if (artisan('migrate --force --no-interaction') !== 0) {
    error_y_salir('No se pudieron crear o actualizar las tablas.');
}
artisan('db:seed --force --no-interaction -q');

// 7. Arranque
$url = $modo === 'produccion' && ($vars['PROD_APP_URL'] ?? '') !== '' ? $vars['PROD_APP_URL'] : 'http://'.($host === '0.0.0.0' ? '127.0.0.1' : $host).":{$puerto}";
decir();
decir("  ✔ Servicio de persistencia listo en {$url}/api");
if ($modo === 'prueba') {
    decir('    Usuarios de prueba (contraseña: cyanbox123):');
    decir('      admin@cyanbox.local · mozo@cyanbox.local · cocina@cyanbox.local · caja@cyanbox.local · recepcion@cyanbox.local');
}
if ($host === '0.0.0.0' && ($ips = direcciones_red())) {
    decir('    Dirección para tablets en la misma red Wi-Fi (app Android): '.implode(' · ', $ips));
}
decir('    Ahora iniciá el servicio cliente. Para detener este servicio: Ctrl + C');
decir();

passthru(escapeshellarg(PHP_BINARY).' artisan serve --no-reload --host='.escapeshellarg($host).' --port='.$puerto);
