# Guía de Comandos y Migraciones en Fly.io

Esta guía detalla cómo ejecutar comandos de mantenimiento y migraciones de base de datos en el entorno de producción de Fly.io, y cómo solucionar problemas comunes de terminal.

## 🚀 Ejecutar Migraciones de Base de Datos

Para aplicar cambios en el esquema de la base de datos (como nuevas columnas para anuncios), utiliza el comando personalizado de Flask:

```powershell
# Desde tu terminal local (Windows PowerShell o CMD)
fly console -C "flask migrate-db"
```

### ¿Qué hace este comando?
- Conecta con la instancia en ejecución en Fly.io.
- Ejecuta el comando `migrate-db` definido en `app/commands.py`.
- Aplica las sentencias SQL necesarias (`ALTER TABLE ...`) de forma segura y persistente.

## 🛠️ Solución de Problemas (Troubleshooting)

### Error: El token '||' no es un separador de instrucciones válido

Si intentas ejecutar comandos estilo Bash (Linux) en Windows PowerShell, verás este error:

**Comando fallido:**
`grep -q "busqueda" archivo.py || echo "no encontrado"`

**Causa:**
PowerShell no utiliza `||` para encadenar comandos por error. 

**Solución en PowerShell:**
Usa `;` para separar comandos o la lógica nativa de PowerShell:
```powershell
# Opción 1: Ignorar el error y seguir (similar a ;)
grep -q "busqueda" archivo.py ; echo "Siguiente paso"

# Opción 2: Lógica Condicional en PowerShell
if (!(Select-String "busqueda" archivo.py -Quiet)) { Write-Host "No encontrado" }
```

## 🔐 Buenas Prácticas de Seguridad
- **NUNCA** crees rutas HTTP (`/api/run-migration`) para ejecutar cambios en la base de datos.
- Utiliza siempre la CLI (`flask commands`) a través de conexiones seguras como `fly console` o `fly ssh`.
- Asegúrate de que tus comandos de migración usen `IF NOT EXISTS` en SQL para evitar errores en ejecuciones repetidas.
