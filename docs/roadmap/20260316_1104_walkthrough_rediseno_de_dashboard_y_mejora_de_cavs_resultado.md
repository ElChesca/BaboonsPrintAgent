# Walkthrough: Rediseño de Dashboard y Mejora de CAVs

Se han implementado mejoras significativas en el **Tablero de Comando Unificado** para convertir el antiguo "Centro de Novedades" en un panel dinámico y se ha actualizado la identidad de los **Centros de Atención al Vecino (CAV)**.

## Cambios Realizados

### 1. Dashboard de Novedades (Sección Herramientas)
Se rediseñó por completo la página de [Novedades en Herramientas](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/templates/novedades.html) (ruta `/gerencial/herramientas/novedades`) para convertirla en un Centro de Comando dinámico:

- **KPIs de Alta Visibilidad:** Tarjetas interactivas para Tickets Agua, Libre Deuda y Reclamos CAV.
- **Gráfico de Evolución:** Visualización con Chart.js que muestra la tendencia de los últimos 6 meses para estos tres indicadores.
- **Bitácora Integrada:** Una sección optimizada para los últimos 5 movimientos de la bitácora, manteniendo la funcionalidad de gestión de CUITs.
- **Buscador 360°:** Acceso rápido a expedientes digitales integrado en la cabecera del dashboard.

### 2. Renombramiento de CAVs
Para mejorar la claridad operativa, se implementó un mapeo de nombres en el [Servicio MuniSL](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/services/muni_sl_service.py):

| ID Original | Nuevo Nombre |
| :--- | :--- |
| CAV 1 | **Cav Barrio Jardin San Luis** |
| CAV 2 | **Cav Tercera Rotonda** |
| CAV 3 | **Secretaria Privada** |

Estos nombres ahora se reflejan automáticamente tanto en el Dashboard principal como en el **Monitor de Reclamos por CAV**.

## Verificación de Integración

### Backend
- Se validaron las llamadas a `https://ticketmuni.vercel.app/api/external/tickets` y `libredeuda`.
- Se configuró el filtrado por `keywords` para identificar correctamente los tickets relacionados con el servicio de agua.
- Se aseguró el uso de `os.getenv` para las credenciales de API, manteniendo la seguridad.

### Frontend
- Se verificó la consistencia visual en `dashboard_unificado.html`.
- Se confirmó que el Monitor de Reclamos CAV consume los nuevos nombres a través del agrupamiento del servicio.

> [!TIP]
> Los datos mostrados corresponden al **mes actual**. Si deseas cambiar el periodo de análisis, la lógica está preparada para extenderse al filtro de año seleccionado.
