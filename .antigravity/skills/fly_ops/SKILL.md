---
description: Fly.io Operations and Remote Debugging
---

# Fly.io Operations Skill

This skill provides reliable methods for executing commands, inspecting environment variables, and running Python snippets on Fly.io without encountering shell-escaping or environment variable issues common in Windows/PowerShell.

## 1. Safety Best Practices
- **Always use `fly ssh console`** for interactive debugging.
- **Environment Variables**: Local PowerShell variables like `$DATABASE_URL` do NOT exist on the Fly machine. You must either use `fly ssh console -C "env"` to see them or use `os.environ` inside a Python script executed on the remote.

## 2. Executing Remote Python Snippets
To run Python code on Fly without escaping hell:
1. **Preferred Method**: Write a small `temp_debug.py` locally and use `fly ssh sftp` or just use a robustly escaped one-liner.
2. **Robust One-Liner (Windows Shell Compatible)**:
   ```powershell
   fly ssh console -C "python3 -c \"import os; print(os.environ.get('DATABASE_URL'))\""
   ```
   *Note: Use double quotes for the command and escaped double quotes for the python script content.*

## 3. Database Research from Local Machine
If you have the `DATABASE_URL` (find it using `fly secrets list` and `fly ssh console -C "env"`), use a local Python script instead of trying to pipe long SQL into `fly ssh console`.

**Example `remote_db_check.py` Template:**
```python
import psycopg2
import os
from psycopg2.extras import RealDictCursor

# The URL usually looks like: postgresql://user:pass@host:port/dbname
# DO NOT hardcode secrets in files that stay in the repo.
db_url = "PASTE_LINK_HERE" 

def query():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT ...")
    rows = cur.fetchall()
    for r in rows:
        print(r)
    conn.close()

if __name__ == "__main__":
    query()
```

## 4. Escaping en PowerShell (Evitar SyntaxErrors)
Si intentas ejecutar un script de Python de una sola línea (`python -c`) desde PowerShell, seguirás viendo errores como `SyntaxError: unterminated string literal` si no usas las comillas correctas.

### Reglas de Oro para PowerShell:
1. **Comillas Dobles Exteriores**: Siempre usa comillas dobles `"` para envolver el comando completo de Python.
2. **Escapar Comillas Dobles Interiores**: Si necesitas usar `"` dentro de tu código Python (ej. para strings de SQL), usa triple comilla o escapa con `\"`.
3. **Comillas Simples para SQL**: Usa comillas simples `'` para valores de texto en SQL para no entrar en conflicto con las comillas de la consola.
4. **NO USAR backslashes (`\`) al final de la línea**: PowerShell interpreta esto como continuación de comando pero Python lo ve de forma inconsistente, rompiendo los strings.

**Sintaxis Correcta (Ejemplo):**
```powershell
python -c "import psycopg2; conn=psycopg2.connect('URL_AQUI'); cur=conn.cursor(); cur.execute('SELECT * FROM tabla'); print(cur.fetchall())"
```

## 5. Errores Comunes Identificados
- **SyntaxError: unterminated string literal**: Generalmente causado por usar comillas dobles sin escapar dentro de un comando que también usa comillas dobles, o por caracteres especiales (`%`, `!`) que PowerShell intenta expandir.
- **La Solución Definitiva (Safe Mode)**: 
    *   Si tu código Python tiene más de 60 caracteres.
    *   Si usas bucles `for`, `if` o indentación.
    *   Si usas SQL con filtros `WHERE column = 'valor'`.
    
    **NO uses `python -c`**. Usa siempre `write_to_file` para crear un archivo `.py` y ejecútalo normalmente. Esto elimina el 100% de los errores de escape.

- **Limpieza**: Evita dejar archivos como `check_schema.py` o `debug_stock_issue.py` permanentemente. Bórralos después de usarlos.
## 6. Local Environment Constraints
- **NO `psql` access**: The local environment (Windows/PowerShell) does NOT have `psql` installed. Attempting to run `psql $DATABASE_URL ...` will fail.
- **Python as the DB Client**: Always use a Python script with `psycopg2` to interact with the database from the local machine. 
- **Database URL**: The `$DATABASE_URL` environment variable should be read from the `.env` file in the root directory.

**Example of how to check a table schema without `psql`:**
1. Create a temporary script `check_table.py`:
```python
import psycopg2, os
from dotenv import load_dotenv
load_dotenv()
conn = psycopg2.connect(os.environ.get('DATABASE_URL'))
cur = conn.cursor()
cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'pedidos'")
for row in cur.fetchall():
    print(row)
conn.close()
```
2. Run it: `python check_table.py`
3. Delete it.
## 7. Fly Logs and PowerShell Filtering
The `fly logs` command on Windows/PowerShell often requires filtering. Since `grep` is typically not available in the local Windows environment, use the native `Select-String` cmdlet.

**Filtering for Errors (500 Internal Server Error):**
```powershell
fly logs --no-tail -a multinegociobaboons-fly | Select-String "500" -Context 0,10
```
*Tip: The `-Context 0,10` flag shows 10 lines AFTER the match, which is essential for capturing the traceback.*

**Searching for Python Tracebacks:**
```powershell
fly logs --no-tail -a multinegociobaboons-fly | Select-String "Traceback" -Context 0,20
```

**Following Logs with Filter (Live):**
PowerShell does not support easy piping of a live stream to `Select-String` while keeping it interactive as easily as `tail -f | grep`. If `fly logs` is used without `--no-tail`, the pipe might buffer or behave inconsistently. For live debugging, prefer `fly logs` alone or use `--no-tail` repeatedly.
