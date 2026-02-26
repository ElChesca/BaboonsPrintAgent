# app/routes/mercado_pago_routes.py
from flask import Blueprint, request, jsonify, g
from app.auth_decorator import token_required
from app.services.mercado_pago_service import MercadoPagoService

bp = Blueprint('mercado_pago', __name__, url_prefix='/api')

@bp.route('/negocios/<int:negocio_id>/mp/create-intent', methods=['POST'])
@token_required
def create_mp_intent(current_user, negocio_id):
    """
    Crea una intención de pago en el dispositivo Mercado Pago Point.
    """
    data = request.get_json()
    amount = data.get('amount')
    description = data.get('description', 'Venta Baboons')
    external_reference = data.get('external_reference') # ID de la venta temporal o final

    if not amount:
        return jsonify({'error': 'El monto es obligatorio'}), 400

    mp_service = MercadoPagoService(negocio_id)
    if not mp_service.is_configured():
        return jsonify({'error': 'Configuración de Mercado Pago incompleta (Falta Device ID)'}), 400

    result = mp_service.create_payment_intent(amount, description, external_reference)
    
    if "error" in result:
        return jsonify(result), 500

    return jsonify(result)

@bp.route('/negocios/<int:negocio_id>/mp/create-order', methods=['POST'])
@token_required
def create_mp_order(current_user, negocio_id):
    """
    Paso 1: Crear la Orden de Pago (Modo Point) para pruebas.
    """
    data = request.get_json()
    amount = data.get('amount')
    external_reference = data.get('external_reference')

    if not amount:
        return jsonify({'error': 'El monto es obligatorio'}), 400

    mp_service = MercadoPagoService(negocio_id)
    result = mp_service.create_order(amount, external_reference)
    
    if "error" in result:
        return jsonify(result), 500

    return jsonify(result)

@bp.route('/negocios/<int:negocio_id>/mp/simulate-event', methods=['POST'])
@token_required
def simulate_mp_event(current_user, negocio_id):
    """
    Paso 2: Simular el cobro de la Orden.
    """
    data = request.get_json()
    order_id = data.get('order_id')
    status = data.get('status', 'processed')

    if not order_id:
        return jsonify({'error': 'order_id es obligatorio'}), 400

    mp_service = MercadoPagoService(negocio_id)
    result = mp_service.simulate_order_event(order_id, status)
    
    if "error" in result:
        return jsonify(result), 500

    return jsonify(result)

@bp.route('/negocios/<int:negocio_id>/mp/intent/<string:intent_id>', methods=['GET'])
@token_required
def get_mp_intent_status(current_user, negocio_id, intent_id):
    """
    Consulta el estado de una intención de pago específica.
    """
    mp_service = MercadoPagoService(negocio_id)
    result = mp_service.get_payment_status(intent_id)
    
    if "error" in result:
        return jsonify(result), 500

    return jsonify(result)
