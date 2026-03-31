# Integración de Bloqueo de CUIT con Muni Ticket

Este plan describe los pasos para implementar un mecanismo de bloqueo de CUIT en el módulo `fraudes-tramites`, permitiendo a los administradores bloquear CUITs en el sistema Muni Ticket directamente desde el panel de control.

## Cambios Propuestos

### [Sincronizador] Captura de Datos

#### [MODIFICAR] [sincronizador.py](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/local_scripts/sincronizador.py)
- Modificar la función `detectar_fraudes_libre_deuda` para extraer y guardar el `padron_municipal` de los trámites.
- Asegurar que la tabla `auditoria_fraude_tramites` incluya esta nueva columna.

### [Dashboard] Centro de Novedades y CAVs

#### [MODIFICAR] [muni_sl_service.py](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/services/muni_sl_service.py)
- Implementar un mapeo para los nombres de los CAVs:
    - 1 -> Cav Barrio Jardin San Luis
    - 2 -> Cav Tercera Rotonda
    - 3 -> Secretaria Privada

#### [MODIFICAR] [bitacora.py](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/routes/bitacora.py)
- Importar dependencias necesarias (`requests`, `muni_sl_service`).
- Actualizar `panel_novedades` para obtener datos históricos y KPIs de:
    - Tickets Agua (Muni Ticket)
    - Libre Deuda (Muni Ticket)
    - Reclamos CAV (API CAV)

#### [MODIFICAR] [novedades.html](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/templates/novedades.html)
- Reemplazar la lista de "Últimos Movimientos" por un Dashboard visual.
- Incluir gráficos de barras/líneas para la evolución de los trámites.
- Implementar tarjetas de KPIs con estética premium y micro-interacciones.

#### [MODIFICAR] [dashboard_unificado.html](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/templates/dashboard_unificado.html)
- Restaurar o ajustar la sección de novedades si es necesario para mantener la consistencia (Nota: El usuario prefiere el rediseño en la página dedicada de Herramientas).

#### [MODIFICAR] [gerencial.py](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/routes/gerencial.py)
- Actualizar `tablero_unificado` para obtener datos dinámicos de las APIs externas y servicios locales para poblar el objeto `nov`.

### [Backend] Rutas y Servicios

#### [NUEVO] [Especificación API Muni Ticket](file:///C:/Users/usuario/.gemini/antigravity/brain/9410d2c1-9924-4fa4-90fd-c0f995a37927/especificacion_api_muniticket.md)
- Documento técnico para el equipo de Muni Ticket detallando el endpoint de bloqueo.
- Requisito de **Doble Validación**: El bloqueo debe enviarse con el CUIT y el Padrón Municipal para asegurar la precisión.

#### [MODIFICAR] [gerencial.py](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/routes/gerencial.py)
- Implementar una nueva ruta `POST` `/gerencial/api/bloquear-cuit` que maneje la solicitud de bloqueo.
- Esta ruta recibirá el **CUIT y el Padrón**, los validará y llamará a la API de Muni Ticket.
- Utilizará las variables de entorno `API_CASILLA_CODE` y `API_CASILLA_TOKEN` para la autenticación con Muni Ticket.

#### [MODIFICAR] [muni_sl_service.py](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/services/muni_sl_service.py)
- Agregar un nuevo método `bloquear_cuit(cuit)` a la clase `MuniSLService`.
- **Endpoint**: `https://ticketmuni.vercel.app/api/external/cuit/block` (Propongo este endpoint como estándar para las acciones de bloqueo en Muni Ticket).

### [Frontend] Dashboard

#### [MODIFICAR] [Dashboard-planes-evacion.html](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/templates/Dashboard-planes-evacion.html)
- Agregar una nueva columna "Padrón" a la tabla de reincidentes.
- Actualizar la función `bloquearSigem(cuit, padron)` para que realice una llamada `fetch` asíncrona al nuevo endpoint `/gerencial/api/bloquear-cuit`.
- Pasar ambos parámetros (`cuit` y `padron`) en el cuerpo de la solicitud.

## Plan de Verificación

### Pruebas Automatizadas
- Crearé un script de prueba temporal (ej. `test_bloqueo_api.py`) para verificar el nuevo endpoint de Flask y su comunicación con la API de Muni Ticket.

### Verificación Manual
1. Navegar a `https://munidigitalsanluis.fly.dev/gerencial/fraudes-tramites`.
2. Hacer clic en el botón "Bloquear" para un CUIT de prueba.
3. Confirmar la acción en el modal de SweetAlert.
4. Verificar que el sistema muestre un mensaje de éxito.
5. (Si es posible) Verificar en el sistema Muni Ticket que el CUIT esté realmente bloqueado.
