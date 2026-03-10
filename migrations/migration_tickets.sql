-- migration_tickets.sql
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS email_contacto TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS recibir_notificaciones BOOLEAN DEFAULT TRUE;
