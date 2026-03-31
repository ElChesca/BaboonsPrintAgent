# Resumen de Mejoras: Hojas de Ruta y Entornos

Se han implementado funcionalidades clave para optimizar el trabajo de los repartidores y la gestión administrativa, además de estandarizar la infraestructura.

## 🚀 Nuevas Funcionalidades

### 1. Pago Mixto (Efectivo + Mercado Pago)
Ya es posible cobrar un pedido combinando ambos métodos. El sistema calcula automáticamente la diferencia y genera dos registros de venta independientes para mantener la integridad de los reportes de caja.

### 2. Auto-scroll en Modo Repartidor
Al abrir el "Modo Repartidor", la lista se desplaza automáticamente hasta el primer pedido pendiente, ahorrando tiempo al chofer.

### 3. Columna "Por Cobrar"
En la tabla principal de Hojas de Ruta, ahora aparece una columna que indica cuántos pedidos faltan entregar/cobrar en cada ruta, permitiendo un monitoreo rápido del progreso.

## 🏗️ Infraestructura y Documentación

### Entorno de Desarrollo Persistente
- Se configuró la aplicación `multinegociobaboons-dev` en Fly.io con un volumen persistente para la base de datos SQLite.
- Los datos de prueba realizados en `/data/inventario.db` ahora persistirán a través de reinicios y despliegues.

### Guía de Arquitectura
Se crearon archivos de referencia obligatoria para proteger la integridad del proyecto:
- [ARQUITECTURA_ENTORNOS.md](./ARQUITECTURA_ENTORNOS.md): Detalla la lógica entre producción (Postgres) y desarrollo (SQLite).
- [README.md](./README.md): Punto de entrada con advertencias críticas para futuras sesiones con IA.

## ✅ Verificación Realizada
- Despliegue exitoso al entorno de desarrollo.
- Validación de logs de inicio y conexión a la base de datos.
- Ajustes en el frontend para cálculo dinámico de la columna "Por Cobrar".

---
**Próximos Pasos (Mañana):**
- Pruebas del flujo completo de entrega con pago mixto en el entorno de dev.
- Verificación de reportes de venta tras cobros mixtos.
