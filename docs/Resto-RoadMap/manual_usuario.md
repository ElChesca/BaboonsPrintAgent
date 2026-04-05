# 📖 Manual de Usuario - Módulo Restó (Baboons)

Este manual detalla el flujo de trabajo para mozos, operarios de cocina/bar y administradores del sistema.

---

## 🔐 Acceso y Seguridad de Roles
Para facilitar la operación en tablets compartidas, el sistema cuenta con **Redirección Inteligente**:

*   **Mozos:** Al ingresar con sus credenciales, el sistema los llevará directamente a la interfaz de **Salón / POS**. En el topbar se muestra el **nombre del mozo logueado**.
*   **Adicionistas / Cajeros:** Al ingresar, el sistema los sitúa por defecto en el **Monitor de Caja Desktop**, optimizado para PC. Sin embargo, a diferencia de otros roles operativos, el Adicionista es un **operador integral** con acceso a todo el ERP (Ventas, Inventario, Reportes, etc.).
*   **Cocineros:** Serán redirigidos automáticamente al **Monitor de Cocina (KDS)**. Se muestra el **nombre del cocinero** con badge (`👨‍🍳 Carlos`).
*   **Gestión de Navegación:** Los mozos y cocineros operan en interfaces cerradas para evitar distracciones. Los **Adicionistas y Administradores** cuentan con botones de navegación ("Volver al Dashboard") que les permiten alternar entre los monitores operativos y las tareas administrativas del ERP.
*   **Cierre de Sesión:** En todas las interfaces, encontrarás un botón de **Power** (rojo o azul oscuro). Es fundamental cerrar la sesión al terminar el turno para proteger los registros de ventas.

---

## 🔹 ¿Qué es el KDS? (Kitchen Display System) 🖥️
El **KDS** es el Sistema de Visualización de Cocina. Es el reemplazo digital de la vieja "tiquetera" o los ganchos donde se pinchan los papeles en la cocina. 

### Diseño Profesional KDS
El monitor de producción tiene un estilo **KDS auténtico** de nivel profesional:

*   **Fondo oscuro de alto contraste** (`#0c1017`): Optimizado para cocinas con mucha luz y grasa. La lectura es clara incluso a distancia.
*   **Tipografía monospace** (`JetBrains Mono`): Para los cronómetros/timers, asegurando legibilidad perfecta de números y tiempos.
*   **Fuente principal** (`Inter`): Para nombres de platos y mesas, combinando profesionalismo y legibilidad.

### Indicadores de Prioridad por Color (Timers)
Cada tarjeta de comanda muestra un **cronómetro en tiempo real** que cambia de color según la demora:

| Color | Tiempo | Significado | Visual |
|-------|--------|-------------|--------|
| 🟢 Verde | < 8 min | Normal - Todo bajo control | Timer verde estable |
| 🟡 Amarillo | 8 - 15 min | Warning - Se está demorando | Timer naranja/amarillo |
| 🔴 Rojo | > 15 min | Urgente - Requiere atención inmediata | Timer rojo con **parpadeo animado** |

> **Nota:** El parpadeo rojo es una alerta visual diseñada para captar la atención del cocinero sin necesidad de alarmas sonoras.

### ¿Por qué es mejor que el papel?
*   **Visibilidad Total:** Las tarjetas están ordenadas digitalmente por tiempo de llegada, evitando que se pierdan o se dañen.
*   **Cronometraje en Tiempo Real:** Cada pedido tiene su propio reloj con indicadores de prioridad por color.
*   **Organización por Estaciones:** Permite filtrar pedidos automáticamente (Ej: La Cocina no ve las bebidas y el Bar no ve las pizzas).
*   **Actualización Automática:** El sistema se actualiza solo cada **10 segundos**. No es necesario refrescar la pantalla manualmente para ver nuevos pedidos.
*   **Eficiencia:** Permite medir tiempos promedio de preparación para mejorar la logística del negocio.
*   **Identidad del operador:** El nombre del cocinero logueado aparece en el topbar del KDS (`👨‍🍳 Nombre`).

