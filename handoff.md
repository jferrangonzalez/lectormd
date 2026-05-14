# lectormd — Handoff

## Qué es esto

Lector personal de archivos Markdown, deployado en **https://lectormd.ferranserver.es/**. Stack: React 19 + TypeScript + Vite (frontend) + PHP 8 + SQLite3 con FTS5 (backend API). Los documentos son archivos `.md` reales en el servidor; la BD SQLite guarda estado, orden y marcadores.

---

## Infraestructura

| Elemento | Valor |
|---|---|
| URL producción | https://lectormd.ferranserver.es/ |
| Servidor SSH | `ferranserver` (alias en ~/.ssh/config → 57.131.47.29) |
| Root web | `/var/www/vhosts/ferranserver.es/lectormd.ferranserver.es/` |
| Archivos MD | `/var/www/vhosts/ferranserver.es/data.ferranserver.es/httpdocs/lecturas_informes/data/docs/` |
| BD SQLite | `/var/www/vhosts/ferranserver.es/data.ferranserver.es/httpdocs/lecturas_informes/data/lecturas.db` |
| Auth usuario | `joseferran` / ver `api/index.php` → `AUTH_PASS` |
| GitHub | **Sin repo** — deploy directo por scp |
| Repo local git | `C:\www\lectormd` (inicializado, 3 commits) |

### Deploy

```bash
npm run deploy
# = tsc -b && vite build && scp dist/. ferranserver:root/ && scp api/*.php api/.htaccess ferranserver:root/api/
```

---

## Arquitectura

```
C:\www\lectormd\
├── api/
│   ├── index.php      # Entrada: define constantes, auth, enruta a Api
│   ├── Api.php        # Todas las acciones del backend
│   ├── Database.php   # Singleton SQLite3 + migraciones
│   └── Scanner.php    # Escanea DOCS_PATH y sincroniza BD
└── src/
    ├── App.tsx                    # Shell principal, estado global
    ├── api/client.ts              # Wrapper fetch con auth
    ├── types/index.ts             # Tipos TS (Documento, Proyecto, Marcador…)
    ├── context/
    │   ├── AuthContext.tsx        # Login con Basic Auth en sessionStorage
    │   └── ThemeContext.tsx       # Dark (Catppuccin Mocha) / Light (papel)
    ├── hooks/
    │   ├── useProyectos.ts        # Carga lista de proyectos
    │   └── useDocumentos.ts       # Carga docs de un proyecto (acepta _recarga: number)
    └── components/
        ├── Sidebar.tsx            # Panel izquierdo — proyectos + acciones
        ├── ListaDocumentos.tsx    # Lista docs con acciones inline
        ├── Reader.tsx             # Lector MD: react-markdown + GFM + syntax hl
        ├── Buscador.tsx           # Modal búsqueda full-text (FTS5)
        ├── PanelMarcadores.tsx    # Modal todos los marcadores
        ├── EstadoBadge.tsx        # Badge pendiente/leyendo/leido
        └── SyntaxHighlighter.tsx  # Wrapper react-syntax-highlighter
```

---

## Esquema de BD (SQLite)

```sql
proyectos   (id, slug UNIQUE, nombre, created_at)
documentos  (id, proyecto_id FK→proyectos CASCADE, nombre, ruta UNIQUE,
             estado CHECK('pendiente'|'leyendo'|'leido'), orden INT DEFAULT 0,
             created_at, updated_at)
marcadores  (id, documento_id FK→documentos CASCADE, fragmento, comentario,
             posicion, created_at)
busqueda_fts  -- FTS5 virtual: contenido, nombre, ruta UNINDEXED, documento_id UNINDEXED
              -- NO tiene FK cascade → limpiar manualmente al borrar docs/proyectos
```

**Nota crítica:** `busqueda_fts` no participa en FK CASCADE. Toda eliminación de documentos o proyectos debe ejecutar `DELETE FROM busqueda_fts WHERE documento_id IN (...)` **antes** del DELETE en documentos/proyectos. Ya está implementado en `Api.php`.

---

## API — acciones disponibles

Todas las peticiones van a `/api/?a=<accion>` (GET) o POST con JSON `{a: "accion", ...}`.

