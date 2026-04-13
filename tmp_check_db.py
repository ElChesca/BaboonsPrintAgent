
import psycopg2

def check_schema():
    dsn = "postgresql://neondb_owner:npg_dk8qBgW3QOnf@ep-billowing-dust-ad24iwb1-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'crm_leads'
        ORDER BY ordinal_position
    """)
    rows = cur.fetchall()
    for row in rows:
        print(f"{row[0]}: {row[1]}")
    cur.close()
    conn.close()

if __name__ == "__main__":
    check_schema()
