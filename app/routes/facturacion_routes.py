from flask import Blueprint, jsonify, request, g
from app.database import get_db
from app.auth_decorator import token_required
import datetime

# --- Puntos de control para depuración ---
print("--- facturacion_routes.py: Iniciando carga del archivo. ---")

# (En el futuro, aquí se importaría la librería de AFIP)
# from pyafipws import Wsfev1 

print("--- facturacion_routes.py: Imports completados. ---")

bp = Blueprint('facturacion', __name__)
print("--- facturacion_routes.py: Blueprint 'facturacion' creado. ---")

@bp.route('/ventas/<int:venta_id>/facturar', methods=['POST'])
@token_required
def facturar_venta(current_user, venta_id):
    print(f"--- RUTA /facturar INVOCADA para venta ID: {venta_id} ---")
    data = request.get_json()
    tipo_facturacion = data.get('tipo')
    
    db = get_db()
    
    db.execute("SELECT * FROM ventas WHERE id = %s", (venta_id,))
    venta = db.fetchone()
    if not venta or venta['estado'] == 'Facturada':
        return jsonify({'error': 'La venta no se puede facturar o ya ha sido facturada.'}), 409
        
    if tipo_facturacion == 'negro':
        try:
            db.execute("UPDATE ventas SET estado = 'Facturada', tipo_factura = 'X' WHERE id = %s", (venta_id,))
            g.db_conn.commit()
            return jsonify({'message': 'La venta se marcó como facturada (Comprobante no fiscal).'}), 200
        except Exception as e:
            g.db_conn.rollback()
            return jsonify({'error': str(e)}), 500

    elif tipo_facturacion == 'oficial':
        try:
            db.execute("SELECT * FROM negocios WHERE id = %s", (venta['negocio_id'],))
            negocio = db.fetchone()
            
            cliente = None
            if venta['cliente_id']:
                db.execute("SELECT * FROM clientes WHERE id = %s", (venta['cliente_id'],))
                cliente = db.fetchone()

            if not negocio:
                 return jsonify({'error': 'No se encontraron los datos del negocio.'}), 404

            cae = "12345678901234" # Simulación
            vencimiento_cae = (datetime.date.today() + datetime.timedelta(days=10)).strftime('%Y-%m-%d')
            
            punto_de_venta_str = str(negocio.get('punto_de_venta', '1')).zfill(4)
            db.execute(
                "SELECT MAX(CAST(SUBSTRING(numero_factura FROM 6) AS INTEGER)) as last_num FROM ventas WHERE negocio_id = %s AND SUBSTRING(numero_factura FROM 1 FOR 4) = %s",
                (venta['negocio_id'], punto_de_venta_str)
            )
            last_num_row = db.fetchone()
            next_num = (last_num_row['last_num'] or 0) + 1
            numero_factura = f"{punto_de_venta_str}-{str(next_num).zfill(8)}"

            tipo_factura_afip = 'B'
            db.execute(
                "UPDATE ventas SET estado = 'Facturada', tipo_factura = %s, numero_factura = %s, cae = %s, vencimiento_cae = %s WHERE id = %s",
                (tipo_factura_afip, numero_factura, cae, vencimiento_cae, venta_id)
            )
            g.db_conn.commit()
            
            return jsonify({
                'message': f'Factura {numero_factura} generada con éxito.', 
                'cae': cae,
                'numero_factura': numero_factura
            }), 200
            
        except Exception as e:
            g.db_conn.rollback()
            print(f"Error CRÍTICO durante la facturación: {e}")
            return jsonify({'error': f"Error de facturación: {str(e)}"}), 500

    return jsonify({'error': 'Tipo de facturación no válido'}), 400

print("--- facturacion_routes.py: Carga del archivo completada. ---")