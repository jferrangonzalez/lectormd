<?php
declare(strict_types=1);

require_once __DIR__ . '/Database.php';

class Scanner {
    private string $docsPath;
    private SQLite3 $db;

    public function __construct() {
        $this->docsPath = DOCS_PATH;
        $this->db = Database::getInstance();
    }

    public function scan(): array {
        $added = 0;
        $proyectos = $this->getDirectories($this->docsPath);

        foreach ($proyectos as $proyectoSlug) {
            $proyectoPath = $this->docsPath . '/' . $proyectoSlug;
            $proyectoId = $this->upsertProyecto($proyectoSlug);
            $files = glob($proyectoPath . '/*.md');
            if (!$files) continue;

            foreach ($files as $file) {
                $ruta = $proyectoSlug . '/' . basename($file);
                $existe = $this->db->querySingle(
                    "SELECT id FROM documentos WHERE ruta = '" . SQLite3::escapeString($ruta) . "'"
                );
                if (!$existe) {
                    $nombre = basename($file, '.md');
                    $maxOrden = (int)$this->db->querySingle(
                        "SELECT COALESCE(MAX(orden), -1) FROM documentos WHERE proyecto_id = $proyectoId"
                    );
                    $stmt = $this->db->prepare(
                        'INSERT INTO documentos (proyecto_id, nombre, ruta, orden) VALUES (:pid, :nom, :ruta, :orden)'
                    );
                    $stmt->bindValue(':pid',   $proyectoId,      SQLITE3_INTEGER);
                    $stmt->bindValue(':nom',   $nombre,          SQLITE3_TEXT);
                    $stmt->bindValue(':ruta',  $ruta,            SQLITE3_TEXT);
                    $stmt->bindValue(':orden', $maxOrden + 1,    SQLITE3_INTEGER);
                    $stmt->execute();
                    $docId = $this->db->lastInsertRowID();
                    $this->indexarDocumento($docId, $nombre, $ruta, file_get_contents($file));
                    $added++;
                }
            }
        }

        $this->limpiarHuerfanos();
        return ['added' => $added];
    }

    private function indexarDocumento(int $docId, string $nombre, string $ruta, string $contenido): void {
        $existing = $this->db->querySingle(
            "SELECT rowid FROM busqueda_fts WHERE documento_id = $docId"
        );
        if ($existing) {
            $stmt = $this->db->prepare(
                'UPDATE busqueda_fts SET contenido=:c, nombre=:n WHERE documento_id=:id'
            );
        } else {
            $stmt = $this->db->prepare(
                'INSERT INTO busqueda_fts (contenido, nombre, ruta, documento_id) VALUES (:c, :n, :ruta, :id)'
            );
            $stmt->bindValue(':ruta', $ruta, SQLITE3_TEXT);
        }
        $stmt->bindValue(':c',   $contenido, SQLITE3_TEXT);
        $stmt->bindValue(':n',   $nombre,    SQLITE3_TEXT);
        $stmt->bindValue(':id',  $docId,     SQLITE3_INTEGER);
        $stmt->execute();
    }

    private function upsertProyecto(string $slug): int {
        $id = $this->db->querySingle(
            "SELECT id FROM proyectos WHERE slug = '" . SQLite3::escapeString($slug) . "'"
        );
        if ($id) return (int)$id;

        $nombre = ucwords(str_replace(['-', '_'], ' ', $slug));
        $stmt = $this->db->prepare('INSERT INTO proyectos (slug, nombre) VALUES (:s, :n)');
        $stmt->bindValue(':s', $slug,   SQLITE3_TEXT);
        $stmt->bindValue(':n', $nombre, SQLITE3_TEXT);
        $stmt->execute();
        return (int)$this->db->lastInsertRowID();
    }

    private function limpiarHuerfanos(): void {
        $result = $this->db->query('SELECT id, ruta FROM documentos');
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $fullPath = $this->docsPath . '/' . $row['ruta'];
            if (!file_exists($fullPath)) {
                $this->db->exec("DELETE FROM busqueda_fts WHERE documento_id = {$row['id']}");
                $this->db->exec("DELETE FROM documentos WHERE id = {$row['id']}");
            }
        }
    }

    private function getDirectories(string $path): array {
        if (!is_dir($path)) return [];
        $dirs = [];
        foreach (scandir($path) as $item) {
            if ($item === '.' || $item === '..') continue;
            if (is_dir($path . '/' . $item)) $dirs[] = $item;
        }
        return $dirs;
    }
}
