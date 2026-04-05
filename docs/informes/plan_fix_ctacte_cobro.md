# Plan de Implementación: Corrección de error 500 en Registro de Cobros (Cta Cte)

El usuario reporta un error 500 al intentar registrar un pago parcial/mixto en el módulo de Cuenta Corriente. El análisis de los logs indica un `Error: 0`, lo cual sugiere un `KeyError: 0` en el backend al intentar acceder a los resultados de una consulta SQL de forma posicional, lo cual no es compatible con el cursor de diccionarios usado en Producción (PostgreSQL).

## Revisión del Usuario Requerida

> [!IMPORTANT]
> - Se corregirá el acceso a los datos de la base de datos para asegurar compatibilidad total entre entornos (Desarrollo/Producción).
> - Se normalizará el flujo de permisos para evitar el mensaje de "Acceso no autorizado" en la consola cuando se accede directamente vía hash.

## Diagrama de Flujo (Mermaid)

```mermaid
graph TD
    A[Usuario envía Cobro] --> B[Backend: registrar_cobro]
    B --> C[Fetch Nro Interno: MAX]
    C --> D{¿Acceso por [0]?}
    D -- SQLi / PG Dict -- E[Fallo: KeyError 0]
    E --> F[Respuesta 500 -> Cliente ve Error: 0]
    D -- Corregido con Alias -- G[Éxito: Registro en Ventas y CC]
    G --> H[Confirmación al Usuario]
```

## Cambios Realizados

### Backend (Python/Flask)

#### [ctacte_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/ctacte_routes.py)
- Se corrigieron los accesos a `MAX(numero_interno)` en `registrar_cobro`.
- Se implementaron alias SQL y acceso por nombre de columna para evitar fallos en PostgreSQL.

### Frontend (JavaScript)

#### [main.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/main.js)
- Se añadió `cobro_ctacte` a los permisos por defecto.
- Se habilitó la inicialización dinámica del módulo.

#### [erp_registry.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/erp_registry.js)
- Se normalizó el identificador `cobro_ctacte`.

## Verificación Final
- El usuario confirmó exitosamente el registro de un cobro de $100 mediante captura de pantalla.