---

## 🔹 Monitor de Caja (Adicionista) 💰
El **Monitor de Caja** es una interfaz de alto rendimiento diseñada específicamente para ser utilizada desde una **PC en el puesto de caja**. A diferencia de la app de mozos, esta vista aprovecha al máximo el espacio de pantalla para gestionar múltiples cobros simultáneamente.

### Diseño "Full Desktop App"
El monitor cuenta con una estructura profesional de escritorio:
*   **Topbar de Control:** Muestra quién está operando la caja, un contador total de pagos pendientes y botones de navegación rápida (Dashboard / Logout).
*   **Grilla de Tickets:** Los cobros pendientes se presentan como "tarjetas-ticket" de alta legibilidad, mostrando Mesa, Mozo, Zona y el Total resaltado.
*   **Panel de Actividad Reciente (Sidebar):** Ubicado a la derecha, este panel registra los últimos 10 cierres exitosos de la sesión, permitiendo al cajero verificar visualmente que un pago impactó correctamente sin tener que ir a reportes.

### Flujo Operativo en Caja
1.  **Monitorización:** La pantalla se refresca automáticamente cada **12 segundos**.
2.  **Cobro Express:** Al presionar **"FINALIZAR COBRO"**, se despliega el selector de pagos (Efectivo, Tarjeta, MP, Mixto).
3.  **Confirmación Visual:** Al completar un pago, la tarjeta desaparece de la lista principal y aparece instantáneamente en el panel de **"Recientes"** en el lateral derecho.
4.  **Multitarea:** Si el cajero necesita realizar otras tareas (ej: cargar una compra de mercadería), puede usar el botón **"Dashboard"** (icono de casa) para acceder al resto del ERP sin cerrar su sesión.

> [!IMPORTANT]
> **Optimización PC:** Esta interfaz está diseñada para evitar el uso del scroll innecesario y permitir una operación veloz solo con el mouse o pantalla táctil de escritorio.

---

## 1. Gestión de Mesas (Salón) 🪑
La interfaz de mesas es el corazón de la operación. Está diseñada con enfoque **Mobile-First** para funcionar perfectamente en celulares.

### Diseño Mobile-First
*   **Grid responsive** de 3 columnas en celulares, adaptable a pantallas más grandes.
*   **Topbar compacto** con el nombre del mozo logueado y menú hamburguesa (☰).
*   **Bottom sheet deslizable** para el detalle de la orden, con handle táctil y degradado oscuro.
*   **Tarjetas de productos compactas** optimizadas para scroll táctil.
*   **Refresco Inteligente (Zero-Flash):** El salón utiliza una tecnología de actualización suave que solo redibuja lo que cambia. Esto elimina el parpadeo molesto y permite operar con fluidez incluso con más de 50 mesas activas.

### Estados de Mesa
*   🟩 **Verde (Libre):** Mesa disponible para abrir una nueva comanda.
*   🟦 **Azul (Ocupada):** Mesa con comanda activa y consumos en curso.
*   🟧 **Naranja Pulsante (En Cobro):** El mozo ya solicitó la cuenta. La mesa está bloqueada para nuevos pedidos y espera que el **Adicionista** registre el pago para liberarse.

### Filtros de Búsqueda y Organización
A medida que el salón crece, puedes usar los filtros superiores para encontrar mesas rápidamente:
*   **Por Sector (Zonas):** Filtra por Living, Terraza, Deck, etc.
*   **Por Estado:** Ver solo las mesas libres, las ocupadas o las que ya pidieron la cuenta.
*   **Por Mozo (solo Administradores):** Permite al admin/adicionista ver las mesas filtradas por mozo. Este filtro **no aparece** para los mozos (ellos solo ven sus mesas).

### 🔔 Notificaciones de Cocina/Bar
En la fila de filtros encontrarás una **píldora de notificaciones** que indica el estado de los pedidos:

