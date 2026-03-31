# Liquidación de Comisiones de Vendedores

## Fase 1: Planificación y Análisis de Base de Datos
- [x] Analizar esquema actual de `ventas`, `pedidos` y `usuarios` (vendedores).
- [x] Diseñar nuevas tablas para Reglas de Comisión (`comisiones_reglas`) y Liquidaciones (`comisiones_liquidaciones`).
- [x] Definir cómo marcar las ventas como liquidadas (`venta.liquidacion_id`).
- [x] Completar y aprobar el `implementation_plan.md`.

## Fase 2: Backend (Base de Datos y API)
- [x] Crear script de migración SQL para las nuevas tablas y columnas.
- [x] Implementar modelo y endpoints para gestionar Reglas de Comisión (CRUD).
- [x] Implementar lógica de cálculo de comisiones (filtrado de ventas no liquidadas basados en reglas y fechas).
- [x] Implementar endpoint API para asentar una liquidación (crear registro y actualizar ventas).

## Fase 3: Frontend (Panel de Administración)
- [x] Crear pantalla `Reglas de Comisión`. (Configuración General del Negocio y overrides por Vendedor).
- [x] Crear pantalla `Liquidación de Comisiones` (Seleccionar Vendedor, Rango de Fechas, previsualizar ventas aplicables y liquidar).
- [x] Integrar enlaces al nuevo módulo en el menú del administrador.

## Fase 4: Control Global y Documentación (ADMIN RULES)
- [x] Registrar el módulo `comisiones` en el sistema de auto-seeding de Admin Apps (`admin_routes.py`).
- [x] Crear el manual de usuario (`manual_comisiones_vendedores.md`) en la raíz siguiendo las reglas de `organizar_docs.py`.
- [x] Configurar categoría y etiquetas para el manual en el sistema de documentación.

## Fase 5: Verificación y Finalización
- [x] Probar el flujo completo: asignar reglas, generar ventas de prueba (contado vs cuenta corriente) y liquidar.
- [x] Confirmar que el módulo ahora se puede habilitar/deshabilitar desde el Panel de Admin Apps.
- [x] Ejecutar `organizar_docs.py` (o simular su efecto) para asegurar que el manual sea visible.
- [x] Generar la documentación `walkthrough.md`.
