# Plan de Refactorización: API Reclamos (MuniSLService)

Basado en la nueva documentación (`API_CONSUMO.md`), se propone refactorizar el servicio `MuniSLService` para que sea más robusto, completo y alineado con los estándares del proveedor.

## User Review Required

> [!IMPORTANT]
> Revisa este plan de refactorización. ¿Deseas que implemente la descarga recursiva (paginación automática) para obtener *todos* los reclamos en una sola llamada desde el backend, o prefieres mantener el límite de 100 y manejar la paginación desde el frontend?

## Proposed Changes

---

### Módulo de Servicios

#### [MODIFY] [muni_sl_service.py](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/services/muni_sl_service.py)
- **Nuevos Endpoints (Health Check):**
  - Agregar `check_health()` para consultar `GET /api/health`.
  - Agregar `check_health_db()` para consultar `GET /api/health/db`.
- **Nuevos Endpoints (Reclamos):**
  - Agregar `get_reclamo_by_id(id)` para consultar `GET /api/v1/reclamos/:id`.
- **Refactorización de `get_reclamos`:**
  - Asegurar el tipado correcto de parámetros (`estado_id`, `pagina`, `limite`, etc.).
  - Estandarizar el manejo de errores basándonos en los códigos de estado HTTP descritos (400, 401, 404, 422, 500).
  - Devolver la `cantidad` y la `meta` (paginación) correctamente empaquetada.
- **Paginación Automática (Opcional):**
  - Crear un método auxiliar `get_all_reclamos()` que recorra todas las páginas si se solicita obtener el padrón completo sin límite de 100.

### Módulo de Rutas

#### [MODIFY] [gerencial.py](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/routes/gerencial.py)
- Refinar `api_consultar_reclamos_cav()` para que maneje elegantemente los nuevos tipos de error propagados por el servicio refactorizado (ej. 401 token expirado, 422 error de validación).

## Verification Plan

### Automated Tests
- Ejecutar un script de prueba interactivo local (ej. `verify_refactor.py`) que consuma:
  - El endpoint de health.
  - La obtención de un reclamo por ID.
  - La obtención de la lista completa (y verificación de la meta/cantidad).

### Manual Verification
- Cargar el *Tablero de Reclamos CAV* en el entorno de desarrollo y verificar que la estructura agrupada y DataTables siguen funcionando correctamente con el servicio refactorizado.
