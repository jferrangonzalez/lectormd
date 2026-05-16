<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/Scanner.php';
require_once __DIR__ . '/Api.php';

header('Content-Type: application/json; charset=utf-8');

// CORS para desarrollo local (Vite en :5173 / :4173)
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = ['http://localhost:5173', 'http://localhost:4173'];
if (in_array($origin, $allowed)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Auth PHP (sin WWW-Authenticate → no dispara el popup nativo del browser) ──
function checkAuth(): bool {
    // PHP_AUTH_USER lo rellena Apache si tiene Basic Auth; sin él, leemos el header directo
    $user = $_SERVER['PHP_AUTH_USER'] ?? null;
    $pass = $_SERVER['PHP_AUTH_PW']   ?? null;

    if ($user === null) {
        // Apache puede filtrar el header; lo recuperamos del env inyectado por el RewriteRule
        $raw = $_SERVER['HTTP_AUTHORIZATION']
            ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
            ?? '';
        if (preg_match('/^Basic\s+(.+)$/i', $raw, $m)) {
            [$user, $pass] = array_pad(explode(':', base64_decode($m[1]), 2), 2, '');
        }
    }

    return $user === AUTH_USER && $pass === AUTH_PASS;
}

if (!checkAuth()) {
    http_response_code(401);
    // SIN header WWW-Authenticate: Basic → el browser no muestra diálogo nativo
    echo json_encode(['ok' => false, 'error' => 'No autorizado']);
    exit;
}
// ──────────────────────────────────────────────────────────────────────────────

$method = $_SERVER['REQUEST_METHOD'];
$params = $method === 'POST'
    ? (json_decode(file_get_contents('php://input'), true) ?? [])
    : $_GET;

$action = (string)($params['a'] ?? '');

$api = new Api();
$api->handle($method, $action, $params);
