# 🧠 Knowledge Item: Gestión de Ingresos y Pagos Sincronizados
**Versión Actual:** 1.9.14 | **Estado:** Estable / Optimizado

## 📌 1. Visión General
Se ha rediseñado el módulo de **Historial de Ingresos** para resolver problemas de rendimiento (carga pesada) y de integridad de datos (pagos que no se veían reflejados). La arquitectura ahora prioriza la "Verdad Real" consultando la fuente de los pagos en tiempo real en lugar de depender de columnas estáticas que podían quedar desfasadas.

---

## 🏗️ 2. Arquitectura y Sincronización
### El Problema de la "Columna Huérfana"
Anteriormente, la tabla `ingresos_mercaderia` tenía una columna `monto_pagado` que a veces no se actualizaba cuando se registraba un pago por fuera (módulo de Tesorería).

### La Solución (Query Dinámica)
Ahora, cada vez que el Historial de Ingresos pide datos (`GET /api/negocios/<id>/ingresos`), el backend realiza una sub-consulta (COALESCE/SUM) sobre la tabla **`pagos_proveedores_ingresos`**.
- **Regla de Oro:** Nunca confíes en el campo `monto_pagado` de la tabla maestra para mostrar saldos. Siempre consulta la suma de los pagos aplicados.

---

## 🚀 3. Optimización y Paginación
Para evitar que el navegador se cuelgue procesando miles de registros (módulo pesado):
1. **Server-Side Pagination:** El backend implementa `limit` y `offset`.
2. **Infinite Scroll / Load More:** El frontend carga de 50 en 50 mediante el botón de "Cargar más".
3. **Drafting:** Al filtrar por proveedor, el historial se resetea a `offset 0`.

---

## 🛡️ 4. Mecanismos de Seguridad (Borrado Seguro)
Se habilitó la función de **Eliminar Ingreso**, pero con restricciones críticas:

### Reglas de Eliminación:
- **Solo Pendientes:** No se permite borrar ingresos que tengan **pagos vinculados** (parciales o totales).
- **Control de Caja:** Si un ingreso ya movió dinero en la caja, el sistema bloquea su eliminación para evitar descuadres.
- **Reversión en Cascada:**
    - Se resta el **stock** de los productos (evita stock fantasma).
    - Se resta el total de la deuda del **saldo en cuenta corriente** del proveedor.
    - Se eliminan detalles físicos antes que la cabecera.

---

## 🎨 5. Registro de Módulos (UI De-duplication)
Para mantener el Dashboard limpio y estético:
- Se utiliza el archivo `app/static/js/modules/erp_registry.js`.
- **Eliminación de Clones:** Si varias tarjetas (`cuentas_corrientes_proveedores`, `cuentas_corrientes_clientes`) apuntan al mismo archivo físico, se les quita la propiedad `category` en el registro.
- **Resultado:** El Home solo muestra un ícono unificado ("Cuentas Corrientes"), pero el sistema mantiene los permisos internos para acceso granular.

---

## ⚠️ 6. Precauciones y Reglas de Oro
1. **No Forzar Borrados:** Si un usuario necesita borrar un ingreso que "por error" se marcó como pagado, primero debe anular el pago en Tesorería. Solo así se habilitará el botón de eliminar.
2. **Sincronización de Versión:** Cada cambio en el Registro o en el SW requiere incrementar `APP_VERSION` en `main.js` y `service-worker.js`.
3. **CONVERT TO FLOAT:** En el backend (`Python`), siempre convertir los valores de la DB a `float` antes de operar aritméticamente para evitar errores de tipo `Decimal` vs `Float`.
4. **Respetar el `negocioActivoId`:** Todas las rutas deben filtrar por ID de negocio para evitar fugas de datos entre locales del mismo dueño.

---
**Documentado por:** Antigravity (Advanced Coding Agent)
**Fecha:** 2026-04-09
