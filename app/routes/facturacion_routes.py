from flask import Blueprint, jsonify, request, g
from app.database import get_db
from app.auth_decorator import token_required
from afip import Afip # Usamos la librería correcta
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
    data = request.get_json()
    tipo_facturacion = data.get('tipo')
    
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
            return jsonify({'message': 'Venta marcada como facturada (No Fiscal).'}), 200
        except Exception as e:
            g.db_conn.rollback()
            return jsonify({'error': str(e)}), 500

    # --- Facturación OFICIAL (AFIP) ---
    elif tipo_facturacion == 'oficial':
        try:
            # 1. Obtener datos fiscales del negocio
            db.execute("SELECT * FROM negocios WHERE id = %s", (venta['negocio_id'],))
            negocio = db.fetchone()
            if not negocio:
                 return jsonify({'error': 'No se encontraron los datos del negocio.'}), 404

            # 2. Leer los certificados (como en tu script ganador)
            cert_contenido = open("CertificadosARCA/certificado.crt", 'r').read()
            key_contenido = open("CertificadosARCA/key.key", 'r').read()

            # 3. Conectar a AFIP usando la sintaxis GANADORA
            afip = Afip({
                "CUIT": negocio['cuit'],
                "cert": cert_contenido,
                "key": key_contenido
                # No es necesario "homologacion": True, la librería lo detecta
            })

            # 4. Preparar los datos para la factura
            punto_venta = negocio['punto_de_venta']
            tipo_de_factura = 6 # Asumimos Factura B por ahora
            ultimo_autorizado = afip.ElectronicBilling.getLastVoucher(punto_venta, tipo_de_factura)
            numero_de_factura = ultimo_autorizado + 1
            fecha = int(datetime.date.today().strftime('%Y%m%d'))

            # (Aquí iría la lógica para calcular el IVA a partir del total de la venta)
            importe_total = float(venta['total'])
            importe_gravado = round(importe_total / 1.21, 2)
            importe_iva = importe_total - importe_gravado

            data_factura = {
                "CantReg": 1, "PtoVta": punto_venta, "CbteTipo": tipo_de_factura, 
                "Concepto": 1, "DocTipo": 99, "DocNro": 0,
                "CbteDesde": numero_de_factura, "CbteHasta": numero_de_factura,
                "CbteFch": fecha,
                "ImpTotal": importe_total, "ImpTotConc": 0, "ImpNeto": importe_gravado,
                "ImpOpEx": 0, "ImpIVA": importe_iva, "ImpTrib": 0,
                "MonId": "PES", "MonCotiz": 1, 
                "CondicionIVAReceptorId" : 5, # 5 = Consumidor Final
                "Iva": [{"Id": 5, "BaseImp": importe_gravado, "Importe": importe_iva}] 
            }

            # 5. Crear la factura
            res = afip.ElectronicBilling.createVoucher(data_factura)

            # 6. Guardar los datos en nuestra base de datos
            numero_factura_str = f"{str(punto_venta).zfill(4)}-{str(numero_de_factura).zfill(8)}"
            db.execute(
                "UPDATE ventas SET estado = 'Facturada', tipo_factura = 'B', numero_factura = %s, cae = %s, vencimiento_cae = %s WHERE id = %s",
                (numero_factura_str, res['CAE'], res['CAEFchVto'], venta_id)
            )
            g.db_conn.commit()
            
            return jsonify({
                'message': f'Factura {numero_factura_str} generada con éxito.', 
                'cae': res['CAE']
            }), 200
            
        except Exception as e:
            g.db_conn.rollback()
            # Devolvemos el error específico de AFIP al frontend
            return jsonify({'error': f"Error de facturación AFIP: {str(e)}"}), 500

    return jsonify({'error': 'Tipo de facturación no válido'}), 400