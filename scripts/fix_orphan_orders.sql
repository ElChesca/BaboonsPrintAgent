-- SCRIPT PARA ASOCIAR PEDIDOS HUÉRFANOS A SUS HOJAS DE RUTA ACTIVAS
-- Este script busca pedidos con hoja_ruta_id nulo e intenta vincularlos
-- basándose en si el cliente está en una ruta activa del mismo vendedor.

-- 1. Verificación previa (Simulacro):
-- SELECT p.id, p.cliente_id, p.vendedor_id, hr.id as hr_encontrada
-- FROM pedidos p
-- JOIN hoja_ruta_items hri ON p.cliente_id = hri.cliente_id
-- JOIN hoja_ruta hr ON hri.hoja_ruta_id = hr.id
-- WHERE p.hoja_ruta_id IS NULL
--   AND hr.estado = 'activa'
--   AND p.vendedor_id = hr.vendedor_id;

-- 2. Ejecución de la corrección:
UPDATE pedidos p
SET hoja_ruta_id = subquery.hr_id
FROM (
    SELECT hri.hoja_ruta_id as hr_id, hri.cliente_id, hr.vendedor_id, hr.negocio_id
    FROM hoja_ruta_items hri
    JOIN hoja_ruta hr ON hri.hoja_ruta_id = hr.id
    WHERE hr.estado = 'activa'
) as subquery
WHERE p.hoja_ruta_id IS NULL
  AND p.cliente_id = subquery.cliente_id
  AND p.vendedor_id = subquery.vendedor_id
  AND p.negocio_id = subquery.negocio_id;

-- NOTA: Si un cliente pertenece a dos rutas simultáneas (AM/PM), 
-- este script asociará el pedido a la primera que encuentre.