*   **Estado inactivo:** `🔔 Sin pedidos listos` — Píldora gris, sin acción requerida.
*   **Estado activo:** `🔔 3 pedidos listos!` — Píldora **amarilla animada** con badge rojo y pulsación visual.
    *   Al tocar la píldora se despliega un **panel con la lista** de items listos para servir.
    *   Cada notificación muestra: **Mesa # | Producto | Cantidad | ✓ Entregar**.
    *   Al presionar ✓ se marca el producto como **entregado** directamente, sin necesidad de abrir la mesa.
*   Además, cada vez que un nuevo plato se marca como "Listo" en cocina, aparece un **toast** emergente con sonido: `🔔 Mesa #3: ¡Milanesa LISTO!`

### Menú Hamburguesa (☰)
Accesible desde el topbar del salón, contiene:
*   **Salón:** Volver a la vista de mesas.
*   **Histórico Comandas:** Ver las últimas comandas cerradas del día (mesa, mozo, hora, total, estado).
*   **Cerrar Sesión:** Desloguear al mozo actual.

### Recuperación Automática (Heuristic Repair)
*   Si por algún motivo (error de carga) una mesa figura como "ocupada" pero no permite cargar pedidos, el sistema te ofrecerá un botón de **"Resetear Mesa"**. Esto forzará que la mesa vuelva a estar libre y cancelará comandas "huérfanas", permitiéndote seguir trabajando sin interrupciones.

---

## 2. Flujo de Cierre y Cobro (Adicionista) 💰💵
El sistema separa la solicitud de cuenta del cobro efectivo para garantizar el control de caja:

### Paso 1: Solicitar Cuenta (Acción del Mozo)
Cuando el cliente pide la cuenta, el Mozo entra a la mesa y presiona **"PEDIR CUENTA"**:
1.  **Validación de Entrega:** El sistema verifica que todos los productos hayan sido marcados como **Entregados**. No se puede pedir la cuenta si hay platos pendientes en cocina o bar.
2.  **Pre-Ticket:** Se genera un comprobante de control (no válido como factura) para el cliente.
3.  **Cambio de Estado:** La mesa cambia a **Naranja Pulsante**. En este estado, la comanda queda "congelada" (no se pueden agregar más productos).

### Paso 2: Finalizar Cobro (Acción del Adicionista/Cajero)
Solo los usuarios autorizados (Admin o Adicionista) pueden realizar el cierre final. El cajero tiene dos formas de hacerlo:

1.  **Desde el Monitor de Caja (Recomendado):** Entrando por la tarjeta **"Caja / Adición"** del dashboard. Es la forma más rápida de ver todas las cuentas pendientes en una lista.
2.  **Desde el Salón:** Al abrir una mesa en naranja en el mapa de mesas, aparecerá el botón **"FINALIZAR COBRO"**.

**Selector de Pago:** 
Al elegir cualquiera de las vías anteriores, se despliega un modal premium para elegir el método:
*   **Efectivo:** Cobro tradicional billete sobre billete.
*   **📱 MP Transferencia / QR (Dinámico):** Genera un código QR único en la pantalla. El cliente escanea y paga; el sistema detecta el éxito instantáneamente y libera la mesa sin intervención del cajero.
*   **📟 Mercado Pago Point (Posnet):** Envía el monto al dispositivo físico. El cliente paga (tarjeta o celular) y al procesarse, la mesa se cierra automáticamente. **Ya no se requiere cargar marca de tarjeta ni cupón manualmente.**
*   **🏦 Transferencia:** Para registrar depósitos bancarios directos.
*   **📑 Cuenta Corriente:** Envía el total a la deuda del cliente vinculado.
*   **🔀 Pago Mixto:** Permite desglosar el total entre varios métodos.
3.  **Cierre:** Al confirmar, se registra la venta en el historial, se descuenta el stock (recetas e insumos) y la mesa vuelve a estar **Libre (Verde)**.

> [!TIP]
> **Seguridad:** Si un mozo intenta finalizar un cobro sin tener el rol permitido, el sistema le informará que la mesa está esperando por la acción del cajero.

---

