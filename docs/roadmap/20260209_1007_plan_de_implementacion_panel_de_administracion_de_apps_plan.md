# Plan de Implementación - Panel de Administración de Apps

## Objetivo
Crear un panel de administración exclusivo para Superadmin que permita configurar dinámicamente qué módulos (apps) están habilitados para cada tipo de negocio (Retail, Consorcio, Rentals).

## User Review Required
> [!IMPORTANT]
> Se crearán nuevas tablas en la base de datos: `modules` y `type_permissions`.
> **Migración de Datos**: Se insertarán automáticamente todos los módulos actuales para mantener la funcionalidad existente sin interrupciones.

## Proposed Changes

### Database
#### [NEW] `modules` table
Almacena el catálogo de módulos.
- `code` (PK, VARCHAR): e.g., 'ventas'.
- `name` (VARCHAR): Nombre amigable.
- `category` (VARCHAR): 'Retail', 'Consorcio', 'Rental', 'Comun'.

#### [NEW] `type_permissions` table
Relación Tipo -> Módulo.
- `business_type` (VARCHAR): 'retail', 'consorcio', 'rentals'.
- `module_code` (FK): Referencia a `modules.code`.

#### [NEW] `migrations/01_modules_permissions.sql`
Script SQL para crear tablas y poblar datos iniciales basados en `main.js`.

### Backend
#### [NEW] `app/routes/admin_routes.py`
Endpoints protegidos (`@token_required` + check rol 'superadmin'):
- `GET /api/admin/modules`: Retorna lista de módulos.
- `GET /api/admin/permissions`: Retorna mapa `{ "retail": ["ventas", ...], ... }`.
- `POST /api/admin/permissions`: Recibe `{ "business_type": "retail", "modules": ["ventas", ...] }` y actualiza DB.

#### [MODIFY] `app/routes/negocios_routes.py` (o nuevo `config_routes.py`)
- Nuevo endpoint público (o autenticado) `GET /api/config/modules` para que el frontend obtenga el mapeo actualizado.

### Frontend
#### [NEW] `app/static/admin_apps.html`
- Botón en Dashboard o Header (solo visible para Superadmin).
- Pantalla dividida por pestañas (Tipos de Negocio).
- Lista de checkboxes con los módulos disponibles.
- Botón "Guardar Cambios".

#### [MODIFY] `app/static/js/main.js`
- **Refactorización Crítica**:
    - Eliminar la constante `APP_RUTAS`.
    - Crear `function fetchAppPermissions()`.
    - Llamar a esta función durante el inicio de sesión (`actualizarUIAutenticacion`) o selección de negocio.
    - Almacenar permisos en `appState` o `localStorage`.
    - Actualizar `loadContent` para validar acceso contra `appState.permissions` en lugar de `APP_RUTAS`.
    - **Fix Bucle Infinito**: Se implementó detección de bucles de redirección y pantala de error explícita cuando el usuario no tiene permisos suficientes.

## Verification Plan
1. **Verificar Migración**: Ejecutar SQL y comprobar contenido de tablas.
2. **Backend Test**: Probar endpoints del admin con Postman/Curl.
3. **Frontend E2E**:
   - Entrar como Superadmin.
   - Ir a `/admin_apps` (nueva URL hash).
   - Quitar permiso de "Ventas" a Retail.
   - Entrar con usuario Retail -> Verificar que no accede a Ventas.
   - Restaurar permiso.
