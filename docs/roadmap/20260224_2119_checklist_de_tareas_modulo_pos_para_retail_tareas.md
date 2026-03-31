# Checklist de Tareas - Módulo POS para Retail

## Planificación
- [x] Investigar el módulo de Ventas actual y la estructura de la UI <!-- id: 0 -->
- [x] Diseñar la interfaz POS para comida rápida (grilla, cobro rápido) <!-- id: 1 -->
- [x] Crear plan de implementación <!-- id: 2 -->

## Desarrollo - Backend
- [x] Verificar/Crear endpoints de API necesarios para POS <!-- id: 3 -->
- [x] Asegurar soporte para el tipo de pago Mercado Pago <!-- id: 4 -->

## Desarrollo - Frontend
- [x] Crear `app/static/pos.html`
- [x] Crear `app/static/css/pos.css`
- [x] Crear `app/static/js/modules/pos.js` <!-- id: 5 -->
- [x] Implementar UI de POS (grilla de productos, botones de cobro rápido) <!-- id: 6 -->
- [x] Integrar con `main.js` y `ui.js` <!-- id: 7 -->

## Integración y Permisos
- [x] Registrar el módulo `pos` en la tabla `modules` <!-- id: 11 -->
- [x] Agregar `pos` a la UI de `Admin Apps` <!-- id: 12 -->
- [x] Habilitar `pos` para negocios Retail en `type_permissions` <!-- id: 13 -->

## Refinamiento y Personalización
- [x] Eliminar logo excesivo del encabezado POS <!-- id: 14 -->
- [x] Ajustar layout del encabezado para que sea compacto <!-- id: 15 -->
- [x] Cargar productos específicos de "Re Pancho" en la DB <!-- id: 16 -->
- [x] Ajustar `pos.js` para manejar mejor la carga inicial sin productos <!-- id: 17 -->

## Verificación Final
- [x] Verificar que los productos de Re Pancho aparezcan en la grilla <!-- id: 18 -->
- [x] Verificar estética general del encabezado <!-- id: 19 -->

## Módulos por Negocio (Fase 2)
- [x] Diseñar esquema de base de datos para exclusiones por negocio <!-- id: 20 -->
- [x] Crear endpoints en el backend para gestionar configuración por negocio <!-- id: 21 -->
- [x] Implementar filtro dinámico en `main.js` basado en configuración del negocio <!-- id: 22 -->
- [x] Agregar interfaz de gestión en "Admin Apps" <!-- id: 23 -->
- [x] Verificar ocultamiento de módulos en "Re Pancho" (CRM, Inventario Móvil) <!-- id: 24 -->

- [x] **Fase 3: Imágenes de Productos y Mejoras POS**
    - [x] Diseñar sistema de almacenamiento persistente (Volumen Fly.io)
    - [x] Implementar backend para subida y compresión (Pillow -> WebP)
    - [x] Actualizar Inventario: Modal con subida y preview
    - [x] Actualizar POS: Mostrar imágenes y usar Alias
    - [x] Verificar persistencia y compresión
    - [x] Documentar cambios realizados

- [x] **Fase 4: Restauración de Accesos Super Admin**
    - [x] Verificar rol y estado del usuario 7 en la DB -> Cambiado de 'admin' a 'superadmin'
    - [x] Investigar lógica de filtrado de negocios y módulos -> Verificado bypass en backend
    - [x] Verificar restauración de accesos -> Se recomienda re-login al usuario

- [x] **Fase 5: Pulido Estético POS**
    - [x] Centrar productos en la grilla
    - [x] Ajustar padding y espaciados de tarjetas
    - [x] Mejorar visualización de carga (ajustado backend para rapidez)

- [x] **Fase 6: Integración Mercado Pago Point**
    - [x] Crear plan de integración detallado
    - [x] Implementar sección de configuración de MP en el admin
    - [x] Crear servicio base para API de Mercado Pago
    - [x] Añadir botón de activación en el POS
    - [x] Implementar simulador de órdenes (v1/orders) para testeo sin hardware
    - [x] Validar persistencia de credenciales

- [x] **Fase 8: Corrección de Idempotencia y Estabilidad**
    - [x] Agregar `X-Idempotency-Key` a las peticiones de MP
    - [x] Corregir estructura de payload de órdenes (v1/orders) - *Nueva estructura aplicada*
    - [ ] Verificar creación de órdenes en modo simulación
    - [ ] Confirmar flujo completo de cobro simulado
