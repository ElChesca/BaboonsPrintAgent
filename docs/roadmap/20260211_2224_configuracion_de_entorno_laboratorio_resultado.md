# Configuración de Entorno Laboratorio

Se ha configurado un entorno aislado en Fly.io para pruebas de desarrollo.

## Cambios Realizados
1.  **Infraestructura**: Creación de app `multinegociobaboons-dev` con base de datos Postgres.
2.  **Sincronización**: Aplicación de esquema base limpio y seeding de usuario `admin`.
3.  **Corrección Crítica**: Se resolvió un error 401 Unauthorized persistente causado por una discrepancia en la clave secreta (`SECRET_KEY`) entre la generación y validación de tokens.

## Verificación de Login
- **URL**: [https://multinegociobaboons-dev.fly.dev/](https://multinegociobaboons-dev.fly.dev/)
- **Usuario**: `admin`
- **Password**: `admin123`

### Resolución Técnica
Se detectaron tres problemas críticos que afectaban la experiencia de usuario:
1.  **Clave Secreta**: Discrepancia en `SECRET_KEY` entre el login y la validación de tokens.
2.  **Ruteo de Home**: Redirección forzada a `#home_distribuidora` para negocios de distribución.
3.  **Error en Pedidos (Consolidado)**: El botón "Consolidado" arrojaba un error de JavaScript porque faltaba la estructura del Modal en el HTML.

**Solución**:
- Se estandarizó el uso de `current_app.config['SECRET_KEY']`.
- Se implementó la **redirección forzada** en `main.js`.
- **Automatización Contable**: Al marcar un pedido como "Entregado", el sistema genera automáticamente una Venta y un movimiento de Deuda.
- **Corrección de Datos**: Fix de `vendedor_id` y limpieza de tablas para un inicio consistente.
- **Robustez UI**: Solucionado el problema del mapa persistente y la pantalla en blanco al loguearse.
- **Mensajes de Error**: Ahora el sistema avisa claramente si la caja está cerrada o si falta stock.
- **Preferencias**: Se creó `preferencias_usuario.md` para resguardar las reglas de manejo de DB.

---
**ESTADO**: Todo desplegado y verificado en **Producción**. Listos para pruebas reales mañana. 🚀

*El sistema ahora liquida automáticamente los pedidos entregados en la cuenta corriente del cliente.*
