-- 1. Eliminar la restricción de llave foránea incorrecta (apuntaba a usuarios)
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_vendedor_id_fkey;

-- 2. Limpiar o mapear datos existentes si es necesario (Opcional, previene errores de FK)
-- Si hay pedidos hechos por admins, el vendedor_id podría quedar en NULL o asignarse a un vendedor genérico.
-- UPDATE pedidos SET vendedor_id = NULL WHERE vendedor_id NOT IN (SELECT id FROM vendedores);

-- 3. Crear la nueva restricción apuntando a la tabla 'vendedores'
ALTER TABLE pedidos 
ADD CONSTRAINT pedidos_vendedor_id_fkey 
FOREIGN KEY (vendedor_id) REFERENCES vendedores(id);

-- 4. Verificar consistencia en la tabla 'pedidos_detalle' (Por seguridad)
-- ALTER TABLE pedidos_detalle DROP CONSTRAINT IF EXISTS pedidos_detalle_pedido_id_fkey;
-- ALTER TABLE pedidos_detalle ADD CONSTRAINT pedidos_detalle_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE;
