# Plan de Seguridad y Estabilidad de Sistema (Fly.io Ready)

Este documento detalla las medidas de seguridad para la autenticación y la registración de eventos, además de la automatización de la caché para despliegues en Fly.io.

## User Review Required

> [!IMPORTANT]
> - **Auto-Actualización**: Se implementa lógica de `skipWaiting` y recarga automática en el frontend al detectar una nueva versión tras un `fly deploy`.
> - **Registro de Módulos**: Se configuró el auto-seed para los módulos `eventos` y `resto_stats`.

## Proposed Changes

```mermaid
graph TD
    A[Public URL /eventos/slug] --> B[eventos_routes.py]
    B --> C{Check Honeypot}
    C -- Bots --> D[Reject 400]
    C -- Users --> E[Validate Email]
    E --> F[Register Participant]
    
    G[Fly.io Deploy] --> H[New Service Worker]
    H --> I[programmatic Update]
    I --> J[Auto-refresh Frontend]
```

### [Backend]

#### [MODIFY] admin_routes.py
- Se añade auto-seeding para los módulos `eventos` y `resto_stats`.

#### [MODIFY] eventos_routes.py
- Implementación de slugs virtuales y honeypot anti-bots.

### [Frontend]

#### [MODIFY] service-worker.js
- Upgrade a versión 1.6.0.
- Lógica de `self.skipWaiting()` en evento de instalación.

#### [MODIFY] main.js
- Exposición global de `fetchData` y `sendData`.
- Listener de actualización de Service Worker con notificación y recarga.
