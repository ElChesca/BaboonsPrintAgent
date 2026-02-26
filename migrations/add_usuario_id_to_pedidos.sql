-- Migración: Añadir usuario_id a pedidos para trackear al creador
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id);

-- Intentar poblar datos existentes cruzando email si es posible, 
-- pero lo más seguro es poner el usuario_id del primer admin si es null y no hay vendedor_id.
-- O simplemente dejarlo para nuevos registros.

-- Si el vendedor_id existe, podemos intentar buscar el usuario vinculado por email
UPDATE pedidos p
SET usuario_id = u.id
FROM vendedores v
JOIN usuarios u ON v.email = u.email
WHERE p.vendedor_id = v.id AND p.usuario_id IS NULL;
