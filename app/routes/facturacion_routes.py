from flask import Blueprint, jsonify, request, g, current_app
from app.database import get_db
from app.auth_decorator import token_required
from afip import Afip
import datetime
import os
from decimal import Decimal, ROUND_HALF_UP

bp = Blueprint('facturacion', __name__)

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

            # 2. Leer los certificados (usando una ruta absoluta para evitar problemas)
            #    Se construye la ruta desde la raíz de la aplicación Flask.
            cert_path = os.path.join(current_app.root_path, '..', 'CertificadosARCA', 'certificado.crt')
            key_path = os.path.join(current_app.root_path, '..', 'CertificadosARCA', 'key.key')

            with open(cert_path, 'r') as cert_file:
                cert_contenido = cert_file.read()
            with open(key_path, 'r') as key_file:
                key_contenido = key_file.read()

            # 3. Conectar a AFIP
            afip = Afip({
                "CUIT": int(negocio['cuit']), # CORRECCIÓN: Asegurarse de que el CUIT sea un entero.
                "cert": cert_contenido,
                "key": key_contenido,
                # "homologacion": True # Descomentar si necesitas forzar el modo de prueba
            })

            # 4. Preparar los datos para la factura
            punto_venta = negocio['punto_de_venta']
            tipo_de_factura = 6 # Factura B
            
            ultimo_autorizado = afip.ElectronicBilling.getLastVoucher(punto_venta, tipo_de_factura)
            numero_de_factura = ultimo_autorizado + 1
            fecha = int(datetime.date.today().strftime('%Y%m%d'))

            # --- CORRECCIÓN: Usar Decimal para cálculos monetarios ---
            # Evita problemas de precisión con números de punto flotante.
            importe_total = Decimal(venta['total'])
            # Asumimos una tasa de IVA del 21%
            tasa_iva = Decimal('1.21') 
            importe_gravado = (importe_total / tasa_iva).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            importe_iva = (importe_total - importe_gravado).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

            # --- CORRECCIÓN CLAVE: El diccionario de datos debe coincidir con el de tu script funcional ---
            data_factura = {
                "CantReg": 1, 
                "PtoVta": punto_venta, 
                "CbteTipo": tipo_de_factura, 
                "Concepto": 1, # 1: Productos. Asumido por ahora.
                "DocTipo": 99, # 99: Consumidor Final
                "DocNro": 0,
                "CbteDesde": numero_de_factura, 
                "CbteHasta": numero_de_factura,
                "CbteFch": fecha,
                # --- AÑADIDO: Campos de fecha de servicio ---
                # Son requeridos por el WS aunque el concepto sea "Productos". 
                # Se envían como None o 0 si no aplican.
                "FchServDesde": None,
                "FchServHasta": None,
                "FchVtoPago": None,
                "ImpTotal": float(importe_total), # El WS espera float, no Decimal
                "ImpTotConc": 0, 
                "ImpNeto": float(importe_gravado),
                "ImpOpEx": 0, 
                "ImpIVA": float(importe_iva), 
                "ImpTrib": 0,
                "MonId": "PES", 
                "MonCotiz": 1, 
                # --- ELIMINADO: "CondicionIVAReceptorId" ---
                # Este campo no va en el diccionario principal, se infiere del DocTipo o no es necesario.
                "Iva": [{"Id": 5, "BaseImp": float(importe_gravado), "Importe": float(importe_iva)}] 
            }

            # 5. Crear la factura
            res = afip.ElectronicBilling.createVoucher(data_factura)

            # 6. Guardar los datos en nuestra base de datos
            numero_factura_str = f"{str(punto_venta).zfill(5)}-{str(numero_de_factura).zfill(8)}"
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
            return jsonify({'error': f"Error de facturación AFIP: {str(e)}"}), 500

    return jsonify({'error': 'Tipo de facturación no válido'}), 400

