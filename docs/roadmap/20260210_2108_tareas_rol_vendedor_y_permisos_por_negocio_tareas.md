# Tareas: Rol Vendedor y Permisos por Negocio

## 1. Investigación y Diseño
- [x] Investigar esquema de base de datos (`users`, `type_permissions`, `modules`)
- [x] Definir nuevo esquema para permisos por rol/negocio
- [x] Crear plan de implementación

## 2. Cambios en Base de Datos
- [x] Crear migraciones para nuevas tablas de permisos o modificaciones
- [x] Ejecutar migraciones

## 3. Backend
- [x] Actualizar modelos de usuario si es necesario
- [x] Implementar lógica de verificación de permisos por usuario/rol
- [x] Crear endpoints para gestionar permisos de vendedores por negocio

## 4. Frontend (Administración)
- [x] Actualizar pantalla de usuarios para permitir rol "Vendedor"
- [x] Crear interfaz para que el admin del negocio elija a qué apps accede el vendedor
- [x] Actualizar `main.js` para cargar estos permisos dinámicos

## 5. Verificación (Vendedor)
- [x] Crear un usuario vendedor (Manual)
- [x] Asignar permisos específicos (Manual)
- [x] Verificar que solo vea los módulos permitidos (Manual)

## 6. Ampliación Gestión de Usuarios
- [x] Agregar columna `activo` a la tabla `usuarios`
- [x] Endpoint para desactivar/activar usuarios
- [x] Endpoint para cambio de contraseña por administrador
- [x] Actualizar UI (botones de eliminar y modal de contraseña)
- [x] Verificar desactivación en el login

## 7. Corrección de Acceso y Navegación Vendedor
- [x] Permitir acceso automático al Home del negocio en `main.js`
- [x] Implementar filtrado dinámico del menú de navegación
- [x] Implementar filtrado dinámico de "Tarjetas/Apps" en los Dashboards
- [x] Mejorar pantalla "Acceso Denegado" con botón de retorno al Inicio
- [x] Verificar que el Vendedor solo vea sus módulos autorizados

## 9. Hoja de Ruta "Pro"
- [x] Rediseñar modal de creación (Split Map/List)
- [x] Implementar lógica de reordenamiento de paradas
- [x] Integrar selección de clientes desde el mapa en el modal
- [x] Pulir estética visual (estilo Distribuidora Pro)
- [x] Corregir/Validar datos de Vendedores
- [x] Implementar Autocompletado profesional en búsqueda de clientes

## 10. Evolución Geo Pro: Fase 1
- [x] Migración: Añadir `fecha_visita` a `hoja_ruta_items`
- [x] Backend: Integrar lógica de `tiene_venta` en detalle de HR
- [x] Backend: Registrar `fecha_visita` al marcar como visitado
- [x] Frontend: Marcadores dinámicos (Verde/Naranja/Azul)
- [x] Frontend: Mostrar hora de visita en tabla
- [x] Verificar flujo completo

- [x] Frontend: Guardar cambios (PUT) y refrescar

## 12. Evolución Geo Pro: Fase 2 (Confirmación y Estados)
- [x] Backend: Endpoint `PUT /hoja_ruta/<id>/estado` para cambiar a 'activa' o 'finalizada'
- [x] Frontend: Botón "Confirmar Reparto" en el detalle de la HR
- [x] Debug: Asegurar que `hoja_ruta` cargue por defecto al entrar
- [x] Frontend: Badge de estado dinámico y bloqueo de edición si no es borrador

## 13. Evolución Geo Pro: Fase 3 (Vista Global y Fix de Fechas)
- [x] Backend: Formatear `fecha` como string `YYYY-MM-DD` en todos los endpoints
- [x] Frontend: Quitar filtro de fecha por defecto para mostrar "Todas"
- [x] Frontend: Corregir renderizado de fecha para evitar "undefined"
- [x] Frontend: Añadir botón para "Limpiar Filtro" de fecha

## 14. Evolución Geo Pro: Fase 4 (Módulo de Pedidos)
- [x] Base de Datos: Crear tablas `pedidos` y `pedidos_detalle`
- [x] Backend: Crear `pedidos_routes.py` con CRUD básico y vinculación a HR
- [x] Frontend: Crear modal de "Carga Rápida de Pedido" en el detalle de la HR
- [x] Frontend: Integración con el Mapa para mostrar clientes con pedidos pendientes
