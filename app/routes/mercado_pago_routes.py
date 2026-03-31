# app/routes/mercado_pago_routes.py
from flask import Blueprint, request, jsonify
from app.auth_decorator import token_required
from app.services.mercado_pago_service import MercadoPagoService

bp = Blueprint('mercado_pago', __name__)

@bp.route('/negocios/<int:negocio_id>/mp/create-intent', methods=['POST'])
@token_required
def create_mp_intent(current_user, negocio_id):
    """Crea una intención de pago en el dispositivo Mercado Pago Point."""
    data = request.get_json()
    amount = data.get('amount')
    description = data.get('description', 'Venta Baboons')
    external_reference = data.get('external_reference')

    if not amount:
        return jsonify({'error': 'El monto es obligatorio'}), 400

    mp_service = MercadoPagoService(negocio_id)
    if not mp_service.is_configured():
        return jsonify({'error': 'Configuración de Mercado Pago incompleta'}), 400

    result = mp_service.create_payment_intent(amount, description, external_reference)
    if "error" in result:
        return jsonify(result), 500
    return jsonify(result)

@bp.route('/negocios/<int:negocio_id>/mp/config-status', methods=['GET'])
@token_required
def get_mp_config_status(current_user, negocio_id):
    """Verifica si el negocio tiene Mercado Pago configurado."""
    mp_service = MercadoPagoService(negocio_id)
    return jsonify({'configured': mp_service.is_configured()})

@bp.route('/negocios/<int:negocio_id>/mp/cancel-intent', methods=['POST'])
@token_required
def cancel_mp_intent(current_user, negocio_id):
    """Cancela cualquier intención de pago pendiente en el dispositivo."""
    mp_service = MercadoPagoService(negocio_id)
    result = mp_service.cancel_payment_intent()
    # No devolvemos 500 si falla porque a veces falla si no hay nada que cancelar
    return jsonify(result)

@bp.route('/negocios/<int:negocio_id>/mp/devices', methods=['GET'])
@token_required
def list_mp_devices(current_user, negocio_id):
    """Lista los terminales Point asociados. Permite enviar un token manual en el header X-MP-Token."""
    manual_token = request.headers.get('X-MP-Token')
    mp_service = MercadoPagoService(negocio_id)
    result = mp_service.list_devices(manual_token=manual_token)
    return jsonify(result)

@bp.route('/negocios/<int:negocio_id>/mp/setup-terminal', methods=['POST'])
@token_required
def setup_mp_terminal(current_user, negocio_id):
    """Configura un terminal Point."""
    data = request.get_json()
    device_id = data.get('device_id')
    mode = data.get('mode', 'PDV')
    
    if not device_id:
        return jsonify({"error": "ID de dispositivo faltante"}), 400
        
    mp_service = MercadoPagoService(negocio_id)
    result = mp_service.setup_terminal(device_id, mode)
    if "error" in result:
        return jsonify(result), 500
    return jsonify(result)

# Rutas para el simulador / legacy
@bp.route('/negocios/<int:negocio_id>/mp/create-order', methods=['POST'])
@token_required
def create_mp_order(current_user, negocio_id):
    data = request.get_json()
    mp_service = MercadoPagoService(negocio_id)
    return jsonify(mp_service.create_order(data.get('amount'), data.get('external_reference')))

@bp.route('/negocios/<int:negocio_id>/mp/simulate-event', methods=['POST'])
@token_required
def simulate_mp_event(current_user, negocio_id):
    data = request.get_json()
    mp_service = MercadoPagoService(negocio_id)
    return jsonify(mp_service.simulate_order_event(data.get('order_id'), data.get('status')))

@bp.route('/negocios/<int:negocio_id>/mp/intent/<string:intent_id>', methods=['GET'])
@token_required
def get_mp_intent_status(current_user, negocio_id, intent_id):
    mp_service = MercadoPagoService(negocio_id)
    return jsonify(mp_service.get_payment_status(intent_id))

@bp.route('/negocios/<int:negocio_id>/mp/balance', methods=['GET'])
@token_required
def get_mp_balance(current_user, negocio_id):
    mp_service = MercadoPagoService(negocio_id)
    return jsonify(mp_service.get_balance())

@bp.route('/negocios/<int:negocio_id>/mp/payments', methods=['GET'])
@token_required
def get_mp_payments(current_user, negocio_id):
    limit = request.args.get('limit', 10)
    mp_service = MercadoPagoService(negocio_id)
    return jsonify(mp_service.get_payments(limit))

@bp.route('/negocios/<int:negocio_id>/mp/qr/create', methods=['POST'])
@token_required
def create_qr_payment(current_user, negocio_id):
    """Crea una orden de pago vía QR In-Store."""
    data = request.get_json()
    amount = data.get('amount')
    description = data.get('description', 'Consumo Baboons')
    external_reference = data.get('external_reference')

    if not amount:
        return jsonify({'error': 'El monto es obligatorio'}), 400

    mp_service = MercadoPagoService(negocio_id)
    result = mp_service.create_qr_order(amount, description, external_reference)
    
    if "error" in result:
        return jsonify(result), 500
        
    return jsonify(result)

@bp.route('/negocios/<int:negocio_id>/mp/qr/cancel', methods=['DELETE'])
@token_required
def cancel_qr_payment(current_user, negocio_id):
    """Limpia la caja QR eliminando cualquier orden pendiente."""
    mp_service = MercadoPagoService(negocio_id)
    result = mp_service.delete_qr_order()
    
    if "error" in result:
        return jsonify(result), 500
        
    return jsonify(result)
