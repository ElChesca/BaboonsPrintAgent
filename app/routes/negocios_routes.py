# app/routes/negocios_routes.py
from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required

bp = Blueprint('negocios', __name__)

@bp.route('/negocios', methods=['GET'])
@token_required
def get_negocios(current_user):
    if not current_user or 'rol' not in current_user or 'id' not in current_user:
        return jsonify({'error': 'Error interno de autenticación'}), 500

    db = get_db()
    try:
        # ✨ CAMBIO: Quitamos logo_url temporalmente
        sql_base = "SELECT n.id, n.nombre, n.direccion, n.tipo_app FROM negocios n"
        
        if current_user['rol'] == 'superadmin':
            db.execute(f"{sql_base} ORDER BY n.nombre")
        else: # Admin u Operador
             db.execute(f"""
                 {sql_base}
                 JOIN usuarios_negocios un ON n.id = un.negocio_id
                 WHERE un.usuario_id = %s
                 ORDER BY n.nombre
             """, (current_user['id'],))

        negocios = db.fetchall()
        # Convertimos a dict y manejamos nulos
        resultado = []
        for row in negocios:
            r = dict(row)
            # if not r['logo_url']: r['logo_url'] = '' # Evitar nulls en el JSON
            # Quitamos logo_url temporalmente
            r['logo_url'] = '' 
            resultado.append(r)
            
        return jsonify(resultado)

    except Exception as e:
        print(f"!!! DATABASE ERROR in get_negocios: {e}")
        g.db_conn.rollback()
        return jsonify({'error': f'Error al obtener negocios: {str(e)}'}), 500

@bp.route('/negocios', methods=['POST'])
@token_required
def add_negocio(current_user):
    if current_user['rol'] != 'superadmin':
        return jsonify({'message': 'Acción no permitida'}), 403
    
    data = request.get_json()
    if not data or 'nombre' not in data:
        return jsonify({'error': 'El campo "nombre" es obligatorio'}), 400

    creador_id = current_user['id']
    nombre = data['nombre']
    direccion = data.get('direccion', '')
    tipo_app = data.get('tipo_app', 'retail')
    logo_url = data.get('logo_url', '') # ✨ Nuevo campo
    
    db = get_db()
    try:
        # ✨ CAMBIO: Insertamos logo_url
        db.execute(
            'INSERT INTO negocios (nombre, direccion, tipo_app, logo_url) VALUES (%s, %s, %s, %s) RETURNING id',
            (nombre, direccion, tipo_app, logo_url)
        )
        nuevo_id = db.fetchone()['id']

        db.execute(
            'INSERT INTO usuarios_negocios (usuario_id, negocio_id) VALUES (%s, %s)',
            (creador_id, nuevo_id)
        )
        g.db_conn.commit()

        return jsonify({
            'id': nuevo_id, 'nombre': nombre, 'direccion': direccion,
            'tipo_app': tipo_app, 'logo_url': logo_url
        }), 201

    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': f'Error al crear negocio: {str(e)}'}), 500

@bp.route('/negocios/<int:id>', methods=['PUT'])
@token_required
def actualizar_negocio(current_user, id):
    # Permitimos editar al superadmin y también al admin del propio negocio (opcional)
    # Por simplicidad mantenemos tu restricción original o la ampliamos:
    if current_user['rol'] not in ['superadmin', 'admin']: 
        return jsonify({'message': 'Acción no permitida'}), 403
        
    try:
        datos = request.get_json()
        nombre = datos['nombre']
        direccion = datos.get('direccion', '')
        tipo_app = datos.get('tipo_app', 'retail')
        logo_url = datos.get('logo_url', '') # ✨ Nuevo campo

        db = get_db()
        # ✨ CAMBIO: Actualizamos logo_url
        db.execute(
            'UPDATE negocios SET nombre = %s, direccion = %s, tipo_app = %s, logo_url = %s WHERE id = %s', 
            (nombre, direccion, tipo_app, logo_url, id)
        )
        g.db_conn.commit()
        return jsonify({'message': 'Negocio actualizado con éxito'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500