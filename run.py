# run.py
from app import create_app
import os

# La variable 'app' se crea en el alcance global para que Gunicorn la encuentre.
app = create_app()

if __name__ == '__main__':
    # Esta sección solo se usa para desarrollo en tu PC.
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)