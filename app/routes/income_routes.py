# app/routes/income_routes.py
from flask import Blueprint, request, jsonify
from app import get_db
from .auth_routes import token_required
import datetime

bp = Blueprint('income', __name__)

# --- Rutas para Ingresos de Mercadería ---

@bp.route('/negocios/<int:negocio_id>/ingresos', methods=['POST'])
@token_required
def registrar_ingreso(current_user, negocio_id):
    data = request.get_json()
    detalles = data.get('detalles')
    proveedor_id = data.get('proveedor_id') # ✨ 1. Obtenemos el ID del proveedor
    referencia = data.get('referencia')     # ✨ (nro_factura o remito)

    # ✨ 2. Nuevas validaciones (proveedor es obligatorio)
    if not detalles:
        return jsonify({'error': 'El ingreso no tiene productos'}), 400
    if not proveedor_id:
        return jsonify({'error': 'Debe seleccionar un proveedor'}), 400

    db = get_db()
    try:
        cursor = db.cursor()
        # ✨ 3. INSERT actualizado para guardar el ID del proveedor y el usuario
        cursor.execute(
            'INSERT INTO ingresos_mercaderia (negocio_id, proveedor_id, referencia, fecha, usuario_id) VALUES (?, ?, ?, ?, ?)',
            (negocio_id, proveedor_id, referencia, datetime.datetime.now(), current_user['id'])
        )
        ingreso_id = cursor.lastrowid
        
        for item in detalles:
            cursor.execute(
                'INSERT INTO ingresos_mercaderia_detalle (ingreso_id, producto_id, cantidad, precio_costo_unitario) VALUES (?, ?, ?, ?)',
                (ingreso_id, item['producto_id'], item['cantidad'], item.get('precio_costo'))
            )
            # Actualizamos el stock
            cursor.execute(
                'UPDATE productos SET stock = stock + ? WHERE id = ?',
                (item['cantidad'], item['producto_id'])
            )
            # ✨ Opcional pero recomendado: Actualizamos el precio de costo del producto
            if item.get('precio_costo') is not None:
                cursor.execute(
                    'UPDATE productos SET precio_costo = ? WHERE id = ?',
                    (item['precio_costo'], item['producto_id'])
                )

        db.commit()
        return jsonify({'message': 'Ingreso registrado y stock actualizado con éxito', 'ingreso_id': ingreso_id}), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': f'Ocurrió un error: {str(e)}'}), 500


@bp.route('/negocios/<int:negocio_id>/ingresos', methods=['GET'])
@token_required
def get_historial_ingresos(current_user, negocio_id):
    """Devuelve la lista maestra de ingresos, ahora con el nombre del proveedor."""
    db = get_db()
    # ✨ 4. JOIN para obtener el nombre del proveedor a partir de su ID
    ingresos = db.execute(
        """
        SELECT 
            i.id, i.fecha, i.referencia, p.nombre as proveedor_nombre 
        FROM 
            ingresos_mercaderia i
        LEFT JOIN 
            proveedores p ON i.proveedor_id = p.id
        WHERE 
            i.negocio_id = ? 
        ORDER BY 
            i.fecha DESC
        """,
        (negocio_id,)
    ).fetchall()
    return jsonify([dict(row) for row in ingresos])


@bp.route('/ingresos/<int:ingreso_id>/detalles', methods=['GET'])
@token_required
def get_detalles_ingreso(current_user, ingreso_id):
    """Devuelve los productos de un ingreso específico."""
    db = get_db()
    detalles = db.execute(
        'SELECT d.cantidad, d.precio_costo_unitario, p.nombre FROM ingresos_mercaderia_detalle d JOIN productos p ON d.producto_id = p.id WHERE d.ingreso_id = ?',
        (ingreso_id,)
    ).fetchall()
    return jsonify([dict(row) for row in detalles])