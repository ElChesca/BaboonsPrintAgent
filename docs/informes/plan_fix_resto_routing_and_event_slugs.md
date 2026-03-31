# Plan de Ruteo Resto y Slugs de Eventos (Fly.io Ready)

Este plan corrige el ruteo de negocios tipo Resto y asegura que los enlaces de eventos sean seguros y accesibles públicamente con URLs limpias.

## Cambios Realizados

### [Backend]
- **app/__init__.py**: Registro de `eventos_routes.bp` sin prefijo para permitir `/landing/slug`.
- **eventos_routes.py**: Adición manual de `/api` a las rutas de administración internas.

### [Frontend]
- **main.js**: Lógica de navegación explícita para `resto` -> `#home_resto`.
- **eventos_admin.js**: Generación de links usando `virtual_slug`.

## Verificación
- Prueba de selección de negocio "Vita" (ID 13).
- Prueba de "Copiar Link" en el módulo de eventos.
- Carga de la landing page con slug alfanumérico.
