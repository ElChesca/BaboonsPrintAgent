# 🍽️ GUÍA CRÍTICA: LÓGICA DE RESTÓ (MOZOS, KDS Y COMANDAS)

Este documento es la **ÚNICA fuente de verdad** para el flujo de trabajo del módulo Restó. Cualquier modificación en `resto_routes.py`, `resto_mozo.js` o el agente local de impresión DEBE respetar estas definiciones.

## ⚠️ REGLAS DE ORO (ESTABILIDAD DEL SISTEMA)
1.  **Arquitectura Cloud-First**: Todo el ruteo de impresión pasa por la nube (Fly.io). Las Tablets/Celulares **NUNCA** deben intentar comunicarse directamente con IPs locales de impresoras o del agente.
2.  **Estado de Comandas**: Una comanda está "activa" si su estado es `abierta`. Al solicitar la cuenta, el estado de la mesa pasa a `en_cobro`, pero la comanda sigue `abierta` hasta el pago final.
3.  **Control de Stock**: Los productos se filtran en el POS para mozos por `mi.disponible = TRUE` y, si `mi.stock_control = TRUE`, deben tener `p.stock > 0`.
4.  **Impresión (Payload)**: El backend genera un campo `content` ya formateado con etiquetas de tamaño (`[S1]`, `[S2]`). El agente de impresión DEBE priorizar este campo sobre el array de `items` para soportar diversos tipos de tickets (Cocina, Pre-Cuenta, Cierre).

---

## 🛠️ ARQUITECTURA DE IMPRESIÓN (ESTABLE)

### Componentes:
1.  **Frontend (Móvil/Tablet/PC)**: Envía órdenes a `https://multinegocio.baboons.com.ar/api`.
2.  **Backend (Nube)**: Procesa la orden, identifica las impresoras de destino y guarda el ticket en la tabla `resto_cola_impresion`.
3.  **Agente Local (`BaboonsPrintAgent.exe`)**: 
    - Corre en una PC local con salida a internet.
    - **Polling**: Cada 3 segundos consulta trabajos en `/api/negocios/{id}/impresion-cola/pendientes`.
    - **Ejecución**: Envía el ticket por red local (TCP 9100) a la IP de la impresora térmica.
    - **Confirmación**: Notifica éxito al servidor mediante el endpoint `/listo`.

### Configuración del Agente:
- **URL**: `https://multinegocio.baboons.com.ar` (Sin el /api al final en la interfaz).
- **Negocio ID**: ID numérico único (ej: 13).
- **Token**: Bearer token de acceso seguro.

---

## 📊 ESQUEMA DE BASE DE DATOS CRÍTICO

### Tabla: `comandas`
*   `id`: integer (PK)
*   `estado`: text ('abierta', 'cerrada', 'cancelada')
*   `num_comensales`: integer (Pax)

### Tabla: `resto_cola_impresion`
*   `id`: SERIAL (PK)
*   `negocio_id`: integer
*   `payload`: JSONB (Contiene `ip_destino`, `content`, `reprint`, `id_orden`, etc.)
*   `estado`: text ('pendiente', 'impreso', 'error')

---

## 🔄 FLUJO DE COMANDA (PROCESO ESTABILIZADO)

### 1. Envío desde el Mozo
- El backend (`add_items_to_comanda`) inserta en `comandas_detalle`.
- **Ruteo de Estación**: Cada item se dirige a una estación (ej: 'cocina', 'bar'). Si no hay coincidencia exacta de estación, el sistema busca una impresora marcada como `es_caja = TRUE`.

### 2. Generación de Tickets
- Se inserta un registro en `resto_cola_impresion` por cada impresora involucrada.
- El `content` incluye etiquetas:
    - `[S1]`: Negrita, tamaño normal, centrado.
    - `[S2]`: Negrita, tamaño doble, centrado (Mesa).

### 3. Ejecución y Confirmación
- El agente **DEBE** cerrar la conexión con la impresora después de cada ticket para liberar el buffer.
- Debe existir un delay de al menos 0.5s entre impresiones sucesivas para evitar colisiones en la impresora térmica.

---

## 🛠️ DESARROLLO E INTERFACES
- **KDS**: Filtra por estación (Category -> Estacion) o por `destino_kds` específico del item.
- **Pre-Cuenta**: Siempre se dirige a la impresora marcada como `es_caja = TRUE`.

---
**NOTA PARA LA IA**: Cualquier cambio que intente implementar "impresión local directa" desde el navegador en producción será bloqueado por políticas de Mixed Content (HTTPS -> HTTP). El flujo SIEMPRE debe ser a través de la cola en la nube.
