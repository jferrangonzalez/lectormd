# Contribuir a lectormd

## Antes de abrir un PR

- Abrí un issue primero si el cambio es significativo (nueva feature, refactor de arquitectura). Para bugs o mejoras pequeñas podés ir directo al PR.
- Describí qué problema resuelve tu cambio y por qué es la solución correcta.

## Setup de desarrollo

```bash
git clone https://github.com/joseferran/lectormd.git
cd lectormd
npm install
cp api/.env.example api/.env
# Editá api/.env con tus rutas locales

# Terminal 1 — backend
npm run php

# Terminal 2 — frontend
npm run dev
```

## Convenciones

### Commits

Seguimos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: descripción corta en infinitivo
fix: descripción del bug corregido
docs: cambio en documentación
refactor: sin cambio de funcionalidad
chore: mantenimiento
```

### PHP

- PHP 8.0+ estricto (`declare(strict_types=1)` en todos los archivos)
- Sin dependencias externas — no se añade Composer al proyecto
- Prepared statements para todas las queries con input de usuario
- Cada acción nueva va en `Api.php` como método privado y se registra en el `match()` de `handle()`

### TypeScript / React

- Tipado estricto — no `any` salvo que sea inevitable y esté comentado
- Componentes funcionales con hooks
- Un componente por archivo
- El cliente HTTP está centralizado en `src/api/client.ts` — no hacer `fetch` directo en los componentes

## Qué contribuciones se aceptan

- Correcciones de bugs
- Mejoras de rendimiento con benchmarks que las justifiquen
- Soporte para Nginx con documentación clara
- Mejoras de accesibilidad (a11y)
- Traducciones de la interfaz (si se implementa i18n)

## Qué probablemente no se acepte

- Reemplazar SQLite por MySQL/PostgreSQL (la filosofía es cero-servidor)
- Añadir autenticación OAuth o multi-usuario (fuera del scope)
- Dependencias PHP externas vía Composer
- Reescribir el backend en otro lenguaje