## 3. Toma de Pedidos (Interfaz Mozo) 📝
Realiza pedidos de forma rápida y sin errores.

*   **Apertura de Comanda:** Seleccioná una mesa libre. Se abrirá un popup con:
    *   **Selector de Mozo:** Dropdown con los mozos del negocio.
    *   **Selector de Comensales (PAX):** Stepper táctil con botones **−** y **+** (de 1 a 30 comensales) para ajustar sin teclado.
    *   Botón destacado: **"🚪 Abrir Mesa"**.
*   **Búsqueda Rápida:** En el menú de productos, usá la barra de búsqueda para encontrar platos o bebidas instantáneamente.
*   **Gestión de PAX (Cubiertos):** Ajustá la cantidad de comensales en cualquier momento si se agregan personas a la mesa.
*   **Cambio de Mesa:** Si un cliente decide mudarse, podés transferir toda su cuenta a una mesa libre con el botón "Mover Mesa".

### Detalle de Orden (Bottom Sheet)
Al abrir una mesa ocupada, el bottom sheet muestra el **detalle completo** de la comanda:

*   **Ítems enviados a cocina** con su estado:
    *   ⏳ **PENDIENTE** — Recién enviado, esperando preparación.
    *   🔥 **COCINANDO** — En proceso de elaboración.
    *   ✅ **LISTO** — Preparado, listo para servir.
    *   ✓ **ENTREGADO** — Ya servido al cliente (aparece con opacidad reducida).
*   **Ítems por enviar (Draft):** Productos agregados que aún no se enviaron a cocina. Se muestran en azul con botones +/- para ajustar cantidad.
*   **Botón "Entregar Pendientes":** Marca todos los ítems pendientes como entregados de una sola vez.
*   Si la comanda tiene items pero el detalle no carga, el sistema **re-fetchea automáticamente** los datos (muestra un spinner "Cargando detalle...").

### Carga de Ítems
*   Navegá por las categorías (Pizzas, Bebidas, etc.).
*   Hacé clic en un ítem para sumarlo.
*   **Observaciones:** Agregá notas específicas (ej: *"Sin cebolla"*, *"Hielo aparte"*).
*   **Envío a Cocina y Retorno:** Al presionar **"Enviar Comanda"**, los pedidos viajan a su estación. **El sistema te regresará automáticamente al Salón**, ahorrándote clics para que puedas atender la siguiente mesa de inmediato.

---

## 4. Histórico de Comandas 📋
Desde el **menú hamburguesa (☰)** del mozo, se puede acceder al **Histórico de Comandas** del día.

*   Muestra las últimas **50 comandas cerradas** del día actual.
*   Cada entrada incluye: **Mesa** | **Mozo** | **Hora** | **Total** | **Estado** (Cerrada).
*   Se presenta en un modal con tabla scrollable, ideal para consultas rápidas del encargado o el cierre de turno.

### Endpoint Backend
`GET /api/negocios/{id}/comandas?estado=cerrada&fecha=YYYY-MM-DD&limit=50`

---

## 5. Segmentación por Estación (Destino KDS) 🍕☕
El sistema organiza automáticamente a dónde enviar cada producto para su preparación, utilizando un **sistema inteligente de herencia**.

### Estación por Categoría (Configuración Base) 📂
Al crear o editar una categoría (ej: "Bebidas"), seleccioná su estación de preparación. Todos los productos de esa categoría heredarán este destino automáticamente:
*   **Cocina (KDS):** Platos elaborados, minutas, parrilla.
*   **Bar / Barra (KDS):** Cafetería, coctelería, despacho de bebidas.

### Sobrescritura por Plato (Excepciones) ✨
Si un plato específico debe salir por un lugar distinto al de su categoría (ej: un item de "Postres" que se despacha en Barra), podés configurarlo individualmente:
*   En la **Gestión de Menú**, editá el plato y completá el campo **"Destino KDS"**.
*   Si este campo tiene un valor, el sistema ignorará la categoría y enviará el pedido a la estación indicada.
*   Si el campo está vacío, el plato seguirá "heredando" el destino de su categoría.

