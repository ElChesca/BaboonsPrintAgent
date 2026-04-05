# Manual de Implementación y Arquitectura del Módulo CRM 🚀

Este documento detalla la estructura y las últimas optimizaciones críticas implementadas en el CRM de Baboons ERP, diseñado para manejar grandes carteras de contactos sin caída de rendimiento.

## 1. Paginación y Búsqueda (Backend-Driven)

Para evitar reventar la memoria del navegador del cliente al intentar renderizar miles de "Leads", la lista de contactos (`crm_contactos.js` y `crm_main.js`) ha abandonado el filtrado client-side.

### Nuevo Flujo `/api/crm/leads` (GET)

Ahora el endpoint acepta Query Parameters:
*   `negocio_id`: (Obligatorio) 
*   `page`: (Opcional, nativo en la iteración de la UI)
*   `limit`: (Por defecto 50 en la lista, 500 en la vista Kanban)
*   `search`: (Opcional, filtra mediante `ILIKE` en nombre, email y teléfono)
*   `estado` & `origen`: (Filtros explícitos de clasificación)

**Respuesta Pagina:**
El backend calcula internamente la franja correcta mediante `OFFSET` y `LIMIT` y devuelve el payload envuelto junto con sus KPI calculados en base de datos.
```json
{
  "data": [ { "id": 1, "nombre": "...", "estado": "nuevo" } ],
  "kpis": { "total": 1250, "reservas": 230, "excel": 1000, "nuevos": 40 },
  "page": 1,
  "pages": 25,
  "total": 1250
}
```

## 2. Motor de Importación Excel/CSV (XHR Progress Tracking)

El motor de importación múltiple de Excel ya no bloquea ciegamente la pantalla durante grandes tandas.

1.  **Backend (`importar_contactos_crm`)**: Utiliza `openpyxl` y `csv`. Evalúa fila por fila ignorando nulos, sanitizando números e insertando con control `TRY/CATCH`. Finalmente, hace un `commit()` global.
2.  **Frontend (`importarArchivo`)**: Se migró de `fetch()` a `XMLHttpRequest (XHR)` clásico.
    *   `xhr.upload.onprogress`: Permite animar fluidamente la barra de "Subiendo archivo (0-85%)".
    *   El 15% restante entra en "Modo de Procesado Shimmer", asumiendo espera transaccional en PostgreSQL.
    *   Una vez listo, inyecta la cantidad de éxitos y errores al historial y se auto-cierra tras 4 segundos.

## 3. Integración Directa con Módulo Reservas 🤝

¡El cable ya está conectado! Cada vez que un comensal programa o el Admin crea manualmente una **Reserva**, el flujo activa silenciosamente el trigger `_upsert_crm_lead` en `reservas_routes.py`.

*   **Identificación Sensible**: Utiliza el Email y el Business ID. 
*   Si el Lead existe, **no se duplica**, únicamente actualiza su `ultima_actividad` y clava un registro de "reserva" dentro del historial de la ficha (timeline).
*   Esto transforma al CRM en un gestor unificado para Marketing Retargeting y seguimiento genuino del cliente.

## 4. Notas Claves de Desarrollo

> [!WARNING]
> Mantenimiento Estilos (reservas.css / crm_styles.css).
> Ambos módulos han sido migrados a Light/Glass Theme por completo usando todo el ancho disponible. No introducir propiedades tipo `max-width: 1200px;` para preservar la UX fluida.
> Además, respetar los encoding sin BOM en Python usando las reglas establecidas para evitar desastres visuales de parseo.
