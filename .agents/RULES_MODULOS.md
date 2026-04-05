# 📜 REGLA DE ORO: Creación de Módulos Baboons

Esta normativa es **OBLIGATORIA** para cualquier Agente IA que trabaje en este repositorio. Su objetivo es mantener la arquitectura dinámica del ERP y evitar módulos "invisibles".

## 🛠 Protocolo de Registro (3 Pasos Críticos)

Cada vez que se cree un nuevo módulo o funcionalidad (ej. `gestion_repartos`), se DEBEN seguir estos pasos en orden:

### 1. Registro en Backend (Persistencia y Permisos)
- **Archivo**: `app/routes/admin_routes.py`
- **Acción**: Agregar el módulo a la lista `erp_catalogue` dentro de `_ensure_modules_seeded`.
- **Formato**: `('codigo_modulo', 'Nombre Legible', 'Categoría', ['tipo_negocio1', 'tipo_negocio2'])`
- **Categorías Backend**: `Administración`, `Ventas`, `Compras`, `Inventario`, `Tesorería`, `Logística`, `Gestión Restó`, `Gestión Especial`.
- **IMPORTANTE**: Al final del cambio, setear `_modules_seeded = False` temporalmente para forzar a que el sistema procese los nuevos permisos en la base de datos al siguiente request.

### 2. Registro en Frontend (Metadatos Visuales)
- **Archivo**: `app/static/js/modules/erp_registry.js`
- **Acción**: Agregar el código del módulo como llave en el objeto `ERP_REGISTRY`.
- **Campos**:
    - `label`: Nombre que verá el usuario.
    - `icon`: Ruta al icono (ej. `static/img/icons/ventas.png`).
    - `path`: Ruta al archivo HTML/Vista (ej. `static/mi_modulo.html`).
    - `category`: Debe ser uno de: `operaciones`, `administrativo`, `reportes`, `reglas`.

### 3. Validación de Visibilidad (Estructura HTML)
- **Archivo**: `app/static/home_[tipo].html`
- **Acción**: Asegurar que el contenedor `app-grid` con el `data-category` correspondiente existe.
- **Protocolo de Fallback**: El motor en `main.js` mostrará el módulo si el usuario tiene permiso Y está registrado en el frontend. Si tiene permiso pero NO está registrado, se debe mostrar una tarjeta de alerta genérica o realizar el registro faltante.

---

## 🚫 Prohibiciones
- **NO hardcodear** tarjetas HTML (`app-card`) directamente en los archivos `.html`.
- **NO crear** permisos manualmente en la base de datos sin registrarlos en `admin_routes.py`.
- **NO omitir** el incremento de versión en `main.js` (APP_VERSION) si se cambia la estructura del registro.

---
> [!TIP]
> Si el módulo es de "Administrador solamente", asegúrate de que el contenedor en el HTML tenga la clase `admin-only`.

## 💅 Protección de Estilos y UX (Crítico)
- **NO TOCAR el CSS Global (`global.css`)** sin aprobación del usuario. 
- **Mantener el "Light Mode"**: No aplicar gradientes oscuros, glassmorphism o efectos visuales que degraden la legibilidad del ERP.
- **Respetar Layouts**: Los encabezados, barras de navegación y el módulo `admin_apps.html` deben conservar su estructura visual actual. No rediseñar componentes que ya funcionan y son legibles.
- **Consistencia**: Al crear un nuevo módulo, debe clonar la estética de los módulos estabilizados (ej: `orden_compra` o `inventario`), usando las mismas clases de borde, sombreado y tipografía.
