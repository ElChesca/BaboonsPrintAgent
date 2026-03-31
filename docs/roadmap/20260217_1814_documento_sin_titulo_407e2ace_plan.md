# Plan de ImplementaciÃ³n - App del Vendedor (MÃ³vil)

El objetivo es proporcionar una interfaz dedicada y amigable para mÃ³viles para que los vendedores gestionen sus hojas de ruta diarias (asignadas por administradores) y creen pedidos mientras visitan a los clientes.

## RevisiÃ³n del Usuario Requerida

> [!IMPORTANT]
> **Permisos de Ruta**: La creaciÃ³n de `Hoja de Ruta` serÃ¡ exclusiva para **Administradores**. Los vendedores NO podrÃ¡n crear rutas, solo ver las asignadas.
> **Visibilidad de Clientes**:
>   1. **Vendedores**: Solo verÃ¡n sus propios clientes en la App.
>   2. **Administradores**: Al crear una ruta, al seleccionar un vendedor, la lista de clientes se filtrarÃ¡ para mostrar SOLO los asignados a ese vendedor.
> **Aislamiento de Datos**: ReforzarÃ© que los usuarios con rol `vendedor` SOLO puedan ver sus propias rutas y pedidos en la API del backend.

## Cambios Propuestos

### Backend (`app/routes/`)

#### [MODIFY] [distribucion_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/distribucion_routes.py)
- `create_hoja_ruta`: Restringir acceso solo a roles `admin` o `superadmin`.
- `get_hojas_ruta`: Si es 'vendedor', forzar `vendedor_id = current_user['vendedor_id']` y ocultar borradores (o mostrar solo activas/finalizadas).
- `get_hoja_ruta_detail`: Verificar propiedad de la ruta si es vendedor.

#### [MODIFY] [clientes_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/clientes_routes.py)
- `get_clientes`:
    - Agregar soporte para parÃ¡metro `vendedor_id` en `request.args` para filtrar por vendedor especÃ­fico (Ãºtil para admins).
    - Detectar si `current_user` es vendedor. En ese caso, **forzar** el filtro `WHERE vendedor_id = current_user['vendedor_id']`.

#### [MODIFY] [pedidos_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/pedidos_routes.py)
- `get_pedidos`: Forzar filtro `vendedor_id` si el usuario es vendedor.

### Frontend (`app/templates/` & `app/static/`)

#### [NEW] [seller.html](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/templates/seller.html)
- Vista simplificada para ejecuciÃ³n de ruta.
- **Sin botÃ³n de "Crear Ruta"**.
- Lista de paradas de la ruta activa.
- Acciones: "Ver Mapa", "Marcar Visita", "Crear Pedido".

#### [NEW] [seller.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/seller.js)
- Fetch de ruta activa del dÃ­a.
- LÃ³gica de pedidos restringida al contexto de la visita.

#### [MODIFY] [hoja_ruta.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/hoja_ruta.js)
- En el modal de "Nueva Hoja de Ruta" (Admin):
    - Escuchar cambios en el select de `vendedor`.
    - Al cambiar el vendedor, recargar o filtrar la lista de clientes (`clientesCache`) para mostrar solo los de ese vendedor.

## Plan de VerificaciÃ³n

### Pruebas Automatizadas
- EjecutarÃ© las pruebas existentes para asegurar que no haya regresiones.
- VerificarÃ© las respuestas de la API usando scripts de python.

### VerificaciÃ³n Manual
1.  **Seguridad Backend**:
    - Iniciar sesiÃ³n como vendedor.
    - Intentar obtener todas las rutas (solo deberÃ­a ver las propias).
    - Intentar obtener la ruta de otro vendedor por ID (deberÃ­a recibir 403 o 404).

2.  **Flujo Frontend**:
    - Abrir `seller.html`.
    - Verificar que carga "Mi Ruta".
    - Click en un cliente -> "Tomar Pedido".
    - Agregar items, Guardar.
    - Verificar que el Pedido aparece en `pedidos.html` (vista admin) y actualiza el estado de la ruta.

## Linking Feature (Employee Integration)

### Database
#### [NEW] [migrations/add_empleado_id_to_users.sql](file:///c:/Users/usuario/Documents/MultinegocioBaboons/migrations/add_empleado_id_to_users.sql)
- Add `empleado_id` column to `usuarios` table.

### Backend
#### [MODIFY] [app/routes/empleados_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/empleados_routes.py)
- Update `create_empleado` to accept optional `existing_user_id` or `existing_seller_id`.
- If provided, link the new employee to the existing record instead of creating a new one.
- Handle potential conflicts (e.g., user already linked).

### Backend Support
#### [MODIFY] [app/routes/usuarios_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/usuarios_routes.py) (or creating new endpoint)
- Create endpoint to get "Unlinked Users" (users who don't have an `empleado_id`).

### Frontend
#### [MODIFY] [app/static/empleados.html](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/empleados.html)
- Add checkbox/switch "Vincular Usuario/Vendedor Existente".
- Show dropdown of available users/sellers (filtered by role and unlinked status) when checked.

#### [MODIFY] [app/static/js/modules/empleados.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/empleados.js)
- Fetch unlinked users and sellers.
- Handle UI toggle for linking.
- Send correct payload to backend (e.g., `link_to_user_id`, `link_to_seller_id`).

## Optimización de Hoja de Ruta

### [MODIFY] [hoja_ruta.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/hoja_ruta.js)
- **Carga de Clientes**: Eliminar carga inicial masiva. Cargar clientes solo al seleccionar vendedor usando 'select.onchange'.
- **Botón Optimizar**: Implementar función 'optimizarRuta()' usando algoritmo Nearest Neighbor (Vecino Más Cercano) con coordenadas de clientes.
- **Ruta Temporal**: Asegurar que los objetos en 'rutaTemporal' incluyan 'lat' y 'lng'.

### [MODIFY] [hoja_ruta.html](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/hoja_ruta.html)
- Agregar botón 'Optimizar' en el panel de creación de ruta.
