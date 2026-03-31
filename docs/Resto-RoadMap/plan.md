# 🗺️ Roadmap Módulo Restó (Fase Carta y Pedidos)

Este documento detalla el plan de implementación para la expansión del módulo gastronómico de Multinegocio Baboons.

## 🎯 Objetivo
Habilitar la venta de platos y bebidas a través de una **Carta (Menú)** independiente del inventario general, permitiendo la toma de pedidos por mesas por parte de mozos y el control por puestos de trabajo (Cocina, Bar, Adicionista).

---

## ✅ Logros de Hoy (25/03)
- [x] **UI Premium Mozo**: Rediseño absoluto con estética de alta gama (*Plus Jakarta Sans*, glassmorphism y micro-animaciones).
- [x] **Navegación Fluida**: Implementación de sistema de vistas (Salón <-> POS) sin recargar página.
- [x] **Filtros Avanzados**: Filtrado por Zonas (VIP, Terraza, etc.), Estados (Libre, Ocupada, Cuenta) y Mozos.
- [x] **Seguridad de Datos**: Corrección del "Ghosting de Mozos" asegurando que solo se listen mozos del negocio activo (Vita).
- [x] **Dashboards Operativos 360°**: Implementación de KPIs en tiempo real (Ventas, PAX, Mesas, Tiempos de Demora). (¡NUEVO!)
- [x] **Estabilidad SQL**: Sistema de auto-migración de columnas para cronometraje de comandas en producción.
- [x] **Ranking de Staff**: Visualización activa de ventas por mozo para incentivos y control.
- [x] **Optimización Zero-Flash**: Refresco de salón sin parpadeos para alta demanda. (¡NUEVO!)

---

## 🏗️ Fase 1: Cimientos y Carta (En Progreso)
- [x] **DB - Esquema de Carta**: Tablas `menu_items` y `menu_categorias` operativas.
- [x] **Roles de Personal**: Permisos alineados en `admin_routes.py` para mozos y administradores de Restó.
- [x] **Admin - Gestión de Menú**: Pantalla para ABM de platos y categorías con generador de QR. (¡LISTO!)

## 🤵 Fase 2: El Mozo / Toma de Pedido (En Progreso)
- [x] **Interfaz Salón**: Selector de mesa dinámico con estados visuales.
- [x] **Interfaz Pedido**: Panel POS con categorías de menú cargado.
- [x] **Comensales**: Registro de cubiertos (PAX) al abrir mesa.
- [x] **Comandas**: Lógica de envío de pedido a puestos de trabajo (Cocina/Bar) e integración con estadísticas de tiempos. (¡LISTO!)

## 🍳 Fase 3: Cocina y Barra
- [x] **Display de Cocina**: Lista de pedidos finales por plato (Estilo Premium Glassmorphism).
- [x] **Display de Bar**: Lista de bebidas pendientes integrada.
- [x] **Aviso de Listo**: Notificación en tiempo real (Toasts) al mozo cuando el plato sale de cocina.

---

## 🚀 Próximas Mejoras y Funcionalidades (Para Mañana)

### 1. Búsqueda y Favoritos (UX)
- [x] Agregar una **barra de búsqueda rápida** de productos en el POS.
- [ ] Implementar una categoría de **"Lo más pedido"** que se autocompleta con los items más exitosos del menú.

### 2. Gestión de Mesas Avanzada
- [ ] **Cambio de Mesa**: Botón para transferir una comanda entera de una mesa a otra. (Botón UI listo)
- [ ] **Dividir Cuenta**: Funcionalidad para cobrar por separado a comensales de la misma mesa. (Botón UI listo)
- [ ] **Unir Mesas**: Funcionalidad para que dos mesas compartan la misma comanda.

### 3. Notificaciones en Tiempo Real (Toasts)
- [x] Sistema de avisos flotantes cuando Cocina marque un plato como "Listo", para que el mozo reciba la alerta sin refrescar manualmente.

### 4. Pre-Ticket (Snapshot Printing)
- [x] Implementar la generación de la **Pre-Cuenta** usando el método de *Snapshot & Iframe* (limpio, sin barras de navegación) para imprimir en ticketeras térmicas.

### 5. Interfaz de Cocina Premium
- [x] Llevar la misma estética *Glassmorphism* a la pantalla de Cocina para que todo el ecosistema se sienta de primer nivel.

---

## 🛠️ Especificaciones Técnicas
- **Frontend**: Vanilla JS + `fetchApi`.
- **Estilos**: `resto_mozo.css` (Externo).
- **Backend**: Blueprint Flask (`resto_routes.py`).
- **Database**: PostgreSQL (Neon).
