# Plan de Implementación - Fotos de Productos y Mejoras POS

Este plan detalla cómo permitir la subida de fotos de productos desde el inventario y su visualización en el módulo POS, utilizando el campo "Alias" y optimizando el almacenamiento.

## User Review Required
> [!IMPORTANT]
> Las imágenes se almacenarán en el volumen persistente existente de Fly.io (`/app/app/static/img/premios/productos`) para asegurar que no se borren en cada despliegue.

## Cambios Propuestos

### 1. Base de Datos
Añadir la columna `imagen_url` a la tabla `productos`.

```sql
ALTER TABLE productos ADD COLUMN IF NOT EXISTS imagen_url TEXT;
```

### 2. Backend (Python)
#### [MODIFICAR] [product_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/product_routes.py)
- Añadir un nuevo endpoint `POST /api/productos/<id>/upload-image`.
- Usar **Pillow** para:
  - Redimensionar la imagen (ej: máx 500x500px).
  - Comprimir (calidad 85% JPEG o WebP) para optimizar el tamaño.
- Guardar la imagen en `app/static/img/premios/productos/`.

### 3. Frontend (Inventario)
#### [MODIFICAR] [inventory.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/inventory.js)
- Actualizar el modal de Agregar/Editar producto para incluir un campo `<input type="file" accept="image/*">`.
- Mostrar una previsualización de la imagen seleccionada.
- Implementar la lógica para enviar la imagen al nuevo endpoint tras guardar el producto.

### 4. Frontend (POS)
#### [MODIFICAR] [pos.html](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/pos.html) y [pos.css](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/css/pos.css)
- Adaptar las tarjetas de productos para mostrar la imagen.
- Usar un diseño de "card" más visual.

#### [MODIFICAR] [pos.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/pos.js)
- Mostrar el campo `alias` si existe, de lo contrario usar el `nombre`.
- Cargar la `imagen_url` y mostrarla en la tarjeta del producto.
- Mostrar el precio de venta de forma prominente.

## Plan de Verificación

### Manual
1. **Subida**: Ir a Inventario, editar un producto, elegir una foto y guardar. Verificar que la imagen se vea en el listado/modal.
2. **POS**: Ir al POS ("Caja Rápida"). Verificar que el producto aparezca con su foto, el alias (ej: "Súper Pancho") y el precio correcto.
3. **Persistencia**: (Solo en producción) Subir una imagen, hacer un despliegue y verificar que la imagen siga allí.
