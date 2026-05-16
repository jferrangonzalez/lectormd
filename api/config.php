<?php
declare(strict_types=1);

/**
 * Lee el archivo .env del directorio api/ y define las constantes de configuración.
 * No requiere Composer — usa parse_ini_file() nativo de PHP.
 */
(function () {
    $envFile = __DIR__ . '/.env';

    if (!file_exists($envFile)) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'ok'    => false,
            'error' => 'Archivo .env no encontrado. Copiá api/.env.example como api/.env y completá los valores.',
        ]);
        exit;
    }

    $env = parse_ini_file($envFile);

    if ($env === false) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'ok'    => false,
            'error' => 'No se pudo leer api/.env. Verificá que el formato sea correcto (CLAVE=valor, sin comillas salvo que sean necesarias).',
        ]);
        exit;
    }

    $required = ['DOCS_PATH', 'DB_PATH', 'AUTH_USER', 'AUTH_PASS'];
    $missing  = array_filter($required, fn($k) => empty($env[$k]));

    if ($missing) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'ok'    => false,
            'error' => 'Variables faltantes en .env: ' . implode(', ', $missing),
        ]);
        exit;
    }

    define('DOCS_PATH', rtrim((string)$env['DOCS_PATH'], '/\\'));
    define('DB_PATH',   (string)$env['DB_PATH']);
    define('AUTH_USER', (string)$env['AUTH_USER']);
    define('AUTH_PASS', (string)$env['AUTH_PASS']);
})();
