# Implementación de Pagos Mixtos en Ventas Directas

El objetivo es aprovechar la lógica de pagos mixtos (ya probada en el módulo de Pedidos) dentro del POS de Ventas Directas, manteniendo la interfaz compacta y elegante.

## Plan de Acción

### 1. Frontend: Modificación de Interfaz (`ventas.html` y CSS)
- **Select Forma de Pago**: Se agregará la opción "Mixto" en la lista desplegable superior.
- **Panel de Pagos Mixtos**: 
  - Se añadirá una grilla debajo de los totales (o reemplazando el cálculo de vuelto temporalmente), la cual se mostrará **solo** si se elige "Mixto".
  - Tendrá campos numéricos para: `Efectivo`, `Mercado Pago`, `Tarjeta`, `Débito` y `Transferencia`.
  - Habrá un indicador en tiempo real de "Restante a Pagar" para asegurar que la suma de los montos coincida con el `TOTAL A COBRAR`.
- **Diseño**: Se utilizará CSS para hacer que estos inputs queden compactos, usando el mismo sistema de grillas y colores para mantener el diseño premium de la pantalla de Ventas.

### 2. Frontend: Lógica y Control (`app/static/js/modules/sales/ui.js` y `api.js`)
- **Event Listeners**: Cuando el cajero seleccione "Mixto", se ocultará el panel tradicional de "Paga con / Vuelto" y se mostrará el panel mixto con cálculo instántaneo del monto restante.
- **Validación Práctica**: Antes de procesar la venta, validaremos en el cliente que la suma de todos los montos digitados sea exactamente igual al total del ticket.
- **Carga Útil de API**: El `payload` de la solicitud POST a `/api/negocios/<id>/ventas` variará, enviando algo como:
  ```json
  {
      "metodo_pago": "Mixto",
      "montos_mixtos": {
          "Efectivo": 10000,
          "MP": 5000,
          "Tarjeta": 14000
      }
  }
  ```

### 3. Backend: Registro Fragmentado (`app/routes/sales_routes.py`)
Al igual que en Pedidos, si el backend recibe `metodo_pago == 'Mixto'`, procederá de la siguiente manera:
1. Validar que la suma de `montos_mixtos` concuerde con el `total_venta`.
2. Determinar el **Método Principal** (aquel con monto mayor a 0, con precedencia: Efectivo > MP > Tarjeta etc.).
3. Crear un registro de **Venta Principal** por el monto correspondiente a dicho método. *Esta venta principal es la única que contendrá los registros de `ventas_detalle` para descontar el STOCK solo una vez.*
4. Interar los demás montos mixtos mayores a 0 y generar **Ventas Secundarias** huérfanas de ítems para inyectar correctamente el dinero a sus respectivas Cuentas/Formas de pago en la caja.

## Verification Plan

### Automated Tests
1. Generar payload Mixto vía Curl simulando el front-end a `/negocios/<id>/ventas`.
2. Afirmar respuestas `201` del backend y validación de sumas en el backend (ej. suma errónea devuelve `400`).

### Manual Verification
1. Ingresar en el módulo de ventas y simular una venta de $1000.
2. Escoger "Mixto" en el header, asignar $500 Efectivo, $500 Mercado Pago.
3. Hacer click en Cobrar.
4. Ir al historial de ventas y revisar el historial de la Caja para asegurar que los ingresos estén separados en columnas correctas (Efectivo + Mercado Pago) pero el stock haya descendido una sola vez.
