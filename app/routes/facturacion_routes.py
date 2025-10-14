from flask import Blueprint, jsonify, request, g
from app.database import get_db
from app.auth_decorator import token_required
import datetime

bp = Blueprint('facturacion', __name__)

@bp.route('/ventas/<int:venta_id>/facturar', methods=['POST'])
@token_required
def facturar_venta(current_user, venta_id):
    data = request.get_json()
    tipo_facturacion = data.get('tipo') # Espera "oficial" o "negro"
    
    db = get_db()
    
    db.execute("SELECT * FROM ventas WHERE id = %s", (venta_id,))
    venta = db.fetchone()
    if not venta or venta['estado'] == 'Facturada':
        return jsonify({'error': 'La venta no se puede facturar o ya ha sido facturada.'}), 409
        
    # --- Facturación "en Negro" (No Fiscal) ---
    if tipo_facturacion == 'negro':
        try:
            db.execute("UPDATE ventas SET estado = 'Facturada', tipo_factura = 'X' WHERE id = %s", (venta_id,))
            g.db_conn.commit()
            return jsonify({'message': 'La venta se marcó como facturada (Comprobante no fiscal).'}), 200
        except Exception as e:
            g.db_conn.rollback()
            return jsonify({'error': str(e)}), 500

    # --- Facturación OFICIAL (ARCA/AFIP) ---
    elif tipo_facturacion == 'oficial':
        try:
            # a. Obtener datos fiscales del negocio y del cliente
            db.execute("SELECT * FROM negocios WHERE id = %s", (venta['negocio_id'],))
            negocio = db.fetchone()
            db.execute("SELECT * FROM clientes WHERE id = %s", (venta['cliente_id'],))
            cliente = db.fetchone()

            if not negocio or not cliente:
                 return jsonify({'error': 'No se encontraron los datos del negocio o del cliente.'}), 404

            # --- Lógica de conexión con AFIP (ahora simulada) ---
            # En el futuro, aquí usarías la librería pyafipws con tus certificados.
            
            # --- Simulación de obtención de CAE ---
            cae = "12345678901234"
            vencimiento_cae = (datetime.date.today() + datetime.timedelta(days=10)).strftime('%Y-%m-%d')
            
            # Obtenemos el último número de factura y lo incrementamos
            # NOTA: Esta consulta es para PostgreSQL.
            db.execute(
                """
                SELECT MAX(CAST(SUBSTRING(numero_factura FROM 6) AS INTEGER)) as last_num 
                FROM ventas 
                WHERE negocio_id = %s AND SUBSTRING(numero_factura FROM 1 FOR 4) = %s
                """,
                (venta['negocio_id'], str(negocio['punto_de_venta']).zfill(4))
            )
            last_num_row = db.fetchone()
            next_num = (last_num_row['last_num'] or 0) + 1
            numero_factura = f"{str(negocio['punto_de_venta']).zfill(4)}-{str(next_num).zfill(8)}"

            # b. Actualizamos la venta en la BD con los datos de la factura
            db.execute(
                """
                UPDATE ventas 
                SET estado = 'Facturada', tipo_factura = %s, numero_factura = %s, 
                    cae = %s, vencimiento_cae = %s 
                WHERE id = %s
                """,
                ('B', numero_factura, cae, vencimiento_cae, venta_id)
            )
            g.db_conn.commit()
            
            return jsonify({
                'message': f'Factura {numero_factura} generada con éxito.', 
                'cae': cae,
                'numero_factura': numero_factura
            }), 200
            
        except Exception as e:
            g.db_conn.rollback()
            print(f"Error de facturación AFIP: {e}")
            return jsonify({'error': f"Error de facturación: {str(e)}"}), 500

    return jsonify({'error': 'Tipo de facturación no válido'}), 400