### Modificación Masiva de Estaciones ⚡
Para cambios rápidos (ej: mover todos los platos de una sección a una nueva estación temporal), utilizá el botón **"Destino KDS"** en la barra de acciones masivas tras seleccionar los productos deseados.

---

## 6. Ciclo de Vida de un Ítem en Cocina ⏱️
El monitor KDS ayuda a priorizar y gestionar los tiempos.

1.  **Pendiente:** El pedido acaba de entrar. El cronómetro indica el tiempo de espera.
    *   El timer comienza en **verde** (🟢).
    *   **Acción:** Presionar **"PREPARAR"** (Cocina) o **"PREPARAR BEBIDAS"** (Bar). El ítem pasa a *Cocinando*.
2.  **Cocinando / Preparando:** El ítem está en proceso. El ítem se resalta visualmente.
    *   Si el tiempo supera 8 minutos, el timer cambia a **amarillo** (🟡).
    *   Si supera 15 minutos, cambia a **rojo parpadeante** (🔴) indicando urgencia.
3.  **Listo / Entregado:** Al presionar **"DESPACHAR"** (Cocina) o **"ENTREGAR / SERVIR"** (Bar), el ítem se marca como **Entregado**.
    *   *Nota:* Solo los ítems en estado **Entregado** permiten que la mesa sea cobrada exitosamente.
    *   Al marcar como entregado, el mozo recibe una **notificación instantánea** (`🔔 Mesa #3: ¡Milanesa LISTO!`) en su pantalla.

---

## 7. Gestión de Carta y Precios 📋
Panel central para administrar tu oferta gastronómica con un diseño **Glassmorphism Premium**.

*   **Categorías:** Puedes ordenar visualmente las secciones (ej: Entradas antes que Postres) usando el campo "Orden".
*   **Gestión de Precios Dinámica:** 
    *   Al editar un plato, verás la sección **"Precios por Carta"** con un diseño de tarjetas moderno.
    *   Cada tarjeta representa una lista de precios distinta (Ej: Carta General vs Carta de Socios).
    *   Los campos incluyen el símbolo `$` y validación en tiempo real para evitar errores de carga.
*   **Visualización de Selección:** Al seleccionar productos en la tabla, las filas se resaltan con un borde premium, permitiendo identificar rápidamente qué items estás gestionando mediante acciones masivas.
*   **Edición Masiva (Bulk Actions):**
    *   Utilizá los botones rápidos para cambiar **Precios, Categorías o Destinos KDS** de cientos de productos en segundos.
    *   Podés **Activar** o **Pausar** grupos enteros de platos con un solo clic.

### 🛡️ Seguridad de Precios en Vivo (Snapshots)
Una de las funciones críticas de seguridad de Baboons es la **congelación de precios por pedido**:
- **Snapshot Automático:** En el momento exacto en que un mozo confirma un pedido, el sistema "captura" el precio vigente en ese instante y lo guarda en la comanda.
- **Sin Sorpresas:** Si un administrador cambia el precio de un plato en la Gestión de Carta mientras hay mesas comiendo, **esas mesas NO se verán afectadas**. El cliente pagará el precio que figuraba cuando pidió el plato.
- **Actualización Transparente:** Los nuevos precios solo aplicarán para los pedidos que se realicen *después* de la modificación.

### Pausado de Productos (Disponibilidad)
*   Si te quedas sin un ingrediente, puedes presionar el botón de **"Pausar"** en la Gestión de Menú.
*   **Efecto Inmediato:** El producto desaparecerá de la **Carta Digital (QR)** y de la interfaz del **Mozo** al instante.
*   **Categorías Vacías:** Si pausas todos los platos de una sección, la categoría completa se ocultará automáticamente para mantener la carta prolija.

---

## 8. Generador de QR y Multi-Menú (Cartas Segmentadas) 📱
El sistema permite generar diferentes versiones de tu carta para distintos públicos (ej: VIP, Eventos, Carta General) con total facilidad.