| Acción | Método | Descripción |
|---|---|---|
| `proyectos` | GET | Lista proyectos con contadores |
| `documentos` | GET | `?proyecto=slug&estado=...` — orden por `orden ASC, id ASC` si hay proyecto |
| `documento` | GET | `?id=N` — incluye `contenido` (lee el .md del disco) |
| `estado` | POST | `{id, estado}` — cicla pendiente/leyendo/leido |
| `buscar` | GET | `?q=texto` — FTS5, mínimo 2 chars, devuelve snippet con `<mark>` |
| `marcadores` | GET | `?documento_id=N` |
| `marcadores_all` | GET | Todos los marcadores con info de doc y proyecto |
| `marcador_add` | POST | `{documento_id, fragmento, posicion, comentario?}` |
| `marcador_del` | POST | `{id}` |
| `scan` | GET | Escanea DOCS_PATH, añade nuevos, limpia huérfanos |
| `proyecto_crear` | POST | `{slug, nombre}` — crea directorio + registro DB |
| `proyecto_del` | POST | `{id}` — borra directorio, FTS, cascade docs+marcadores |
| `proyecto_rename` | POST | `{id, nombre}` — solo renombra en DB, NO mueve directorio |
| `documento_del` | POST | `{id}` — borra archivo físico + FTS + DB (cascade marcadores) |
| `mover` | POST | `{id, proyecto_slug}` — mueve archivo + actualiza ruta+proyecto_id en DB+FTS |
| `orden_swap` | POST | `{id_a, id_b}` — intercambia campo `orden` entre dos docs |
| `upload` | POST | `{proyecto, nombre, contenido}` — contenido puede ser base64 |

---

## Funcionalidades implementadas

- **Proyectos (carpetas):** crear, eliminar (con archivos), listar con contadores por estado
- **Documentos:** abrir y leer MD, ciclar estado, eliminar, mover entre carpetas, reordenar (↑↓)
- **Orden:** columna `orden INT` en `documentos`; Scanner asigna `max(orden)+1` al insertar; `orden_swap` intercambia dos; la lista respeta el orden cuando no hay filtro de estado activo
- **Marcadores:** seleccionar texto en Reader → guardar fragmento; ver panel global; borrar
- **Búsqueda:** FTS5 full-text sobre contenido+nombre; debounce 300ms; snippets con `<mark>`
- **Tema:** dark Catppuccin Mocha / light papel; toggle en sidebar; persistido en localStorage
- **Tamaño de fuente:** A+/A− en Reader, clamp 12-24px, persistido en localStorage
- **Auth:** Basic Auth vía PHP sin WWW-Authenticate (no dispara popup nativo); token en sessionStorage; logout automático en 401

---

## Pendientes / ideas conocidas

- `proyecto_rename` solo cambia el nombre en DB, **no mueve el directorio ni actualiza las rutas** de los documentos. Si se necesita renombrar-slug, hay que hacerlo manualmente en el servidor.
- El bundle JS pesa ~999 KB minificado (338 KB gzip) — `react-syntax-highlighter` + `prismjs` son los culpables. Se podría hacer code-splitting lazy si el tiempo de carga se vuelve un problema.
- Sin GitHub repo: el historial vive solo en `C:\www\lectormd`. Crear repo en `jferrangonzalez` cuando convenga.
- No hay paginación en `documentos` — irrelevante con el volumen actual pero a tener en cuenta.
- El dropdown "Mover a carpeta" se cierra solo al hacer hover leave sobre la fila — mejorable con un click-outside handler si molesta.

---

## Última sesión (2026-05-14)

Se implementó desde cero (el repo no tenía git):
1. `git init` + commit inicial del estado previo
2. Backend: `orden` en BD, Scanner asigna orden al insertar, `documento_del`, `proyecto_crear`, fix `proyecto_del` (borra dir), fix `mover` (mueve archivo físico), `orden_swap`
3. Frontend: `orden` en tipos, nuevas llamadas en client, `ListaDocumentos` con ↑↓/mover/eliminar, `Sidebar` con crear/eliminar carpeta, `App.tsx` wiring completo
4. Deploy exitoso — build + scp al servidor
