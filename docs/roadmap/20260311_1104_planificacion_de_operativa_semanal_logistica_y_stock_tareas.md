# Planificacion de Operativa Semanal Logistica y Stock
## Planificación y Análisis
- [x] Analizar la consistencia de `vendedor_id` en la base de datos
- [x] Diseñar el plan de corrección de esquema y lógica de negocio
- [x] Esperar aprobación del [plan de implementación](file:///C:/Users/usuario/.gemini/antigravity/brain/d23511aa-ad6c-46dc-adee-8ad260950f62/implementation_plan.md)

## Mejoras de UX y Funcionalidad
- [x] Implementar los cambios en `auth_routes.py` y `pedidos_routes.py`
- [x] Aplicar corrección de FK en la base de datos (Ejecutado por Usuario)
- [x] Integrar Creación de Pedidos directamente desde la Hoja de Ruta en `hoja_ruta.js`

## Mejoras de Funcionalidad
- [x] Implementar Stock Virtual (Negativo) y Promesas de Entrega
- [x] Refactorizar visor de "Consolidado" para mostrar faltantes
- [x] Profesionalizar modulo de Historial de Inventario (UI/UX + Bug Fix)
- [x] Configurar Horario de Argentina (ART) globalmente
- [x] Implementar Auditoría de Stock en Edición Manual (Ajustes)
- [x] Unificar creación de Vendedores y Usuarios
- [x] Corregir ancho de campo "Cantidad" en modal de pedidos

## Mejoras de Seguridad
- [x] Implementar cierre de sesión por inactividad
- [x] Validar expiración de token JWT en el inicio de la app
- [x] Centralizar gestión de sesión en `auth.js`

## Verificación y Calidad
- [ ] Generar [walkthrough](file:///C:/Users/usuario/.gemini/antigravity/brain/d23511aa-ad6c-46dc-adee-8ad260950f62/walkthrough.md) de cambios
- [ ] Validar integridad de `vendedor_id` en la DB (Verificado post-migración)

## Mantenimiento
- [ ] Revisión de logs en Fly.io para detectar anomalías post-despliegue

## Fase 2: Operativa y Logística
- [x] Implementar Liquidación de Hoja de Ruta (Resumen de Cierre)
- [x] Implementar Exportación de PDF para Liquidación de Ruta (Cierre del Vendedor)
- [x] Implementar Exportación de PDF para Depósito (Picking List)
- [x] Mejorar visualización de Historial del Cliente (Estados, Vendedores y # de HR)
- [x] Botón de "Compartir por WhatsApp" en Pedidos
- [ ] Mostrar Saldo Deudor del Cliente en Hoja de Ruta

## Fase 3: Logística Avanzada y Flota
- [x] Implementar ABM de Vehículos (Patente, Modelo, Capacidad Kg/m3)
- [x] Agregar Metadata de Carga a Productos (Peso y Volumen)
- [x] Vincular Camión a Hoja de Ruta
- [x] Implementar Indicador de Ocupación en Vivo (Carga vs Capacidad)
- [x] Alertas de Sobrecarga en Hoja de Ruta
- [x] Corregir Inicialización y Estilos (logistica.js/css/main.js)
- [x] Aplicar [Script de Migración](file:///C:/Users/usuario/Documents/MultinegocioBaboons/migrations/add_logistica_camiones.sql) (Ejecutado por Usuario)
- [x] Re-ubicar selección de Vehículo al momento de Confirmar Reparto (Picking)
- [x] Corregir visualización de Mapa en Hoja de Ruta (Solucionar Mapa en Blanco)
- [x] Implementar Reporte de Entregas (Logística)
- [x] Enriquecer Reporte de Entregas (Pedidos Totales/Entregados y Kilos)
- [ ] Implementar Integración con Pedidos desde Hoja de Ruta
- [x] Evitar duplicación de Clientes (Bloqueo de botón + Validación Backend)
