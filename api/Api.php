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
                'scan'            => $this->scan(),
                'proyectos'       => $this->getProyectos(),
                'documentos'      => $this->getDocumentos($params),
                'documento'       => $this->getDocumento($params),
                'estado'          => $this->setEstado($params),
                'buscar'          => $this->buscar($params),
                'marcadores'      => $this->getMarcadores($params),
                'marcador_add'    => $this->addMarcador($params),
                'marcador_del'    => $this->delMarcador($params),
                'marcadores_all'  => $this->getAllMarcadores(),
                'proyecto_rename' => $this->renameProyecto($params),
                'proyecto_del'    => $this->delProyecto($params),
                'proyecto_crear'  => $this->crearProyecto($params),
                'mover'           => $this->moverDocumento($params),
                'documento_del'   => $this->delDocumento($params),
                'orden_swap'      => $this->swapOrden($params),
                'upload'          => $this->upload($params),
                default           => throw new InvalidArgumentException("Acción desconocida: $action")
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
        $porProyecto = !empty($p['proyecto']);

        if ($porProyecto) {
            $s = SQLite3::escapeString($p['proyecto']);
            $where .= " AND p.slug = '$s'";
        }
        if (!empty($p['estado'])) {
            $s = SQLite3::escapeString($p['estado']);
            $where .= " AND d.estado = '$s'";
        }

        // Cuando se filtra por proyecto, respeta el orden manual; si no, por fecha
        $order = $porProyecto ? 'd.orden ASC, d.id ASC' : 'd.updated_at DESC';

        $result = $this->db->query("
            SELECT d.id, d.nombre, d.ruta, d.estado, d.orden, d.created_at, d.updated_at,
                   p.slug as proyecto_slug, p.nombre as proyecto_nombre
            FROM documentos d
            JOIN proyectos p ON p.id = d.proyecto_id
            WHERE $where
            ORDER BY $order
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

    private function crearProyecto(array $p): array {
        $slug   = trim($p['slug']   ?? '');
        $nombre = trim($p['nombre'] ?? '');

        if (!$slug) throw new InvalidArgumentException('slug requerido');

        $slug = trim(preg_replace('/[^a-z0-9\-_]/', '-', strtolower($slug)), '-');
        if (!$slug) throw new InvalidArgumentException('slug inválido');
        if (!$nombre) $nombre = ucwords(str_replace(['-', '_'], ' ', $slug));

        $dirPath = DOCS_PATH . '/' . $slug;
        if (!is_dir($dirPath)) mkdir($dirPath, 0755, true);

        $existing = $this->db->querySingle(
            "SELECT id FROM proyectos WHERE slug = '" . SQLite3::escapeString($slug) . "'"
        );
        if ($existing) return ['id' => (int)$existing, 'slug' => $slug, 'nombre' => $nombre, 'exists' => true];

        $stmt = $this->db->prepare('INSERT INTO proyectos (slug, nombre) VALUES (:s, :n)');
        $stmt->bindValue(':s', $slug,   SQLITE3_TEXT);
        $stmt->bindValue(':n', $nombre, SQLITE3_TEXT);
        $stmt->execute();
        return ['id' => (int)$this->db->lastInsertRowID(), 'slug' => $slug, 'nombre' => $nombre];
    }

    private function delProyecto(array $p): array {
        $id = (int)($p['id'] ?? 0);

        $slug = $this->db->querySingle("SELECT slug FROM proyectos WHERE id=$id");
        if ($slug) {
            // Limpiar FTS antes del cascade
            $this->db->exec(
                "DELETE FROM busqueda_fts WHERE documento_id IN (SELECT id FROM documentos WHERE proyecto_id=$id)"
            );
            // Borrar directorio del filesystem
            $dirPath = DOCS_PATH . '/' . $slug;
            if (is_dir($dirPath)) {
                foreach (glob($dirPath . '/*.md') ?: [] as $file) unlink($file);
                rmdir($dirPath);
            }
        }
        // CASCADE borra documentos y marcadores
        $this->db->exec("DELETE FROM proyectos WHERE id=$id");
        return ['deleted' => $id];
    }

    private function moverDocumento(array $p): array {
        $docId     = (int)($p['id'] ?? 0);
        $destSlug  = SQLite3::escapeString(trim($p['proyecto_slug'] ?? ''));

        if (!$destSlug) throw new InvalidArgumentException('proyecto_slug requerido');

        $doc = $this->db->querySingle(
            "SELECT d.ruta, d.nombre, p.slug as proyecto_slug
             FROM documentos d JOIN proyectos p ON p.id = d.proyecto_id
             WHERE d.id = $docId",
            true
        );
        if (!$doc) throw new RuntimeException('Documento no encontrado');
        if ($doc['proyecto_slug'] === $destSlug) return ['id' => $docId];

        $destProyectoId = $this->db->querySingle(
            "SELECT id FROM proyectos WHERE slug = '$destSlug'"
        );
        if (!$destProyectoId) throw new RuntimeException('Proyecto destino no encontrado');

        $oldPath  = DOCS_PATH . '/' . $doc['ruta'];
        $newRuta  = $destSlug . '/' . basename($doc['ruta']);
        $newPath  = DOCS_PATH . '/' . $newRuta;

        if (!rename($oldPath, $newPath)) throw new RuntimeException('Error al mover archivo');

        $maxOrden = (int)$this->db->querySingle(
            "SELECT COALESCE(MAX(orden), -1) FROM documentos WHERE proyecto_id = $destProyectoId"
        );

        $this->db->exec(
            "UPDATE documentos SET proyecto_id=$destProyectoId, ruta='" . SQLite3::escapeString($newRuta) .
            "', orden=" . ($maxOrden + 1) . ", updated_at=CURRENT_TIMESTAMP WHERE id=$docId"
        );
        $this->db->exec(
            "UPDATE busqueda_fts SET ruta='" . SQLite3::escapeString($newRuta) . "' WHERE documento_id=$docId"
        );

        return ['id' => $docId, 'nueva_ruta' => $newRuta];
    }

    private function delDocumento(array $p): array {
        $id = (int)($p['id'] ?? 0);

        $doc = $this->db->querySingle("SELECT ruta FROM documentos WHERE id=$id", true);
        if (!$doc) throw new RuntimeException('Documento no encontrado');

        $filePath = DOCS_PATH . '/' . $doc['ruta'];
        if (file_exists($filePath)) unlink($filePath);

        $this->db->exec("DELETE FROM busqueda_fts WHERE documento_id=$id");
        $this->db->exec("DELETE FROM documentos WHERE id=$id"); // CASCADE borra marcadores
        return ['deleted' => $id];
    }

    private function swapOrden(array $p): array {
        $idA = (int)($p['id_a'] ?? 0);
        $idB = (int)($p['id_b'] ?? 0);
        if (!$idA || !$idB) throw new InvalidArgumentException('id_a e id_b requeridos');

        $ordenA = (int)$this->db->querySingle("SELECT orden FROM documentos WHERE id=$idA");
        $ordenB = (int)$this->db->querySingle("SELECT orden FROM documentos WHERE id=$idB");

        $this->db->exec("UPDATE documentos SET orden=$ordenB WHERE id=$idA");
        $this->db->exec("UPDATE documentos SET orden=$ordenA WHERE id=$idB");

        return ['ok' => true];
    }

    private function upload(array $p): array {
        $proyecto  = trim($p['proyecto']  ?? '');
        $nombre    = trim($p['nombre']    ?? '');
        $contenido = $p['contenido']      ?? null;

        if (!$proyecto || !$nombre || $contenido === null || $contenido === '') {
            throw new InvalidArgumentException('Se requieren proyecto, nombre y contenido');
        }

        $trimmed = rtrim((string)$contenido, "=\r\n");
        if (!str_contains($contenido, "\n") && preg_match('/^[A-Za-z0-9+\/]+$/', $trimmed)) {
            $decoded = base64_decode($contenido, true);
            if ($decoded !== false && mb_check_encoding($decoded, 'UTF-8')) {
                $contenido = $decoded;
            }
        }

        $proyecto = trim(preg_replace('/[^a-z0-9\-_]/', '-', strtolower($proyecto)), '-');
        $nombre   = preg_replace('/\.md$/i', '', trim($nombre));
        $nombre   = trim(preg_replace('/[^a-z0-9\-_]/', '-', strtolower($nombre)), '-');

        if (!$proyecto || !$nombre) {
            throw new InvalidArgumentException('proyecto o nombre inválidos');
        }

        $proyectoPath = DOCS_PATH . '/' . $proyecto;
        if (!is_dir($proyectoPath)) mkdir($proyectoPath, 0755, true);

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
