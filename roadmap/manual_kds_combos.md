# 📘 Manual de Usuario: Combos Inteligentes y KDS Premium - Baboons Restó

Este manual detalla las nuevas funcionalidades implementadas para la gestión de **Combos Multi-Estación** y la unificación visual del sistema de monitores (KDS).

---

## 🎨 1. Interfaz Visual Premium (KDS)
Se ha implementado una arquitectura de estilos unificada (`kds.css`) para todas las estaciones: **Cocina, Barra y Dolce**.

### Características:
- **Modo Oscuro Profundo**: Optimizado para reducir la fatiga visual en ambientes de trabajo.
- **Micro-animaciones**: Las tarjetas nuevas entran con un efecto de deslizamiento suave.
- **Relojes Inteligentes**: Los cronómetros cambian de color según el tiempo de espera:
    - 🟢 **Bajo (0-8 min)**: Pedido fresco.
    - 🟡 **Medio (8-15 min)**: Alerta de demora.
    - 🔴 **Alto (+15 min)**: Prioridad crítica.

> [!TIP]
> Si no ves los cambios visuales, asegurate de limpiar el caché del navegador (hacer F5 o recargar). El sistema ahora tiene un "Cache Buster" (Versión 1.9.6) que debería forzar la actualización automáticamente.

---

## 🛠️ 2. Gestión de "Combos Inteligentes" (Configuración)

Ahora puedes definir la composición de tus combos de forma visual y rápida desde la **Gestión de la Carta**. No necesitas conocimientos técnicos, solo elegir los platos que forman parte del combo.

### Pasos para configurar un Combo:

1.  **Abrir Gestión de Carta**: Busca el plato que quieres convertir en un combo (ej: "Combo Baboons").
2.  **Clic en el Botón de Combo**: Verás un nuevo ícono de "capas" (`fa-layer-group`) en azul, junto a los botones de editar y receta.
3.  **Configurar Componentes**:
    *   Se abrirá un modal premium.
    *   **Buscar Plato**: Elige cualquier plato de tu carta desde el buscador integrado (ej: "Cerveza Tirada").
    *   **Cantidad**: Define cuántas unidades incluye el combo (ej: "1").
    *   **Botón `+`**: Añade el componente al listado.
4.  **Sincronización Automática**: El sistema guarda los cambios al instante. Puedes cerrar el modal cuando termines.

### ¿Cómo funciona el "Splitter" Inteligente?
Cuando el mozo carga el **"Combo Baboons"** en una mesa:
1.  **Facturación Limpia**: El ticket solo muestra el ítem padre ("Combo Baboons") con su precio total.
2.  **Explosión de Comanda**: El sistema genera automáticamente "sub-pedidos" para cada componente.
3.  **Ruteo Multiestación**: 
    *   La **Cocina** recibe la hamburguesa con el distintivo `🔗 COMBO`.
    *   La **Barra (Brandon)** recibe la cerveza con el distintivo `🔗 COMBO`.
4.  **Coordinación**: Ambos sectores saben que deben sacar los ítems juntos gracias al distintivo visual.

---

## 🔗 3. Distintivos en el Monitor (KDS)
Para que el equipo de producción sepa que un ítem es parte de un combo, se ha agregado un **Badge Visual**:

- **Identificador**: `🔗 COMBO`
- **Ubicación**: Al lado del nombre del producto en el monitor.
- **Utilidad**: Permite que el cocinero y el barman sepan que deben coordinar la salida de ese plato con el resto de los componentes del combo.

---

## 🛠️ 4. Solución de Problemas (FAQ)

### ¿Por qué el combo no se divide en el monitor?
Asegurate de que los productos que componen el combo tengan asignado un **Destino KDS** (estación) diferente en categorías de menú. Si todos van a la misma estación, aparecerán en el mismo monitor pero con el badge de `🔗 COMBO`.

### ¿El cliente ve los ítems por separado en la cuenta?
No. El sistema está configurado para que los componentes del combo tengan un **Precio $0**. De esta forma, el mozo y el cliente siguen viendo un solo ítem pagable ("Combo Baboons"), manteniendo la prolijidad de la factura.

---

> [!IMPORTANT]
> **Versión Actual del Sistema**: 1.9.6  
> **Backend**: Actualizado con soporte para `parent_detalle_id` en `comandas_detalle`.
