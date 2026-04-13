import click
import os
from flask.cli import with_appcontext
from app.database import get_db, close_db
from flask import current_app

@click.command('sync-reservas-crm')
@with_appcontext
def sync_reservas_crm():
    """Sincroniza todas las reservas existentes hacia la tabla crm_leads."""
    db = get_db()
    click.echo("🔄 Iniciando sincronización de reservas a CRM...")
    try:
        # Traer todas las reservas que tengan teléfono o email
        db.execute("""
            SELECT negocio_id, nombre_cliente, email, telefono, fecha_reserva, hora_reserva, num_comensales, fecha_nacimiento
            FROM mesas_reservas
            WHERE email IS NOT NULL OR telefono IS NOT NULL
        """)
        reservas = db.fetchall()
        count = 0
        
        from app.routes.reservas_routes import _upsert_crm_lead
        
        for r in reservas:
            _upsert_crm_lead(
                r['negocio_id'], r['nombre_cliente'], r['email'], r['telefono'],
                r['fecha_reserva'], r['hora_reserva'], r['num_comensales'], r['fecha_nacimiento']
            )
            count += 1
            if count % 10 == 0: click.echo(f"  > {count} procesados...")
            
        import flask
        flask.g.db_conn.commit()
        click.echo(f"✅ Sincronización completada. {count} contactos procesados.")
    except Exception as e:
        click.echo(f"❌ Error: {e}")

@click.command('init-crm-db')
@with_appcontext
def init_crm_db_command():
    """Creates the CRM tables in the database."""
    db = get_db()

    # Check if we are using Postgres (psycopg2) or SQLite
    # This is a heuristic based on the connection object type or just try/except

    click.echo('Initializing CRM database...')

    # We'll read the Postgres migration file
    with current_app.open_resource('../migrations/crm_postgres.sql') as f:
        sql_content = f.read().decode('utf8')

    try:
        # Try executing the Postgres SQL
        db.execute(sql_content)
        # Check if we need to commit (connection vs cursor)
        # get_db() returns cursor in original implementation?
        # In my local reverted database.py, get_db() returns cursor for Postgres.
        # But I need the connection to commit.
        # app/database.py stores connection in g.db_conn
        from flask import g
        if hasattr(g, 'db_conn'):
             g.db_conn.commit()
             click.echo('CRM tables created successfully (PostgreSQL).')
        else:
             click.echo('Warning: Could not commit transaction. g.db_conn not found.')

    except Exception as e:
        click.echo(f'Error creating tables: {e}')
        click.echo('If you are running locally with SQLite, this might fail due to "SERIAL" keyword.')
        click.echo('For SQLite, the table might have been created via schema.sql already.')

@click.command('init-rentals-db')
@with_appcontext
def init_rentals_db_command():
    """Creates the Rentals tables in the database."""
    db = get_db()
    click.echo('Initializing Rentals database...')

    with current_app.open_resource('../migrations/rentals.sql') as f:
        sql_content = f.read().decode('utf8')

    try:
        db.executescript(sql_content)
        from flask import g
        if hasattr(g, 'db_conn'):
             g.db_conn.commit()
             click.echo('Rentals tables created successfully.')
        else:
             click.echo('Warning: Could not commit transaction. g.db_conn not found.')
    except Exception as e:
        # Fallback for Postgres if executescript is not available on the cursor wrapper
        # or if syntax differs slightly (though my SQL tried to be generic enough except AUTOINCREMENT)
        try:
            db.execute(sql_content)
            from flask import g
            if hasattr(g, 'db_conn'):
                g.db_conn.commit()
                click.echo('Rentals tables created successfully (Execute fallback).')
        except Exception as e2:
            click.echo(f'Error creating tables: {e2}')

@click.command('init-compras-db')
@with_appcontext
def init_compras_db_command():
    """Creates the Purchase Orders tables in the database."""
    db = get_db()
    click.echo('Initializing Purchase Orders database...')

    # Build path relative to the app root (one level up from app/)
    migration_path = os.path.join(current_app.root_path, '..', 'migrations', 'add_ordenes_compra.sql')
    click.echo(f"Reading migration from: {migration_path}")
    
    try:
        with open(migration_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()
    except Exception as e:
        click.echo(f"Error loading file: {e}")
        return

    try:
        db.execute(sql_content)
        from flask import g
        if hasattr(g, 'db_conn'):
             g.db_conn.commit()
             click.echo('Purchase Orders tables created successfully.')
        else:
             click.echo('Warning: Could not commit transaction. g.db_conn not found.')
    except Exception as e:
        click.echo(f'Error creating tables: {e}')

@click.command('migrate-db')
@with_appcontext
def migrate_db_command():
    """Migrates the database to include new announcement columns."""
    db = get_db()
    click.echo('Running database migrations...')
    try:
        # Postgres supports ADD COLUMN IF NOT EXISTS (v9.6+)
        # For SQLite, we might need a catch-all try/except per column if not supported
        db.execute("ALTER TABLE negocios ADD COLUMN IF NOT EXISTS anuncio_texto TEXT;")
        db.execute("ALTER TABLE negocios ADD COLUMN IF NOT EXISTS anuncio_version TEXT DEFAULT 'v1';")
        
        from flask import g
        if hasattr(g, 'db_conn'):
             g.db_conn.commit()
             click.echo('Migrations applied successfully (anuncio_texto, anuncio_version).')
        else:
             click.echo('Warning: Could not commit transaction. g.db_conn not found.')
    except Exception as e:
        # Fallback for older DBs or SQLite that don't support IF NOT EXISTS in ALTER
        click.echo(f'Attempting fallback migration due to: {e}')
        try:
            db.execute("ALTER TABLE negocios ADD COLUMN anuncio_texto TEXT;")
        except: pass
        try:
            db.execute("ALTER TABLE negocios ADD COLUMN anuncio_version TEXT DEFAULT 'v1';")
        except: pass
        
        from flask import g
        if hasattr(g, 'db_conn'): g.db_conn.commit()
        click.echo('Fallback migration attempt finished.')

@click.command('init-ocr-db')
@with_appcontext
def init_ocr_db_command():
    """Creates the OCR tables in the database."""
    db = get_db()
    click.echo('Initializing OCR database...')
    migration_path = os.path.join(current_app.root_path, '..', 'migrations', 'ocr_migration.sql')
    
    try:
        with open(migration_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        db.execute(sql_content)
        from flask import g
        if hasattr(g, 'db_conn'):
             g.db_conn.commit()
             click.echo('OCR tables created successfully.')
    except Exception as e:
        click.echo(f'Error creating tables: {e}')