*   **Configuración (Admin):**
    *   En el panel de **Gestión de Carta**, encontrarás el botón **"QR Menú"**.
*   **Selector de Listas / Cartas:**
    *   **Generación Dinámica:** Dentro del modal de QR, ahora puedes desplegar una lista de todas tus "Cartas" creadas. 
    *   Al seleccionar una (ej: "Golfistas"), el código QR y el enlace se actualizan instantáneamente para esa lista específica.
    *   **Copiar URL:** Copia el enlace directo de la lista seleccionada para compartir por WhatsApp o redes sociales.
*   **Gestión de Listas:**
    *   Usa el botón **"Listas / Cartas"** en el encabezado para crear nuevas segmentaciones o eliminar las que ya no uses. Cada lista puede tener sus propios precios (configurables desde la edición de cada plato).

---

## 9. Personalización y Branding Premium 🎨
El sistema permite proyectar la identidad de tu negocio de forma global o específica por cada carta.

### Personalización por Lista (Experiencia del Cliente):
Ahora puedes configurar cada lista de precios para que se sienta como una experiencia única:
1.  **Mensaje de Bienvenida:** Puedes definir un texto corto que aparecerá resaltado con un **Badge Dorado** al abrir la carta (ej: *"¡Bienvenido Socio de Golf! Disfruta nuestro Hoyo 19"*).
2.  **Banner Especial:** Cada lista puede tener su propia imagen de cabecera. Si no configuras una, se usará la imagen general del negocio.

### Configuración General de Marca:
1.  **Imagen de Fondo (Banner Superior):** Configuración base para todas las cartas. 
    *   **Tamaño Ideal:** 1600 x 900 px. Peso max: 300 KB.
2.  **Logo del Negocio:**
    *   **Tamaño Ideal:** 512 x 512 px (PNG Transparente). Peso max: 100 KB.
3.  **Redes Sociales y Contacto (Footer):**
    *   Los enlaces de Instagram y Facebook aparecen como iconos interactivos en el pie de página de todas tus cartas digitales.

---

## 10. Gestión de Stock y Recetas (BOM) 🍳🍕

El sistema Restó incluye un potente motor de **Control de Existencias** que permite no solo contar cuántas unidades de un producto te quedan, sino también de qué está hecho cada plato.

### ¿Cómo funciona el descuento de Stock?

El sistema descuenta del inventario en el momento del **Cobro y Cierre de Mesa**. Existen dos formas de descuento automático:

1.  **Venta Directa de Producto:**
    *   Ideal para: Gaseosas, cervezas, vinos o postres comprados a terceros.
    *   **Funcionamiento:** Al cerrar la mesa, el sistema descuenta **1 unidad** (o las vendidas) directamente del stock de ese producto en el inventario.

2.  **Venta de Platos con Receta (BOM - Bill of Materials):**
    *   Ideal para: Pizzas, hamburguesas, minutas o cualquier plato elaborado.
    *   **Funcionamiento:** Al cerrar la mesa, el sistema verifica si el plato tiene una **Receta** cargada. Si es así, no descuenta el plato en sí, sino que **descuenta proporcionalmente cada ingrediente** cargado en la receta (ej: 0.250 kg de carne, 0.050 kg de queso, 1 pan de hamburguesa).
    *   **Costo de producción:** El sistema te mostrará automáticamente cuánto te cuesta producir ese plato basado en los precios de compra de tus materias primas.

### Pasos para Configurar una Receta:

1.  **Cargar Materia Prima:** En el módulo de **Inventario**, asegúrate de cargar tus ingredientes (ej: harina, queso) y marcar el **Tipo de Producto** como "Materia Prima / Insumo".
2.  **Configurar Unidades:** Usa el módulo de **Unidades de Medida** para definir cómo vas a medir cada ingrediente (Kg, Litros, Unidades, etc.).
3.  **Vincular en el Menú:**
    *   Ve a **Gestión de Menú**.
    *   Ubica el plato (ej: "Pizza Muzarella") y haz clic en el icono de **Receta (BOM)**.
    *   Añade los ingredientes y la cantidad exacta que lleva cada porción.

