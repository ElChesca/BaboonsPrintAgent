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

## 5. Segmentación por Estación (Cocina vs. Bar) 🍕☕
El sistema sabe a dónde enviar cada producto basado en su categoría.

*   **Configuración de Categoría (Admin):**
    *   En **Gestión de Carta**, al crear o editar una categoría (ej: "Cafetería"), puedes elegir el **"Destino de Preparación"**.
    *   **Cocina (KDS):** Para platos que requieren elaboración térmica.
    *   **Bar / Barra (KDS):** Para bebidas, cócteles o despacho rápido.
*   **Monitor de Producción (KDS):**
    *   En la pantalla de cocina, encontrarás un selector arriba: **[Cocina]** | **[Bar / Barra]**.
    *   Cada puesto de trabajo elige su estación para ver solo lo que le corresponde preparar.

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
Panel central para administrar lo que vendes.

*   **Categorías:** Puedes ordenar visualmente las categorías (ej: que Entradas aparezcan primero que Postres) usando el campo "Orden".
*   **Sincronización de Stock:** En cada plato, puedes marcar si está **"Vinculado a Inventario"**. Si lo está, el sistema descontará automáticamente del stock general cada vez que se venda (ideal para gaseosas, cervezas y productos de preventa).
*   **Pausado de Productos (Disponibilidad):** 
    *   Si te quedas sin un ingrediente o un plato no está disponible momentáneamente, puedes presionar el botón de **"Pausar"** (icono de play/pausa) en la Gestión de Menú.
    *   **Efecto Inmediato:** El producto **desaparecerá automáticamente de la Carta Digital (QR)** que ven los clientes y también de la interfaz del **Mozo**. Esto evita que se vendan productos que no puedes preparar.
    *   **Categorías Vacías:** Si pausas todos los productos de una categoría (ej: "Postres"), la categoría completa se ocultará automáticamente de la carta para mantener un diseño limpio.

---

## 8. Generador de QR y Multi-Menú (Cartas Segmentadas) 📱
El sistema permite generar diferentes versiones de tu carta para distintos públicos (ej: Menú de Socios de Golf, Menú de Eventos, Carta General).

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

**Tips para el Administrador:**
*   Siempre asegúrate de que cada nueva categoría tenga asignada su **Estación de Preparación** correcta para que los pedidos no se pierdan en el monitor de cocina.
*   Revisá periódicamente el **Histórico de Comandas** para detectar patrones de demora o ajustar la capacidad del salón.
*   Para mozos nuevos: recordar que la **píldora de notificaciones** (🔔) es la forma más rápida de saber qué platos están listos para servir.
