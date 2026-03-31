# Tareas - Módulo de Alquiler (Rental)

- [ ] Contenedores
    - [x] Exploración inicial del código y estado actual <!-- id: 0 -->
    - [x] Configuración de conexión a Base de Datos (Neon) <!-- id: 5 -->
    - [x] Identificar funcionalidades faltantes o rotas <!-- id: 1 -->
    - [x] Corregir errores existentes <!-- id: 2 -->
    - [x] Implementar funcionalidades faltantes (Backend) <!-- id: 3 -->
    - [x] Implementar funcionalidades faltantes (Frontend) <!-- id: 6 -->
    - [x] Depuración de errores en producción (401 Loop / TypeError / Acceso Denegado) <!-- id: 7 -->
    - [x] Corrección de ruta 404 en módulo Rental <!-- id: 8 -->
    - [x] Corrección de estilos Modal Contratos (z-index / overflow) <!-- id: 9 -->
    - [x] Corrección de Menú Navegación <!-- id: 10 -->
    - [/] Verificación final <!-- id: 4 -->

# Tareas - Administración de Apps (Panel Superadmin)
- [ ] Diseño y Base de Datos
    - [x] Definir esquema para Apps y Permisos (Tabla `modules` y `business_type_modules`) <!-- id: 11 -->
    - [x] Migración de base de datos (Script Python) <!-- id: 12 -->
- [ ] Backend
    - [x] Endpoint para listar/crear/editar módulos (Apps) <!-- id: 13 -->
    - [x] Endpoint para obtener configuración de módulos por tipo de negocio <!-- id: 14 -->
    - [x] Actualizar endpoint `login`/`negocios` para devolver permisos dinámicos <!-- id: 15 -->
- [ ] Frontend
    - [x] Crear página `admin_apps.html` (Gestión de Apps y Permisos) <!-- id: 16 -->
    - [x] Lógica para ABM de permisos en `admin_apps.js` <!-- id: 17 -->
    - [x] Refactorizar `main.js` para usar permisos dinámicos (reemplazar `APP_RUTAS` hardcodeado) <!-- id: 18 -->
    - [x] Agregar acceso en menú principal (Solo Superadmin) <!-- id: 19 -->

# Depuración Post-Despliegue
- [x] Corregir rutas 404 en Rentals (Conflicto de prefijos Blueprint)
- [x] Corregir Race Condition en Rentals JS (`TypeError: null innerHTML`)
- [x] Corregir SyntaxError en Rentals JS (Código huérfano/Bloque mal cerrado)
- [x] Validar funcionamiento Panel Admin en producción
- [x] Ejecutar script SQL corrección permisos en Neon (Usuario)
- [x] Corregir Bucle Infinito / Parpadeo en Login (Anti-Loop Check + Fix Redirección + Safety Net)
- [x] Implementar Pantalla de Error Detallada (Debug Mode)
- [x] Diagnosticar y Corregir 500 en /api/negocios (Falta columna logo_url)
- [x] Forzar actualización de cache (Versionado main.js)
- [x] Eliminar Service Worker persistente (Script Exterminador)
- [x] Corrección Crítica: Promover usuario 'admin' a Rol Superadmin
- [x] Corrección Crítica: Verificar/Restaurar Tabla Permisos en DB
- [x] Corrección de Freeze al hacer Logout (Pantalla blanca)
- [x] Verificar visibilidad de todos los negocios (Requiere re-login)
- [x] Corregir inicialización de Admin Apps en main.js
- [x] Corregir TypeError en Rentals JS
- [x] Crear CSS faltantes para Admin Apps y Configuración
- [x] Implementar Dashboard Dinámico en Rentals (Habilitar apps extra)
- [x] Agregar Iconos Reales al Dashboard de Rentals
