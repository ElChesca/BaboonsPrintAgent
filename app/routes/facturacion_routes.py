from flask import Blueprint, jsonify, request, g
from app.database import get_db
from app.auth_decorator import token_required
import datetime
# (En un futuro, importarías la librería de AFIP aquí)
# from pyafipws import Wsfev1 

bp = Blueprint('facturacion', __name__)

@bp.route('/ventas/<int:venta_id>/facturar', methods=['POST'])
@token_required
def facturar_venta(current_user, venta_id):
    data = request.get_json()
    tipo_facturacion = data.get('tipo') # Espera "oficial" o "negro"
    
    db = get_db()
    
    # 1. Obtenemos la venta y validamos que se pueda facturar
    db.execute("SELECT * FROM ventas WHERE id = %s", (venta_id,))
    venta = db.fetchone()
    if not venta or venta['estado'] == 'Facturada':
        return jsonify({'error': 'La venta no se puede facturar o ya ha sido facturada.'}), 409
        
    # --- Lógica para facturación "en Negro" (No Fiscal) ---
    if tipo_facturacion == 'negro':
        try:
            db.execute("UPDATE ventas SET estado = 'Facturada', tipo_factura = 'X' WHERE id = %s", (venta_id,))
            g.db_conn.commit()
            return jsonify({'message': 'La venta se marcó como facturada (Comprobante no fiscal).'}), 200
        except Exception as e:
            g.db_conn.rollback()
            return jsonify({'error': str(e)}), 500

    # --- Lógica para facturación OFICIAL (ARCA/AFIP) ---
    elif tipo_facturacion == 'oficial':
        try:
            # a. Obtener datos fiscales del negocio y del cliente de la BD (ejemplo)
            db.execute("SELECT * FROM negocios WHERE id = %s", (venta['negocio_id'],))
            negocio = db.fetchone()
            db.execute("SELECT * FROM clientes WHERE id = %s", (venta['cliente_id'],))
            cliente = db.fetchone()

            # --- Lógica REAL de conexión con AFIP (ahora simulada) ---
            # En el futuro, aquí usarías la librería pyafipws con tus certificados.
            # Ejemplo:
            # wsfe = Wsfev1()
            # wsfe.Conectar(cuit=negocio['cuit'], private_key="ruta/a/tu/private_key.key", cert="ruta/a/tu/cert.crt")
            # cae, vencimiento_cae, numero_factura = wsfe.CrearFactura(...)
            
            # --- Simulación (mientras no tengamos los certificados) ---
            # Esto nos permite probar el flujo completo.
            cae = "12345678901234"
            vencimiento_cae = (datetime.date.today() + datetime.timedelta(days=10)).strftime('%Y-%m-%d')
            
            # Obtenemos el último número de factura y lo incrementamos
            db.execute("SELECT MAX(CAST(SUBSTRING(numero_factura, 6) AS INTEGER)) as last_num FROM ventas WHERE negocio_id = %s", (venta['negocio_id'],))
            last_num_row = db.fetchone()
            next_num = (last_num_row['last_num'] or 0) + 1
            numero_factura = f"{str(negocio['punto_de_venta']).zfill(4)}-{str(next_num).zfill(8)}"

            # b. Si se obtiene el CAE, actualizamos la venta en la BD
            db.execute(
                """
                UPDATE ventas 
                SET estado = 'Facturada', tipo_factura = %s, numero_factura = %s, 
                    cae = %s, vencimiento_cae = %s 
                WHERE id = %s
                """,
                ('B', numero_factura, cae, vencimiento_cae, venta_id) # 'B' como ejemplo
            )
            g.db_conn.commit()
            
            return jsonify({
                'message': f'Factura {numero_factura} generada con éxito.', 
                'cae': cae,
                'numero_factura': numero_factura
            }), 200
            
        except Exception as e:
            g.db_conn.rollback()
            print(f"Error de facturación AFIP: {e}") # Para ver en los logs de Render
            return jsonify({'error': f"Error de facturación AFIP: {str(e)}"}), 500

    return jsonify({'error': 'Tipo de facturación no válido'}), 400