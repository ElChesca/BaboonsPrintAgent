# run.py
from app import create_app
import os

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))  # Cambia 5000 a 8080 por defecto
    app.run(host='0.0.0.0', port=port, debug=False)  # debug=False para producción