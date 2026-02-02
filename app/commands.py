import click
from flask.cli import with_appcontext
from app.database import get_db, close_db
from flask import current_app

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
