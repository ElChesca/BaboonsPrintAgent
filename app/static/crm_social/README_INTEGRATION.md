# Plan de Implementación: CRM Premium Interconectado

Este documento detalla la arquitectura de integración aplicada para convertir el módulo CRM Meta en el "Cerebro Comercial" del ERP Baboons.

## 1. Centralización de Archivos
- **Ubicación**: `app/static/crm_social/`
- **Componentes**: `crm_meta.html` y lógica asociada.
- **Regla establecida**: Todo desarrollo CRM debe ocurrir en esta carpeta.

## 2. Estrategia de Interconexión (360° View)
Para lograr una experiencia fluida, se implementó un sistema de "Pasaje de Contexto" vía `sessionStorage`.

### Flujo de Datos:
1.  **CRM -> Módulos**: Al accionar un botón premium (Reserva/Venta), el CRM inyecta un objeto `temp_lead_*` en el almacenamiento de sesión.
2.  **Módulos -> CRM**: Al cargar (init), los módulos de Reservas, Ventas y Presupuestos verifican si existe un lead pendiente y auto-completan sus formularios.

### Vinculación por Teléfono:
Se utiliza el número de teléfono como clave de cruce (Foreign Key lógica) para mostrar el historial de ventas y presupuestos sin necesidad de que el lead esté previamente dado de alta como cliente formal.

## 3. Endpoints de Consolidación
- `GET /api/negocios/<id>/crm/lead-historial/<lead_id>`: Agrega datos de 3 tablas (reservas, ventas, presupuestos) en una sola respuesta JSON.

## 4. Próximos Pasos Sugeridos
- Implementar notificaciones push cuando un lead pasa a estado "Venta Cerrada".
- Agregar widget de "Productos más consultados" en el sidebar del chat.