### Beneficios del Control de Recetas:
*   **Inventario Siempre Real:** Sabrás cuántos kilos de harina o carne te quedan realmente en la cocina.
*   **Alerta de Faltantes:** El sistema te avisará si te estás quedando sin un insumo crítico para seguir cocinando.
*   **Margen de Ganancia Preciso:** Sabrás exactamente cuánto dinero estás ganando por cada plato vendido, restando el costo real de los ingredientes.

---

4.  **Carga y Edición en Tabla:** Buscá los productos y clickeá para sumarlos a la grilla.
    *   **Edición Directa:** Podés modificar la **Cantidad** y el **Costo Unitario Pactado** directamente dentro de las celdas de la tabla. El total se recalcula al instante.
5.  **Numeración Inteligente:** El sistema asigna un número correlativo (ej: `OC-0001`). Esta numeración es **única por cada Negocio**, permitiendo que cada sucursal lleve su propio control independiente.
6.  **Guardado y Descarga:** Al confirmar, el sistema registra la OC y genera el documento oficial.

### 📄 Documento de Orden de Compra:
A diferencia de otros reportes, la OC cuenta con un sistema de **Descarga Segura Autenticada**:
*   **Descarga Directa:** Al presionar "Ver PDF", el archivo se descarga automáticamente a tu dispositivo (no requiere pasos extra).
*   **Nombre de Archivo Organizado:** Los archivos se guardan automáticamente con el formato: **`[NUMERO_OC]_[NOMBRE_PROVEEDOR].pdf`**. Esto te permite encontrarlos rápidamente en tu carpeta de descargas sin tener que renombrarlos.
*   **Diseño Corporativo:** El PDF incluye el logo de tu negocio, datos fiscales, desglose de ítems, totales y espacio para firmas.

---

## 12. Recepción de Mercadería (Integración con OC) 📦

Para ahorrar tiempo y evitar errores de carga manual, el proceso de **Ingreso de Mercadería** está totalmente vinculado con las Órdenes de Compra.

### Importación Inteligente:
Cuando el proveedor entrega el pedido, ya no es necesario cargar producto por producto:
1.  Entrá al módulo de **Ingreso de Mercadería**.
2.  Presioná el botón superior **"Importar desde OC"**.
3.  Se desplegará una lista de todas las órdenes que están en estado **"Pendiente"**.
4.  Al seleccionar una OC, el sistema:
    *   Carga automáticamente al **Proveedor**.
    *   Pre-puebla la lista de productos con las **Cantidades y Costos** pactados en la orden.
    *   Añade una referencia automática: *"Importado de OC #XXXX"*.

### Flexibilidad en la Recepción:
Si lo recibido no coincide exactamente con lo pedido, el sistema permite:
*   **Combinar:** Sumar los productos de la OC a ítems que ya tenías cargados manualmente en la grilla.
*   **Reemplazar:** Limpiar la grilla actual y dejar solo lo que indica la OC.
*   **Modificar:** Una vez importado, podés ajustar cantidades o costos unitarios antes de confirmar el ingreso final.

> [!IMPORTANT]
> **Actualización de Stock y Deuda:** Al presionar "Registrar Ingreso", el sistema actualizará el stock de los productos, recalculará los costos promedio y registrará la deuda en la **Cuenta Corriente del Proveedor** automáticamente.

---

## 13. Gestión de Reservas de Mesas 📅

El sistema incluye un potente motor de reservas que conecta directamente la intención del cliente con la operación del salón.

### 🏢 Dashboard de Reservas (Administrador)
- **Vista Diaria**: Permite ver todas las reservas del día, filtrarlas por estado (Pendiente, Confirmada, Cancelada) y asignarles una mesa específica.
- **Alta Manual**: Posibilidad de registrar reservas que llegan por teléfono o presencialmente, vinculando clientes existentes o creando nuevos sobre la marcha.
- **Confirmación WhatsApp**: Genera automáticamente un botón para enviar un mensaje pre-formateado al cliente con todos los datos de su reserva.

