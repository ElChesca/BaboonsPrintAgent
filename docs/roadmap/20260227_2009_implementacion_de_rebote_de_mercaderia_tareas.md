# Implementación de Rebote de Mercadería

## 1. Base de Datos
- [x] Crear tabla `motivos_rebote` (id, negocio_id, descripcion, activo).
- [x] Crear tabla `pedidos_rebotes` (id, negocio_id, pedido_id, hoja_ruta_id, producto_id, cantidad, motivo_rebote_id, fecha).
- [x] Insertar motivos por defecto (ej: "Local Cerrado", "Falta de Dinero", "Mercadería Dañada", "Error de Carga", "Rechazo del Cliente", "Otro").

## 2. API Backend (Rutas)
- [x] Crear endpoint `GET /api/negocios/<id>/motivos_rebote` para listar motivos.
- [x] Modificar `PUT /pedidos/<id>/estado` (o crear nuevo endpoint `POST /pedidos/<id>/entrega_parcial`) para procesar el rechazo:
  - Validar cantidades enviadas vs originales.
  - Insertar registros en `pedidos_rebotes` con los `motivos_id`.
  - Actualizar `pedidos_detalle` con la nueva cantidad entregada (opcionalmente guardar la "cantidad original").
  - Modificar el total del pedido (`pedidos.total`) en base a las nuevas cantidades.
- [x] Modificar `PUT /hoja_ruta/<id>/estado` (al Finalizar la Liquidación):
  - Consultar todos los `pedidos_rebotes` de esta HR.
  - Generar el movimiento de ajuste de stock (Ej: "Ajuste por Rebote en Calle - HR X").
  - Sumar el `stock_actual` de cada producto en la tabla `productos` y vaciar/bajar del `vh.stock` (si existe control físico en el sistema).

## 3. Frontend (Modo Repartidor - Entrega)
- [x] En `/static/hoja_ruta.html` (Modal Confirmar Entrega):
  - Cambiar la tabla readonly a inputs numéricos `max="cant_original"` para modificar lo entregado.
  - Agregar cálculo dinámico del nuevo "Total a Cobrar" a medida que se bajan las cantidades.
  - Si una cantidad es menor al original, mostrar obligatoriamente un `<select>` de `motivos_rebote` por debajo o al lado del input.
- [x] En `/static/js/modules/hoja_ruta.js` (o en `seller.js` según refactor):
  - Fetch de motivos al abrir el modal / cargar modulo.
  - Función de confirmación modificada para agrupar el payload incluyendo los `motivos_ajustados`.

## 4. Frontend (Modal Liquidación HR)
- [x] En Modal Liquidación:
  - Crear pestaña o sección "Resumen de Rebotes" que alerte al cajero/admin lo que vuelve en el camión.
  - Mostrar tabla con producto, cantidad devuelta, y motivo agrupada por HR.
# Sistema de Eventos y Pagos Online

## 5. Diseño y Estructura
- [x] Diseñar esquema de base de datos (`eventos`, `inscripciones`).
- [x] Crear plan de implementación.

## 6. Backend (Pagos, API y Notificaciones)
- [x] Extender `MercadoPagoService` con `create_preference` (Checkout Pro).
- [x] Crear endpoints para inscripción pública y gestión admin.
- [x] Lógica de control de cupos atómica.
- [x] Implementar generación de código QR (QR) tras pago confirmado.
- [x] Configurar permisos en backend para 'eventos'

## Depuración de Pedidos y PWA
- [x] Corregir error 404 en búsqueda de productos (Editar Pedidos)
- [x] Implementar ruta de compatibilidad en backend `/api/productos`
- [x] Actualizar `pedidos.js` para usar endpoint estándar de búsqueda
- [x] Fix CORS Leaflet en Service Worker (Versión 1.4.3)
- [/] Investigar bloqueo "Cargando eventos..."

## 7. Frontend (Landing y Operador)
- [x] Crear template HTML/JS para la Landing Page pública.
- [x] Integrar botón de pago de Mercado Pago.
- [x] Crear interfaz de "Operador de Asistencia" con escáner de QR.
- [x] Panel de administración para ver inscritos y estadísticas del evento.

## 8. Dashboard y Distribuidora
- [x] Verificar KPIs del Dashboard de Distribuidora (v1.4.3).
- [x] Fix: Estado 'en_camino' incluido en conteo de pedidos pendientes.
- [x] Rediseño creativo: Reemplazar 'Últimas HR' por Panel de Inteligencia Operativa (Gráficos).
- [x] Implementar Auto-scroll en Modo Repartidor al primer pedido pendiente
- [x] Implementar soporte para Pago Mixto (Efectivo + MP) en entrega
    - [x] Modificar UI en `hoja_ruta.html`
    - [x] Agregar lógica de cálculo y envío en `logistica.js`
    - [x] Adaptar backend `distribucion_routes.py` para procesar múltiples cobros
- [x] Actualizar Entorno de Desarrollo (`multinegociobaboons-dev`)
    - [x] Modificar `app/database.py` para soportar `APP_ENV` y `SQLITE_DB_PATH`
    - [x] Preparar `fly.dev.toml` o ajustar comando de despliegue
    - [x] Ejecutar despliegue y verificar persistencia
