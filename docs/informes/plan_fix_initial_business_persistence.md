# Plan: Fix de Persistencia de Tipo de Negocio

Este plan soluciona el problema de carga inicial incorrecta para negocios tipo **Resto**. Al asegurar que el tipo de negocio se guarde en `localStorage`, el sistema puede cargar el home correspondiente (`#home_resto`) sin pasar por el home de retail un segundo.

## Cambios Realizados

### [Frontend]
- **main.js**: Guardar `negocioActivoTipo` en `localStorage` al seleccionar un negocio y al cargar la lista inicial.
- **main.js**: Actualizar `actualizarUIAutenticacion` para que el `defaultHomePage` incluya la lógica de Resto.
- **main.js**: Actualizar la red de seguridad `esCualquierHome` con `#home_resto`.

## Verificación
- Prueba de inicio de sesión con negocio Resto.
- Prueba de recarga (F5) para validar la persistencia.
