# Roadmap: KDS Combos & Itemización Inteligente 🐒🥩🍹

## 🎯 Objetivo
Transformar la gestión de "Combos" (ej: Burguer + Trago + Postre) en un sistema de producción multi-estación. Que el Mozo pida un solo ítem, pero cada monitor de producción (Cocina, Barman, Dolce) reciba solo la parte que le corresponde, manteniendo la trazabilidad del pedido completo.

---

## 🛠️ Fase 1: Arquitectura de Datos (The Core)

### 1.1 Nueva Tabla `producto_combo_items`
Define la composición de los combos.
| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | SERIAL | Identificador único |
| `producto_padre_id` | INT | ID del producto tipo "Combo" |
| `producto_hijo_id` | INT | ID del producto individual (ej: Coca Cola, Burguer) |
| `cantidad` | DECIMAL | Cantidad del ítem dentro del combo |

---

## 🛠️ Fase 2: Lógica de Comanda (The Logic)

### 2.1 El "Splitter" de Pedidos
Modificar la función de guardado de comandas (`app/routes/rest_routes.py` o similar):
- **Detección**: Si se detecta un `producto_id` que pertenece a un combo.
- **Inserción**: En `detalles_pedido`, NO se inserta el combo como un solo bloque. Se insertan N filas (una por cada `producto_hijo`).
- **Vinculación**: Todas las filas comparten un `parent_combo_id` (nueva columna en `detalles_pedido`) para saber que deben despacharse juntas.

---

## 🛠️ Fase 3: Visualización en KDS (The UI)

### 3.1 Identificadores en Tarjetas
- **Badge**: Agregar una etiqueta `🔗 COMBO` en la tarjeta del KDS.
- **Contexto**: Mostrar el nombre del combo padre debajo del ítem (ej: "Trago de Autor [Combo Baboons]").
- **Estación**: Cada ítem se envía al monitor de su categoría (Bar, Cocina o Dolce) automáticamente gracias al split de la Fase 2.

---

## 🛠️ Fase 4: Despacho y Notificación (The Delivery)

### 4.1 Sincronización del Waiter
- **Estado Agregado**: Solo cuando todos los ítems con el mismo `parent_combo_id` estén marcados como `listo`, el sistema enviará la notificación al Mozo: *"Mesa X: Combo Completo"*.
- **Alerta de Parciales**: Si pasa mucho tiempo y el Bar terminó pero la Cocina no, alertar al encargado.

---

## 📅 Próximos Pasos (GO!)
1. 🔍 **Auditoría**: Revisar la estructura actual de la DB para compatibles con Postgres/Neon.
2. 🔨 **Migración**: Crear la tabla de combos.
3. 🧪 **MVP**: Testear con un combo de "Cerveza + Papas".

---
*Autor: Antigravity AI (en dupla con Federico)*  
*Estado: PLANIFICACIÓN ACTIVA*
