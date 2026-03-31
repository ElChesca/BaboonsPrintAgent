# Integración de Pedidos y Consistencia de Vendedores

Se ha resuelto la inconsistencia en el manejo de `vendedor_id` y se ha optimizado la creación de pedidos desde la Hoja de Ruta.

## Cambios Realizados

### 1. Base de Datos (Corrección de Integridad)
Se detectó que la tabla `pedidos` referenciaba a `usuarios(id)` en lugar de `vendedores(id)`, lo que causaba errores al convertir pedidos en ventas.
- **Acción Requerida**: Ejecutar el script SQL proporcionado en la consola de Neon.
- **Archivo de Referencia**: [fix_pedidos_vendedor_fk.sql](file:///C:/Users/usuario/Documents/MultinegocioBaboons/migrations/fix_pedidos_vendedor_fk.sql)

### 2. Backend (Lógica de Rutas)
- **`pedidos_routes.py`**: Se ajustó `create_pedido` para usar el `vendedor_id` del token (que ya apunta a la tabla correcta). Se eliminó la lógica que guardaba el ID de usuario como fallback, permitiendo NULL para registros hechos por administradores.
- **Transmisión de Datos**: Se aseguró que el campo `total` se calcule y persista correctamente.

### 3. Frontend (UX en Hoja de Ruta)
- **`hoja_ruta.js`**: 
    - Se añadió feedback visual en la consola para verificar qué vendedor está cargando el pedido.
    - Se incluyó el cálculo del `total` en la petición POST para asegurar consistencia inmediata en la UI.
    - El modal de pedidos ahora está plenamente integrado con el flujo de despacho.

## Instrucciones para el Usuario

> [!IMPORTANT]
> Para completar la actualización, debes ejecutar estas líneas en tu consola de Neon:
> ```sql
> ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_vendedor_id_fkey;
> ALTER TABLE pedidos ADD CONSTRAINT pedidos_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES vendedores(id);
> ```

## 4. Mejoras de Seguridad (Cierre de Sesión)
Se ha implementado un sistema robusto de gestión de sesiones para evitar que la aplicación quede abierta indefinidamente sin interactividad.
- **Cierre por Inactividad**: La sesión se cierra automáticamente tras 20 minutos sin actividad detectable (mouse, teclado, etc.).
- **Validación Proactiva**: Al cargar la aplicación, el sistema verifica si el token JWT ya ha expirado en el tiempo, forzando un logout inmediato si es necesario.
- **Feedback al Usuario**: Se añadieron notificaciones visuales claras cuando ocurre un cierre de sesión automático.

## 5. Stock Virtual y Consolidado de Faltantes
Se ha mejorado el flujo de preventa para permitir trabajar con faltantes de mercadería:
- **Stock en Negativo**: Si la opción "Permitir vender con stock negativo" está activa en Configuración, el sistema permite pasar pedidos a "PREPARADO" aunque no haya stock, dejando el saldo del producto en negativo (Promesa de Entrega).
- **Reporte de Carga Inteligente (Consolidado)**:
    - Se corrigió la lógica del **Faltante** para evitar duplicar el conteo de lo ya preparado. Ahora calcula correctamente cuánto falta conseguir basado en lo pendiente y el stock disponible.
    - Incluye columnas de **Stock Actual** y **Faltante Real**.
- **Historial de Inventario Extendido**: Se integraron los movimientos de pedidos al historial. Ahora, al marcar un pedido como "PREPARADO", verás el movimiento de **Reserva Pedido** reflejado en el historial de inventario.
- **Interfaz Profesional (UI/UX)**: El módulo de Historial ha sido rediseñado completamente con una estética "Pro":
    - **Corrección de Bug**: Se arregló el problema que mostraba las fechas como "undefined".
    - **Diseño de Cards**: Layout moderno con sombreados y organización clara de filtros.
    - **Badges de Movimiento**: Cada tipo de movimiento (Venta, Ingreso, Ajuste, Reserva) tiene su propio color e icono identificatorio.
    - **Feedback Visual**: Iconos de FontAwesome y mejores tipografías para facilitar la lectura.
- **Sincronización de Horario (Argentina)**: Se ha configurado el sistema para usar globalmente la zona horaria `America/Argentina/Buenos_Aires`. Esto afecta tanto a los registros en la base de datos como a la visualización en los dashboards.
- **Auditoría de Ajustes Manuales**: Ahora, cuando un administrador modifica el stock directamente desde la ventana de **Editar Producto**, el sistema genera automáticamente un registro de auditoría. Este registro es visible en el **Historial de Inventario** con el motivo "Edición Manual", permitiendo un seguimiento total de quién cambió qué y cuándo.
- **Unificación Vendedores/Usuarios**: Se ha eliminado la redundancia en la gestión de accesos. Al crear o editar un Vendedor, ahora puedes asignar o cambiar su contraseña directamente. El sistema se encarga de crear o actualizar automáticamente el Usuario vinculado (rol `vendedor`), manteniendo sincronizados el nombre, email y estado de activación.
- **Corrección UI (Cantidades)**: Se ensanchó el campo de "Cantidad" en el modal de Nuevo Pedido para evitar que los números se corten y mejorar la legibilidad.
- **Seguimiento de Creador de Pedidos**: Se corrigió el bug donde el vendedor aparecía como `null` en el listado cuando un administrador creaba el pedido. Ahora el sistema registra tanto al creador como al repartidor.
- **Liquidación de Reparto**: Nueva funcionalidad para cerrar el día. Al finalizar una ruta activa, el administrador puede ver un resumen de visitas, total de ventas en cuenta corriente y un listado de toda la mercadería entregada. Ahora incluye un botón de **"Imprimir"** para generar un reporte PDF profesional con el cierre del vendedor.
- **Picking List (PDF)**: Se añadió un botón en el "Consolidado de Mercadería" que genera un PDF profesional listo para imprimir, facilitando la preparación de la carga en el depósito.
- **Historial Detallado**: El historial de actividad del cliente dentro de la Hoja de Ruta ahora muestra etiquetas de color según el estado del pedido (Pendiente, Entregado, Anulado), especifica qué vendedor fue el responsable de cada operación e incluye el **Número de Hoja de Ruta (HR #)** para identificar rápidamente cada reparto.
- **Módulo de Logística y Gestión de Flota**:
    - **Panel de Flota**: Nueva sección en el menú para administrar camiones, registrando su patente, modelo y capacidades de carga (Kg y m³).
    - **Metadata de Productos**: Se agregaron campos de **Peso** y **Volumen** en el ABM de productos para permitir el cálculo automático de carga.
    - **Asignación de Vehículos**: Ahora es posible asignar un camión específico a cada Hoja de Ruta durante su creación o edición.
    - **Monitor de Carga Pro**: En el detalle de la Hoja de Ruta, se incluyeron **barras de progreso dinámicas** que muestran el porcentaje de ocupación del camión (Peso y Volumen) basado en los pedidos asignados. Incluye alertas visuales (color rojo) cuando se supera el 90% de la capacidad.

## 6. Comandos de Despliegue (Fly.io)
Para subir los cambios a los distintos entornos desde tu terminal:
- **Producción**: `fly deploy`
- **Desarrollo (Dev)**: `fly deploy --config fly.dev.toml`
