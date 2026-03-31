# Walkthrough: Módulo de Liquidación de Comisiones

## Resumen
Implementación completa del módulo de Comisiones de Vendedores: backend (API + DB), frontend (UI), integración en Admin Apps, y corrección de bugs en producción.

---

## Cambios Implementados

### Base de Datos (`migrations/comisiones.sql`)
- Nueva tabla `comisiones_reglas` (regla global + overrides por vendedor)
- Nueva tabla `comisiones_liquidaciones` (historial de pagos)
- Columna `ventas.liquidacion_id` para marcar ventas ya liquidadas
- Columna `clientes.activo` para baja lógica de clientes (`migrations/add_activo_clientes.sql`)

### Backend (`app/routes/comisiones_routes.py`)
| Endpoint | Método | Descripción |
|---|---|---|
| `/api/negocios/<id>/comisiones/reglas` | GET / POST | CRUD de reglas |
| `/api/negocios/<id>/comisiones/previsualizar` | GET | Simulación de liquidación |
| `/api/negocios/<id>/comisiones/liquidar` | POST | Asentar liquidación |
| `/api/negocios/<id>/comisiones/historial` | GET | Liquidaciones pasadas |

### Frontend (`app/static/comisiones_admin.html` + `comisiones.js`)
- 3 tabs: **Liquidar**, **Reglas**, **Historial**
- `comisiones.js` refactorizado como ES Module exportando `inicializarComisiones()`
- Usa `fetchData`/`sendData`/`appState` del sistema estándar de la SPA

### Integración Admin + Navegación (`main.js`, `admin_routes.py`, `home_distribuidora.html`)
- `PATH_MAP`: `'comisiones' → 'static/comisiones_admin.html'`
- `PERMISSION_ALIAS`: `'comisiones_admin' → 'comisiones'` (evita denegación por mismatch filename/permiso)
- Módulo `comisiones` agregado al auto-seeding de **Distribuidora** y **Retail** en `admin_routes.py`
- Tarjeta en sección **"Administración y Reglas"** del home Distribuidora (visible solo para admins)
- Link en dropdown **"📊 Reportes"** del navbar

### Fix: Eliminar Cliente (500 → baja lógica)
`clientes_routes.py` — `DELETE` físico reemplazado por `UPDATE clientes SET activo = FALSE` para evitar FK constraints con ventas/pedidos relacionados.

---

## Evidencia Visual

![Reglas de Comisión](file:///C:/Users/usuario/.gemini/antigravity/brain/75fa1119-3c65-4296-8e92-3a42d3945336/commissions_reglas_view.png)

![Verificación UI Comisiones](file:///C:/Users/usuario/.gemini/antigravity/brain/75fa1119-3c65-4296-8e92-3a42d3945336/verify_commissions_ui_1773241049979.webp)

---

## Estado Final
- ✅ Módulo accesible en producción (`multinegocio.baboons.com.ar`)
- ✅ Tablas creadas en Neon
- ✅ Permisos seeded para Distribuidora y Retail
- ✅ Baja lógica de clientes funcionando
- ✅ Sin errores 404 ni 500 conocidos
