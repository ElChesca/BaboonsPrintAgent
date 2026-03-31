[Plan de Implementación]
# Implementación de Módulo Cobranza Cta Cte - Fase de Corrección

## Propósito
Este documento detalla el plan para la implementación, reubicación y corrección del módulo de cobranza de cuenta corriente en la aplicación Multinegocio Baboons.

## Cambios Propuestos

### Backend
#### admin_routes.py
- Se añadió `cobro_ctacte` a las listas de permisos por defecto para asegurar que el módulo sea visible y persistente.

### Frontend
#### cobro_ctacte.js
- Se refactorizó para ser compatible con el SPA.
- Se agregaron las importaciones de `fetchData` y `sendData`.

#### rules.md
- Se añadió la regla obligatoria de registro de módulos en el catálogo administrativo.

## Plan de Verificación
1. Verificación de permisos en Admin Apps.
2. Pruebas de búsqueda y registro de cobros.
3. Validación de integridad de datos en DB.