### ⚙️ Configuración de Turnos y Link Público
En el botón de **Configuración** (icono de engranaje) podés gestionar:
1.  **Horarios**: Definí los bloques del día (ej: Almuerzo, Cena), el intervalo entre turnos (ej: cada 30 min) y los días de apertura.
2.  **Link para Clientes**: El sistema genera un enlace único (`/reservas?t=...`) que podés poner en tu bio de Instagram o enviar por WhatsApp para que los clientes se autogestionen.

### 🛡️ Reglas de Salón (Aviso al Mozo)
Esta es una función de seguridad crítica para evitar "quemar" mesas reservadas:
- **Configuración de Alerta**: En la pestaña **"Reglas"**, podés definir con cuánta anticipación debe avisar el sistema al mozo (ej: 60 minutos).
- **Advertencia en POS**: Si un mozo intenta abrir una mesa libre que tiene una reserva pactada dentro del rango de tiempo elegido:
    - El sistema interrumpirá la apertura con un **Banner Naranja**.
    - Mostrará el **nombre del cliente** y la **hora exacta** de la reserva.
    - El mozo deberá confirmar que es consciente de la reserva antes de poder ocupar la mesa.

## 11. Sistema de Impresión y Ruteo Inteligente 🖨️

Baboons cuenta con un motor de impresión profesional que automatiza el despacho de pedidos y la entrega de cuentas, eliminando la necesidad de interactuar con ventanas del navegador.

### ⚡ Impresión Automática (Sin Diálogos)
Olvídate de presionar "Aceptar" en la ventana de impresión de Windows. Al confirmar un pedido o pedir la cuenta, el sistema se comunica directamente con tu **Baboons Print Router** local y dispara el ticket al instante. Esto permite una operación mucho más fluida en la que el mozo solo debe preocuparse por atender al cliente.

### 🛰️ Ruteo por Destinos (KDS Print)
El sistema divide automáticamente los pedidos según su estación de preparación:
*   **Comanda de Cocina:** Los platos se imprimen en la impresora asignada a la Cocina.
*   **Comanda de Barra:** Las bebidas y cafetería salen por la impresora de la Barra.
*   **Ticket de Control:** Al presionar "Pedir Cuenta", el ticket se imprime automáticamente en la **Caja** o impresora principal del negocio.

### 🛠️ Ajustes de Ticket PRO
Desde el módulo de **[Impresoras]**, los administradores pueden personalizar la experiencia de impresión:

1.  **Ruteo Inteligente (Plan B):**
    *   Si está **Activo**, el sistema enviará cualquier pedido que no tenga una impresora específica a la impresora principal (para asegurar que ningún pedido se pierda).
    *   Si está **Desactivado**, solo se imprimirán aquellos ítems que tengan una impresora configurada para su destino exacto.
2.  **Jerarquía Visual (Tamaños de Fuente):**
    *   Puedes configurar el **Número de Mesa** en tamaño **Grande o Súper Grande** para que el personal de cocina pueda identificar el destino del plato desde varios metros de distancia.
    *   Ajusta el tamaño del nombre del **Mozo** y los **Productos** según la legibilidad de tu papel térmico.
3.  **Leyenda de Ticket:**
    *   Espacio dedicado para mensajes personalizados al pie del ticket (ej: *"¡Gracias por elegirnos!"*, *"Visitá nuestra web: www.ejemplo.com"*).

---

**Tips para el Administrador:**
*   **Optimización de Salón**: Usá la pestaña de **Reglas** en Reservas para ajustar el margen de maniobra de tus mozos según la demanda del día.
*   Siempre asegúrate de que cada nueva categoría tenga asignada su **Estación de Preparación** correcta para que los pedidos no se pierdan en el monitor de cocina.
*   Utilizá las **Órdenes de Compra** para tener un control histórico de los aumentos de precios de tus proveedores.
*   Para mozos nuevos: recordá que la **píldora de notificaciones** (🔔) es la forma más rápida de saber qué platos están listos para servir.
