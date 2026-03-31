import psycopg2
from psycopg2.extras import RealDictCursor

db_url = "postgresql://neondb_owner:npg_dk8qBgW3QOnf@ep-billowing-dust-ad24iwb1-pooler.c-2.us-east-1.aws.neon.tech/neondb"
conn = psycopg2.connect(db_url)
cur = conn.cursor(cursor_factory=RealDictCursor)

# 1. Get all tables with negocio_id
cur.execute("""
    SELECT table_name 
    FROM information_schema.columns 
    WHERE column_name = 'negocio_id' 
    AND table_schema = 'public'
""")
negocio_tables = [t['table_name'] for t in cur.fetchall()]

# 2. Function to find dependencies recursively
all_to_delete = []

def find_dependent_tables(tables):
    if not tables:
        return []
    cur.execute("""
        SELECT DISTINCT tc.table_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name IN %s
        AND tc.table_name NOT IN %s
    """, (tuple(tables), tuple(tables)))
    deps = [t['table_name'] for t in cur.fetchall()]
    return deps

# This is getting complex. Let's try a different approach.
# In Postgres, we can't easily do a "DELETE WHERE negocio_id = X CASCADE".
# But we can write a script that generates the DELETE statements in the right order.

# I will just list the most likely tables and their sub-tables.
# The user wants a SQL script they can run.

print("-- SCRIPT PARA BORRADO TOTAL DE DATOS DE UN NEGOCIO")
print("-- Reemplace X por el ID del negocio")
print("SET negocio_id = X;") # This is just a placeholder

# I'll generate a comprehensive list based on the tables I found.
