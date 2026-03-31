# Resultado Final: Fix de Landing de Eventos (API)

Se ha corregido el error de carga de datos en la Landing de Eventos.

## Cambios Implementados

1.  **Backend (`eventos_routes.py`)**:
    -   Se restauró el prefijo `/api` a los puntos de acceso públicos:
        -   `GET /api/public/eventos/<id>`
        -   `POST /api/public/eventos/<id>/inscribir`
    -   Esto asegura la compatibilidad con el código JavaScript de la plantilla `eventos_landing.html`.

2.  **Infraestructura**:
    -   Despliegue exitoso en **Fly.io**.

## Verificación
-   La URL `/landing/<slug>` ya no muestra el popup de error y carga correctamente el título y detalles del evento desde la base de datos.
