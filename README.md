# lectormd

Lector de Markdown personal y autoalojado. Organizá tus notas, libros y documentos en proyectos, marcá tu progreso de lectura, guardá fragmentos y buscá en todo el texto completo.

![screenshot](docs/screenshot.png)

## Características

- **Proyectos** — carpetas de documentos `.md` organizadas en proyectos
- **Estados de lectura** — pendiente, leyendo, leído
- **Marcadores** — guardá fragmentos con comentario y posición
- **Búsqueda FTS** — texto completo con SQLite5 FTS5, resultados con snippet resaltado
- **Tema claro / oscuro** — persiste en localStorage
- **Responsive** — navegación adaptada a móvil con stack panel
- **Upload** — subí archivos `.md` directamente desde la interfaz
- **Orden manual** — reorganizá documentos dentro de un proyecto por drag & drop

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Backend | PHP 8.0+ (sin framework) |
| Base de datos | SQLite3 + FTS5 (nativo, sin servidor) |
| Servidor web | Apache (con `mod_rewrite`) o Nginx |
| Render MD | react-markdown + remark-gfm + Prism (lazy) |

## Requisitos

- **PHP 8.0+** con extensiones `sqlite3`, `json`, `mbstring`
- **Apache** con `mod_rewrite` habilitado (o Nginx con configuración equivalente)
- **Node.js 18+** y npm (solo para compilar el frontend)

## Instalación

### 1. Cloná el repositorio

```bash
git clone https://github.com/joseferran/lectormd.git
cd lectormd
```

### 2. Instalá dependencias del frontend

```bash
npm install
```

### 3. Configurá el backend

```bash
cp api/.env.example api/.env
```

Editá `api/.env` con tus valores:

```ini
# Ruta absoluta al directorio de documentos
DOCS_PATH=/home/usuario/mis-documentos

# Ruta absoluta a la base de datos SQLite (se crea automáticamente)
DB_PATH=/home/usuario/mis-documentos/lecturas.db

# Credenciales de acceso
AUTH_USER=mi-usuario
AUTH_PASS=mi-contraseña-segura
```

### 4. Creá la estructura de documentos

```
mis-documentos/
├── proyecto-uno/
│   ├── documento-a.md
│   └── documento-b.md
└── proyecto-dos/
    └── notas.md
```

Los proyectos son subdirectorios. Los documentos son archivos `.md` dentro de cada subdirectorio.

### 5. Compilá el frontend

```bash
npm run build
```

### 6. Configurá el servidor web

**Apache** — apuntá el DocumentRoot al directorio del proyecto. El `api/.htaccess` ya está incluido.

**Nginx** — ejemplo de configuración:

```nginx
server {
    listen 80;
    server_name lectormd.local;
    root /ruta/al/proyecto;
    index index.html;

    location /api/ {
        try_files $uri $uri/ /api/index.php?$query_string;
        location ~ \.php$ {
            include fastcgi_params;
            fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
            fastcgi_pass unix:/run/php/php8.1-fpm.sock;
        }
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 7. Sincronizá los documentos

Una vez que el servidor esté corriendo, accedé a la interfaz e iniciá sesión. Hacé clic en **Escanear** para que el backend indexe todos los archivos `.md` del directorio de documentos.

## Desarrollo local

Para desarrollar necesitás el backend PHP corriendo en local y el servidor de desarrollo de Vite.

**Terminal 1 — backend PHP:**

```bash
npm run php
# equivale a: php -S localhost:8080 -t api/
```

**Terminal 2 — frontend Vite:**

```bash
npm run dev
```

El frontend en `:5173` proxea las llamadas a `/api/` hacia `localhost:8080`.

Para cambiar el target del proxy (ej. si usás XAMPP o Laragon):

```bash
# .env.local
VITE_API_TARGET=http://localhost/lectormd/api
```

## Estructura del proyecto

```
lectormd/
├── api/
│   ├── .env.example     # plantilla de configuración
│   ├── .env             # tu configuración (NO versionar)
│   ├── .htaccess        # rewrite rules para Apache
│   ├── config.php       # lee .env y define constantes
│   ├── index.php        # entry point: auth + routing
│   ├── Api.php          # controlador de acciones
│   ├── Database.php     # singleton SQLite + migraciones
│   └── Scanner.php      # escanea docs/ y sincroniza DB
├── src/
│   ├── api/client.ts    # cliente HTTP tipado
│   ├── components/      # componentes React
│   ├── context/         # AuthContext, ThemeContext
│   ├── hooks/           # useProyectos, useDocumentos, useIsMobile
│   └── types/index.ts   # tipos compartidos
├── data/                # tu directorio de documentos (NO versionar)
├── dist/                # build del frontend (generado)
└── public/
    └── .htaccess        # rewrite para SPA en Apache
```

## Seguridad

- La autenticación es Basic Auth implementada en PHP. Las credenciales se guardan en `api/.env` que **nunca debe versionarse**.
- El token se guarda en `sessionStorage` del navegador (se borra al cerrar la pestaña).
- lectormd está diseñado para uso personal o de equipo pequeño en un servidor bajo tu control. No es un servicio multi-tenant.

## Issues conocidos

- `proyecto_rename` cambia solo el nombre visible, no el slug del directorio en el filesystem. Si necesitás cambiar el directorio, hacelo manualmente y ejecutá **Escanear**.
- No hay paginación en la lista de documentos.

## Licencia

MIT — ver [LICENSE](LICENSE).
