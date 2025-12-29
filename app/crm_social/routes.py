from flask import jsonify
from . import bp

@bp.route('/status')
def status():
    return jsonify({'status': 'CRM Module Active', 'version': '1.0.0'})
