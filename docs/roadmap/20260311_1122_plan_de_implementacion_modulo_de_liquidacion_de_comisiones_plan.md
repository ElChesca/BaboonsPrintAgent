# Plan de Implementación: Módulo de Liquidación de Comisiones

Implementaremos un sistema flexible para configurar reglas de comisiones, ejecutar la liquidación para los vendedores y generar un historial de pagos, evitando la duplicación de pagos de comisiones.

## User Review Required
> [!IMPORTANT]
> Revisa especialmente la sección de la Base de Datos. He propuesto que una venta quede marcada con el ID de la Liquidación en lugar de un simple "Sí/No", para que siempre quede un comprobante de *en qué* liquidación se pagó cada venta. ¿Estás de acuerdo con esta estructura?

## Proposed Changes

### [Database Setup]
Crearemos dos tablas nuevas y modificaremos una existente.

#### [NEW] [migrations/comisiones.sql](file:///c:/Users/usuario/Documents/MultinegocioBaboons/migrations/comisiones.sql)
```sql
-- 1. Reglas de Comisión
CREATE TABLE IF NOT EXISTS comisiones_reglas (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id),
    vendedor_id INTEGER REFERENCES vendedores(id), -- Si es NULL, es la regla default del negocio
    porcentaje NUMERIC(5,2) DEFAULT 0, -- Ejemplo: 5.00 para 5%
    monto_fijo NUMERIC(10,2) DEFAULT 0, -- Por si en lugar de porcentaje se paga un fijo por pedido
    comisiona_cuenta_corriente BOOLEAN DEFAULT FALSE, -- Si ventas a crédito cuentan o no
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (negocio_id, vendedor_id) -- Solo una regla activa por vendedor o por negocio
);

-- 2. Historial de Liquidaciones
CREATE TABLE IF NOT EXISTS comisiones_liquidaciones (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id),
    vendedor_id INTEGER NOT NULL REFERENCES vendedores(id),
    fecha_desde DATE,
    fecha_hasta DATE,
    fecha_liquidacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    monto_total NUMERIC(12,2) NOT NULL,
    cantidad_operaciones INTEGER NOT NULL,
    observaciones TEXT
);

-- 3. Marcar Ventas como Liquidadas
-- Agregamos la columna para atar la venta al comprobante de liquidación
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS liquidacion_id INTEGER REFERENCES comisiones_liquidaciones(id);
```

---

### [Backend: API & Logic]

#### [NEW] [app/routes/comisiones_routes.py]
Rutas encargadas de todo el flujo de comisiones (accesibles solo por administradores).
- `GET /api/comisiones/reglas`: Obtiene las reglas del negocio.
- `POST /api/comisiones/reglas`: Guarda o actualiza una regla (negocio o vendedor específico).
- `GET /api/comisiones/previsualizar`: Recibe un `vendedor_id` y un rango de fechas. Retorna un cálculo en vivo de las ventas "no liquidadas" (`liquidacion_id IS NULL`), separando cuáles aplican y cuáles no según la regla del vendedor (o default).
- `POST /api/comisiones/liquidar`: Ejecuta la liquidación real. Crea el registro en `comisiones_liquidaciones` y hace un `UPDATE ventas SET liquidacion_id = X`.

#### [MODIFY] [app/__init__.py]
- Registrar el nuevo blueprint `comisiones_bp`.

---

### [Frontend: UI Panels]

#### [NEW] [app/static/comisiones_admin.html] y [comisiones_admin.js]
Un nuevo panel dentro del sistema central:
1.  **Pestaña Reglas**: Un formulario simple para establecer la regla genérica del negocio (% o fijo, y si incluye Cuenta Corriente). Debajo, una lista de excepciones (Vendedor X cobra 10% en vez del 5% general).
2.  **Pestaña Liquidar**:
    - Selector de Vendedor y Fechas.
    - Botón "Calcular".
    - Muestra un resumen (Ej: 15 Ventas Directas, 5 Pedidos Entregados. 2 excluidos por cuenta corriente). Monto total a pagar: `$XXX`.
    - Botón "Confirmar Liquidación".
3.  **Pestaña Historial**: Tabla mostrando las liquidaciones pasadas, para ver cuándo y cuánto se les pagó.

#### [MODIFY] [app/static/js/app.js] y/o [base.html]
- Agregar el botón de menú "Comisiones" visible para el rol Administrador.

---

## Verification Plan

### Manual Verification
1.  Crear regla default de 5% sin cuenta corriente para el Negocio A.
2.  Crear una regla de excepción de 10% para el Vendedor 1.
3.  Generar ventas reales: Una directa, un pedido entregado y cobrado, y un pedido en cuenta corriente.
4.  Ir a Previsualizar Liquidación: Confirmar que la de cuenta corriente es ignorada y las otras se calculan al 10%.
5.  Liquidar. Verificar en base de datos que `ventas.liquidacion_id` se actualizó.
6.  Volver a Previsualizar en las mismas fechas: El saldo a liquidar debe ser $0 (evitando doble liquidación).
