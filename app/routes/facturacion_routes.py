from flask import Blueprint, jsonify, request, g
from app.database import get_db
from app.auth_decorator import token_required
import datetime

# Chivato 1: Si ves esto en los logs, significa que el archivo se está leyendo.
print("Cargando blueprint de facturación...")

bp = Blueprint('facturacion', __name__)

@bp.route('/ventas/<int:venta_id>/facturar', methods=['POST'])
@token_required
def facturar_venta(current_user, venta_id):
    # Chivato 2: Si ves esto, la ruta se registró y se está ejecutando.
    print(f"Iniciando facturación para la venta ID: {venta_id}")
    
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
            if not negocio:
                 return jsonify({'error': 'No se encontraron los datos del negocio.'}), 404

            # ✨ CORRECCIÓN CLAVE: Manejamos el caso de "Consumidor Final"
            cliente = None
            if venta['cliente_id']:
                db.execute("SELECT * FROM clientes WHERE id = %s", (venta['cliente_id'],))
                cliente = db.fetchone()
                if not cliente:
                    return jsonify({'error': f"El cliente ID {venta['cliente_id']} asociado a la venta no fue encontrado."}), 404

            # --- Simulación de obtención de CAE ---
            cae = "12345678901234"
            vencimiento_cae = (datetime.date.today() + datetime.timedelta(days=10)).strftime('%Y-%m-%d')
            
            punto_de_venta_str = str(negocio['punto_de_venta']).zfill(4)
            db.execute(
                """
                SELECT MAX(CAST(SUBSTRING(numero_factura FROM 6) AS INTEGER)) as last_num 
                FROM ventas 
                WHERE negocio_id = %s AND SUBSTRING(numero_factura FROM 1 FOR 4) = %s
                """,
                (venta['negocio_id'], punto_de_venta_str)
            )
            last_num_row = db.fetchone()
            next_num = (last_num_row['last_num'] or 0) + 1
            numero_factura = f"{punto_de_venta_str}-{str(next_num).zfill(8)}"

            # Aquí iría la lógica para determinar si la factura es A o B según la condición de IVA del cliente y el negocio.
            tipo_factura_afip = 'B' # Asumimos 'B' por ahora.

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
            return jsonify({'error': f"Error interno de facturación: {str(e)}"}), 500

    return jsonify({'error': 'Tipo de facturación no válido'}), 400