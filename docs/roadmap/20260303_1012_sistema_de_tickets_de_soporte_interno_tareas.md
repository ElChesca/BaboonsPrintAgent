# Sistema de Tickets de Soporte Interno

## Planning
- [x] Explorar estructura del proyecto
- [x] Entender sistema de módulos (modules/type_permissions)
- [x] Entender sistema de routing en main.js
- [x] Escribir implementation plan y task.md
- [x] Presentar plan al usuario para aprobación

## Base de Datos (Scripts para NEON)
- [x] Tabla `tickets`
- [x] Tabla `ticket_comentarios`
- [x] Tabla `ticket_configuracion_alertas`
- [x] Registrar módulo `tickets` en tabla `modules`
- [x] Agregar `tickets` a permisos de todos los tipos de negocio

## Backend
- [x] Crear `app/routes/tickets_routes.py`
- [x] Registrar blueprint en `app/__init__.py`
- [x] Endpoints CRUD (GET, POST, PUT, DELETE)
- [x] Endpoint comentarios
- [x] Endpoint cambio de estado con check SLA
- [x] Endpoint configuración de alertas (emails)
- [x] Lógica de envío de correo (alertas SLA + notificación nuevo ticket)
- [x] Scheduler APScheduler para chequeo periódico de SLA

## Frontend - HTML
- [x] Crear `app/static/tickets.html`

## Frontend - JS
- [x] Crear `app/static/js/modules/tickets.js`
- [x] Registrar en `main.js` (switch case + import)

## Frontend - CSS
- [x] Crear `app/static/css/tickets.css`

## Integración Admin Apps
- [x] Agregar módulo `tickets` al catálogo auto-seed en `admin_routes.py`

## Verificación
- [ ] Probar creación de ticket
- [ ] Probar cambio de estado y comentarios
- [ ] Probar alertas SLA
- [ ] Verificar visibilidad en App Admin
