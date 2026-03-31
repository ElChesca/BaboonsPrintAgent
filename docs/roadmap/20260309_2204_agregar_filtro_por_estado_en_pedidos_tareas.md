# Agregar Filtro por Estado en Pedidos

- [x] Analizar el HTML y JS de `pedidos` para entender dónde agregar el filtro y cómo mostrar los días en estado.
- [x] Encontrar el endpoint de backend que retorna los pedidos (`GET /api/negocios/<id>/pedidos`).
- [x] Modificar el modelo/SQL en backend para incluir los días que lleva un pedido en su estado actual (calcular usando `fecha_actualizacion` o `fecha`).
- [x] Modificar `app/routes/pedidos_routes.py` y actualizar queries.
- [x] Modificar `app/static/pedidos.html` para incluir el `<select id="filtro-estado-pedidos">`.
- [x] Modificar `app/static/js/modules/pedidos.js` para enviar el filtro de estado al backend y renderizar la cantidad de días en el estado.
- [x] Verificar que todo funcione correctamente.
