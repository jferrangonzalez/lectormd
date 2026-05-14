<?php
declare(strict_types=1);

require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/Scanner.php';

class Api {
    private SQLite3 $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    public function handle(string $method, string $action, array $params): void {
        header('Content-Type: application/json; charset=utf-8');

        try {
            $result = match($action) {
                'scan'           => $this->scan(),
                'proyectos'      => $this->getProyectos(),
                'documentos'     => $this->getDocumentos($params),
                'documento'      => $this->getDocumento($params),
                'estado'         => $this->setEstado($params),
                'buscar'         => $this->buscar($params),
                'marcadores'     => $this->getMarcadores($params),
                'marcador_add'   => $this->addMarcador($params),
                'marcador_del'   => $this->delMarcador($params),
                'marcadores_all' => $this->getAllMarcadores(),
                'proyecto_rename'=> $this->renameProyecto($params),
                'proyecto_del'   => $this->delProyecto($params),
                'mover'          => $this->moverDocumento($params),
                'upload'         => $this->upload($params),
                default          => throw new InvalidArgumentException("Acción desconocida: $action")
            };
            echo json_encode(['ok' => true, 'data' => $result]);
        } catch (Throwable $e) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
        }
    }

    private function scan(): array {
        return (new Scanner())->scan();
    }

    private function getProyectos(): array {
        $result = $this->db->query('
            SELECT p.id, p.slug, p.nombre,
                COUNT(d.id) as total,
                SUM(CASE WHEN d.estado="pendiente" THEN 1 ELSE 0 END) as pendientes,
                SUM(CASE WHEN d.estado="leyendo"   THEN 1 ELSE 0 END) as leyendo,
                SUM(CASE WHEN d.estado="leido"     THEN 1 ELSE 0 END) as leidos
            FROM proyectos p
            LEFT JOIN documentos d ON d.proyecto_id = p.id
            GROUP BY p.id
            ORDER BY p.nombre
        ');
        $rows = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
        return $rows;
    }

    private function getDocumentos(array $p): array {
        $where = '1=1';
        if (!empty($p['proyecto'])) {
            $s = SQLite3::escapeString($p['proyecto']);
            $where .= " AND p.slug = '$s'";
        }
        if (!empty($p['estado'])) {
            $s = SQLite3::escapeString($p['estado']);
            $where .= " AND d.estado = '$s'";
        }
        $result = $this->db->query("
            SELECT d.id, d.nombre, d.ruta, d.estado, d.created_at, d.updated_at,
                   p.slug as proyecto_slug, p.nombre as proyecto_nombre
            FROM documentos d
            JOIN proyectos p ON p.id = d.proyecto_id
            WHERE $where
            ORDER BY d.updated_at DESC
        ");
        $rows = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
        return $rows;
    }

    private function getDocumento(array $p): array {
        $id = (int)($p['id'] ?? 0);
        $row = $this->db->querySingle(
            "SELECT d.*, p.slug as proyecto_slug FROM documentos d
             JOIN proyectos p ON p.id = d.proyecto_id WHERE d.id = $id",
            true
        );
        if (!$row) throw new RuntimeException('Documento no encontrado');

        $filePath = DOCS_PATH . '/' . $row['ruta'];
        $row['contenido'] = file_exists($filePath) ? file_get_contents($filePath) : '';
        return $row;
    }

    private function setEstado(array $p): array {
        $id     = (int)($p['id'] ?? 0);
        $estado = SQLite3::escapeString($p['estado'] ?? '');
        if (!in_array($estado, ['pendiente', 'leyendo', 'leido'])) {
            throw new InvalidArgumentException('Estado inválido');
        }
        $this->db->exec("UPDATE documentos SET estado='$estado', updated_at=CURRENT_TIMESTAMP WHERE id=$id");
        return ['id' => $id, 'estado' => $estado];
    }

    private function buscar(array $p): array {
        $q = trim($p['q'] ?? '');
        if (strlen($q) < 2) return [];

        $qFts = SQLite3::escapeString('"' . str_replace('"', '', $q) . '"*');

        $result = $this->db->query("
            SELECT f.documento_id, f.nombre, f.ruta,
                   snippet(busqueda_fts, 0, '<mark>', '</mark>', '...', 32) as fragmento,
                   d.estado, p.slug as proyecto_slug, p.nombre as proyecto_nombre
            FROM busqueda_fts f
            JOIN documentos d ON d.id = f.documento_id
            JOIN proyectos p ON p.id = d.proyecto_id
            WHERE busqueda_fts MATCH '$qFts'
            ORDER BY rank
            LIMIT 30
        ");

        $rows = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
        return $rows;
    }

    private function getMarcadores(array $p): array {
        $docId = (int)($p['documento_id'] ?? 0);
        $result = $this->db->query(
            "SELECT * FROM marcadores WHERE documento_id=$docId ORDER BY posicion"
        );
        $rows = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
        return $rows;
    }

    private function getAllMarcadores(): array {
        $result = $this->db->query("
            SELECT m.*, d.nombre as doc_nombre, d.ruta as doc_ruta, p.slug as proyecto_slug
            FROM marcadores m
            JOIN documentos d ON d.id = m.documento_id
            JOIN proyectos p ON p.id = d.proyecto_id
            ORDER BY m.created_at DESC
        ");
        $rows = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
        return $rows;
    }

    private function addMarcador(array $p): array {
        $docId      = (int)($p['documento_id'] ?? 0);
        $fragmento  = $p['fragmento'] ?? '';
        $comentario = $p['comentario'] ?? null;
        $posicion   = (int)($p['posicion'] ?? 0);

        if (!$fragmento) throw new InvalidArgumentException('Fragmento vacío');

        $stmt = $this->db->prepare(
            'INSERT INTO marcadores (documento_id, fragmento, comentario, posicion)
             VALUES (:did, :frag, :com, :pos)'
        );
        $stmt->bindValue(':did',  $docId,      SQLITE3_INTEGER);
        $stmt->bindValue(':frag', $fragmento,  SQLITE3_TEXT);
        $stmt->bindValue(':com',  $comentario, SQLITE3_TEXT);
        $stmt->bindValue(':pos',  $posicion,   SQLITE3_INTEGER);
        $stmt->execute();
        return ['id' => (int)$this->db->lastInsertRowID()];
    }

    private function delMarcador(array $p): array {
        $id = (int)($p['id'] ?? 0);
        $this->db->exec("DELETE FROM marcadores WHERE id=$id");
        return ['deleted' => $id];
    }

    private function renameProyecto(array $p): array {
        $id     = (int)($p['id'] ?? 0);
        $nombre = SQLite3::escapeString($p['nombre'] ?? '');
        if (!$nombre) throw new InvalidArgumentException('Nombre vacío');
        $this->db->exec("UPDATE proyectos SET nombre='$nombre' WHERE id=$id");
        return ['id' => $id, 'nombre' => $nombre];
    }

    private function delProyecto(array $p): array {
        $id = (int)($p['id'] ?? 0);
        $this->db->exec("DELETE FROM proyectos WHERE id=$id");
        return ['deleted' => $id];
    }

    private function moverDocumento(array $p): array {
        $docId      = (int)($p['id'] ?? 0);
        $proyectoId = (int)($p['proyecto_id'] ?? 0);
        $this->db->exec(
            "UPDATE documentos SET proyecto_id=$proyectoId, updated_at=CURRENT_TIMESTAMP WHERE id=$docId"
        );
        return ['id' => $docId, 'proyecto_id' => $proyectoId];
    }

    private function upload(array $p): array {
        $proyecto  = trim($p['proyecto']  ?? '');
        $nombre    = trim($p['nombre']    ?? '');
        $contenido = $p['contenido']      ?? null;

        if (!$proyecto || !$nombre || $contenido === null || $contenido === '') {
            throw new InvalidArgumentException('Se requieren proyecto, nombre y contenido');
        }

        // Si el contenido viaja en base64 (sin saltos de línea, solo chars base64), decodificar
        $trimmed = rtrim((string)$contenido, "=\r\n");
        if (!str_contains($contenido, "\n") && preg_match('/^[A-Za-z0-9+\/]+$/', $trimmed)) {
            $decoded = base64_decode($contenido, true);
            if ($decoded !== false && mb_check_encoding($decoded, 'UTF-8')) {
                $contenido = $decoded;
            }
        }

        $proyecto = trim(preg_replace('/[^a-z0-9\-_]/', '-', strtolower($proyecto)), '-');
        // Quitar extensión .md si viene en el nombre antes de sanitizar
        $nombre   = preg_replace('/\.md$/i', '', trim($nombre));
        $nombre   = trim(preg_replace('/[^a-z0-9\-_]/', '-', strtolower($nombre)), '-');

        if (!$proyecto || !$nombre) {
            throw new InvalidArgumentException('proyecto o nombre inválidos');
        }

        $proyectoPath = DOCS_PATH . '/' . $proyecto;
        if (!is_dir($proyectoPath)) {
            mkdir($proyectoPath, 0755, true);
        }

        file_put_contents($proyectoPath . '/' . $nombre . '.md', $contenido);
        (new Scanner())->scan();

        $ruta = $proyecto . '/' . $nombre . '.md';
        $row  = $this->db->querySingle(
            "SELECT d.*, p.slug as proyecto_slug FROM documentos d
             JOIN proyectos p ON p.id = d.proyecto_id
             WHERE d.ruta = '" . SQLite3::escapeString($ruta) . "'",
            true
        );
        return $row ?: ['ruta' => $ruta, 'proyecto' => $proyecto, 'nombre' => $nombre];
    }
}
