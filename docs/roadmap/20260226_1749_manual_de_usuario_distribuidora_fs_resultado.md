# 📦 Manual de Usuario — Distribuidora FS
**Sistema:** MultinegocioBaboons | **Entorno:** Producción (Fly.io) | **Fecha:** 26/02/2026

> [!NOTE]
> Este documento fue generado con capturas reales del sistema en producción. Todos los módulos fueron verificados y funcionan correctamente.

---

## 1. 🏠 Home — Panel Principal de Distribuidora

![Pantalla principal de Distribuidora FS](file:///C:/Users/usuario/.gemini/antigravity/brain/2ca5b453-6c32-47ca-b1d2-1803a90efbe2/distribuidora_home_dashboard_1772138013140.png)

**Anotaciones:**
- El negocio activo se selecciona desde el selector superior izquierdo (`Distribuidora FS`)
- La barra de navegación superior muestra los **módulos exclusivos de Distribuidora**: Hoja de Ruta, Gestión de Flota, Pedidos/Preventa, Mapa Clientes
- El Home tiene **3 secciones de tarjetas** (scrollear hacia abajo para verlas todas):
  - **Operaciones de Distribución**: Hojas de Ruta, Mapa de Clientes, Ventas/Pedidos, Caja, Cartera de Clientes, Inventario, Presupuestos, Proveedores, Gastos Operativos, Ingresos de Stock, Estadísticas
  - **Historiales y Reportes**: Historial Inventario, Historial Presupuestos, Historial Ajustes, Historial Pagos Prov., Historial Ingresos Stock
  - **Administración y Reglas**: Conf. y Reglas, **Gestión Empleados**, **Gestión Vendedores**, Categorías Prod., Categorías Gastos, Listas de Precios, **Usuarios**, Unidades de Medida, Negocios

---

---

## 2. 👥 Gestión de Vendedores

**Anotaciones:**
- ABM completo de vendedores: Nombre, Empleado Vinculado, Teléfono, Email, Zona Asignada, Estado
- Vendedores registrados en Distribuidora FS: `ALEJANDRO`, `BOCA DE VENTA POTRERO DE LOS FUNES`, `EMMANUEL`, `FRANCISCO` (Inactivo), `LUCAS`, `NICOLÁS` (Inactivo)
- Cada vendedor tiene botón **Editar** para modificar sus datos
- Botón `+ Nuevo Vendedor` para agregar nuevos
- El campo **Zona Asignada** se vincula con el módulo de Zonas (ver más abajo)

> [!NOTE]
> El módulo de Gestión de Vendedores está en la sección **Administración y Reglas** del Home, al hacer scroll hacia abajo.

---

## 3. 🗺️ Hoja de Ruta

![Módulo Hoja de Ruta con listado de rutas](file:///C:/Users/usuario/.gemini/antigravity/brain/2ca5b453-6c32-47ca-b1d2-1803a90efbe2/hoja_ruta_view_initial_1772138051161.png)

**Anotaciones:**
- Muestra todas las rutas planificadas con: **Fecha, Vendedor, Clientes, Pedidos, Monto Total, Estado Pedidos y Estado de la Ruta**
- Los **estados de ruta** son: `BORRADOR` → `ACTIVA` → `FINALIZADA`
- La barra de estado de pedidos muestra el progreso de entrega (ej: `0/12` pedidos entregados)
- **3 sub-pestañas:** Hojas de Ruta | Control de Carga | Inventario Móvil
- Ejemplo de datos reales:
  - Ruta #19 (LUCAS, 26/02) — 11 clientes, 12 pedidos, $568.490 — **ACTIVA**
  - Ruta #18 (ALEJANDRO, 25/02) — 11 clientes, 13 pedidos, $288.700 — **FINALIZADA**
- Botón `+ Nueva Hoja` para crear una ruta nueva

---

## 4. 📋 Pedidos / Preventa

![Módulo Gestión de Pedidos](file:///C:/Users/usuario/.gemini/antigravity/brain/2ca5b453-6c32-47ca-b1d2-1803a90efbe2/pedidos_view_initial_1772138061280.png)

**Anotaciones:**
- Administra los pedidos captados por vendedores en la calle (preventa)
- Columnas: **Fecha, H.R. (Hoja de Ruta), Cliente, Vendedor, Total, Estado, Pagado, Medio Pago, Caja**
- El estado `PENDIENTE` indica que el pedido fue tomado pero aún no entregado/cobrado
- Se puede filtrar por **Hoja de Ruta** y por **fecha**
- Acción `Consolidado` para ver resumen consolidado de todas las rutas
- Cada pedido tiene acciones de **Detalles** y **Editar**

---

## 5. 🚛 Gestión de Flota (Logística)

![Módulo Gestión de Flota](file:///C:/Users/usuario/.gemini/antigravity/brain/2ca5b453-6c32-47ca-b1d2-1803a90efbe2/logistica_view_initial_1772138071518.png)

**Anotaciones:**
- Administra la flota de vehículos de reparto de la distribuidora
- Columnas: **Tipo, Patente/Modelo, Propiedad, Capacidad (Kg y Pallets), Estado**
- Vehículos registrados:
  - `ABC-123` — Ford 350 — 3500 Kg / 20 Pallets — **Activo**
  - `AD397AO` — Ranger — 1300 Kg / 1 Pallet — **Activo**
- Botón `+ Nuevo Vehículo` para agregar unidades

---

## 6. 🗂️ Zonas de Vendedores

**Anotaciones:**
- Se accede desde **Gestión Vendedores** en la sección Administración y Reglas
- Permite definir zonas geográficas con polígonos dibujados directamente sobre el mapa
- Cada zona tiene: Color identificador, Nombre, Descripción, Clientes Asignados, estado del Polígono
- Zona existente: `zona serranias` — B° Serranias puntanas — Polígono `✓ Definido`
- El editor de zonas permite **dibujar o editar el polígono** sobre el mapa interactivo
- Las zonas se vinculan a vendedores y aparecen visualmente en el Mapa de Clientes (checkbox "Ver Zonas de Vendedores")

---

## 7. 📍 Mapa de Clientes

![Mapa de clientes con zonas de vendedores](file:///C:/Users/usuario/.gemini/antigravity/brain/2ca5b453-6c32-47ca-b1d2-1803a90efbe2/mapa_clientes_view_1772138131621.png)

**Anotaciones:**
- Muestra el mapa de la ciudad (San Luis) con los puntos de clientes geolocalizados
- **Filtro por vendedor:** permite ver solo los clientes asignados a un vendedor específico
- **Checkbox "Ver Zonas de Vendedores":** superpone las zonas de cobertura de cada vendedor sobre el mapa
- Útil para planificación de rutas y análisis territorial

---

## 8. 👥 Cartera de Clientes

![Módulo Cartera de Clientes](file:///C:/Users/usuario/.gemini/antigravity/brain/2ca5b453-6c32-47ca-b1d2-1803a90efbe2/clientes_full_view_1772138113462.png)

**Anotaciones:**
- Lista completa de clientes con buscador y filtros
- Incluye **filtro por Zona** (implementado recientemente)
- Desde aquí se pueden ver, editar y gestionar todos los clientes de la distribuidora

---

## ✅ Estado de Verificación en Producción

| Módulo | Estado |
|--------|--------|
| Login y selección de negocio | ✅ OK |
| Home / Dashboard Distribuidora | ✅ OK — 3 secciones de tarjetas |
| Hoja de Ruta | ✅ OK — Rutas reales con vendedores y montos |
| Pedidos / Preventa | ✅ OK — Pedidos pendientes cargando |
| Gestión de Flota | ✅ OK — Ford 350 y Ranger registrados |
| Mapa de Clientes | ✅ OK — Con filtro por vendedor y zonas |
| Cartera de Clientes | ✅ OK — Con filtro por zona |
| **Gestión Vendedores** | ✅ OK — ABM con 6 vendedores registrados |
| **Zonas de Vendedores** | ✅ OK — Polígonos en mapa definidos |
| Reportes e Historiales | ✅ OK |

---

## 🎬 Grabación de la Demo

![Demo completa navegando por los módulos de Distribuidora FS](file:///C:/Users/usuario/.gemini/antigravity/brain/2ca5b453-6c32-47ca-b1d2-1803a90efbe2/distribuidora_fs_demo_1772137961677.webp)
