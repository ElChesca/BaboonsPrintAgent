# Implementación de Pagos Mixtos en Ventas

He concluido la implementación de pagos mixtos en el módulo de ventas. Tal y como acordamos en el plan de implementación, los cajeros ahora cuentan con la opción de cobrar un ticket utilizando múltiples métodos de pago a la misma vez.

A continuación un resumen de los cambios:

### Frontend
- **Seleccionador de Métodos**: El elemento `<select>` de forma de pago ahora incluye la opción `Mixto`.
- **Panel de Pagos Dinámico**: Cuando el usuario selecciona `Mixto`, la pantalla reacciona de forma dinámica, ocultando los controles de "Paga con / Vuelto" y exponiendo un nuevo panel con diseño compacto (*grid* de 5 columnas para Efectivo, Tarjeta, MP, Débito, Transferencia).
- **Indicador "Restante"**: A medida que el usuario escribe los montos en los diferentes métodos, un indicador calcula en vivo si "Falta Pagar", "Sobra" o el "Saldo" en `$0.00` coloreándose en rojo, naranja o verde según aplique.
- **Validación Estricta**: Al momento de apretar "Cobrar", el sistema se encarga de re-calcular que los montos fraccionados den una sumatoria exactamente idéntica al total con descuentos/extras de la venta. En caso diferencial, se emite una alerta indicándolo al cajero y bloquea el botón.

### Backend (`/api/ventas`)
- Si el método seleccionado es `Mixto`, el servidor recibe el desglose de montos.
- **Venta Principal vs Secundarias**: A fines de que no se rebaje el stock n-veces debido a los detalles de los productos, la lógica determina el **Método Principal** (aquel con monto mayor a 0, con prioridad en Efectivo > MP > Tarjeta etc.), e inyecta la venta con este método **y el array de `detalles` para rebatir el stock**. 
- Posteriormente, y por cada método adicional introducido, genera sub-ventas sin ítems por los montos complementarios a fin de inyectar ese recaudo exacto a las respectivas billeteras de la sesión de la Caja en turno (y se vean correctamente en el historial y flujo de fondos diario).

Con estos cambios, la capacidad de procesar transacciones compuestas ha sido uniformizada entre los pedidos logísticos y el canal en mostrador.

### ➕ Actualización (Cuenta Corriente)
Adicionalmente, se ha implementado la funcionalidad nativa de **Cuenta Corriente** tanto para ventas directas ordinarias como para pagos Mixtos:
- Se simplificó el selector de pagos y se renombró `Mixto` a **Pago Mixto + Cta Cte**.
- En este nuevo modo, **el panel ahora solo muestra Efectivo y Mercado Pago**, tal cual como en la Hoja de Ruta. Cualquier monto que no se cubra con estos dos métodos se asigna automáticamente **"A Cta Cte"**.
- Se eliminó el campo "Paga con" (vuelto) para todos los métodos excepto **Efectivo**, limpiando la interfaz de opciones irrelevantes.
- Se corrigió un error en el código HTML que ocultaba los botones de **Cobrar** y se restauró la funcionalidad de validación inmediata: si intentas seleccionar "Cuenta Corriente" sin un cliente identificado, el sistema te avisará en el momento y no permitirá la selección.
- Al generar una venta asignando un monto a Cuenta Corriente, el sistema verifica que haya un **Cliente seleccionado**, e inyecta la deuda automáticamente dentro de la tabla `clientes_cuenta_corriente`, impactando en vivo el saldo deudor del cliente.
