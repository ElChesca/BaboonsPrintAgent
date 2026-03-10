# app/routes/agente_facturacion_routes.py
"""
API del Agente de Facturación para Re Pancho.

Endpoints:
  GET  /api/agente/facturacion/reporte          → reporte del día (o fecha específica)
  POST /api/agente/facturacion/ejecutar-hoy     → trigger manual del agente para hoy
  GET  /api/agente/facturacion/distribucion-mes → vista previa del calendario mensual
"""

from flask import Blueprint, jsonify, request, current_app
from app.auth_decorator import token_required
from datetime import date

bp = Blueprint('agente_facturacion', __name__)


def _get_agente():
    """Import controlado para evitar ciclos."""
    from app.agente_facturacion import (
        ejecutar_dia, obtener_reporte_dia, calcular_distribucion_mensual,
        NEGOCIO_ID, TOTAL_FACTURAS, MODO_EJECUCION,
        PUNTO_DE_VENTA, TIPO_FACTURA, CUIT_NEGOCIO
    )
    return ejecutar_dia, obtener_reporte_dia, calcular_distribucion_mensual, \
           NEGOCIO_ID, TOTAL_FACTURAS, MODO_EJECUCION, PUNTO_DE_VENTA, TIPO_FACTURA, CUIT_NEGOCIO


# ────────────────────────────────────────────────────────────────────────────
# GET /api/agente/facturacion/reporte
# Query params: fecha=YYYY-MM-DD (default: hoy), negocio_id (default: 8)
# ────────────────────────────────────────────────────────────────────────────
@bp.route('/agente/facturacion/reporte', methods=['GET'])
@token_required
def reporte_dia(current_user):
    _, obtener_reporte_dia, _, NEGOCIO_ID, *_ = _get_agente()

    fecha_str = request.args.get('fecha')
    negocio_id = int(request.args.get('negocio_id', NEGOCIO_ID))

    try:
        if fecha_str:
            from datetime import datetime
            fecha = datetime.strptime(fecha_str, "%Y-%m-%d").date()
        else:
            fecha = date.today()
    except ValueError:
        return jsonify({'error': 'Formato de fecha inválido. Usar YYYY-MM-DD.'}), 400

    try:
        reporte = obtener_reporte_dia(negocio_id=negocio_id, fecha=fecha)
        return jsonify(reporte), 200
    except Exception as e:
        current_app.logger.error(f"[Agente Facturación] Error reporte: {e}")
        return jsonify({'error': str(e)}), 500


# ────────────────────────────────────────────────────────────────────────────
# POST /api/agente/facturacion/ejecutar-hoy
# Body JSON opcional: { "modo": "simulacion"|"real", "negocio_id": 8 }
# Solo superadmin puede disparar manualmente
# ────────────────────────────────────────────────────────────────────────────
@bp.route('/agente/facturacion/ejecutar-hoy', methods=['POST'])
@token_required
def ejecutar_hoy(current_user):
    if current_user.get('rol') != 'superadmin':
        return jsonify({'error': 'No autorizado.'}), 403

    ejecutar_dia, _, _, NEGOCIO_ID, TOTAL_FACTURAS, MODO_EJECUCION, \
        PUNTO_DE_VENTA, TIPO_FACTURA, CUIT_NEGOCIO = _get_agente()

    data = request.get_json() or {}
    modo = data.get('modo', MODO_EJECUCION)
    negocio_id = int(data.get('negocio_id', NEGOCIO_ID))

    if modo not in ('simulacion', 'real'):
        return jsonify({'error': 'Modo inválido. Usar "simulacion" o "real".'}), 400

    try:
        resultado = ejecutar_dia(
            negocio_id=negocio_id,
            total_mensual=TOTAL_FACTURAS,
            modo=modo,
            punto_venta=PUNTO_DE_VENTA,
            tipo_factura=TIPO_FACTURA,
            cuit=CUIT_NEGOCIO,
        )
        current_app.logger.info(
            f"[Agente Facturación] Ejecución manual — fecha={resultado['fecha']} "
            f"ok={resultado['ok']} errores={resultado['errores']} modo={modo}"
        )
        return jsonify(resultado), 200
    except Exception as e:
        current_app.logger.error(f"[Agente Facturación] Error ejecución: {e}")
        return jsonify({'error': str(e)}), 500


# ────────────────────────────────────────────────────────────────────────────
# GET /api/agente/facturacion/distribucion-mes
# Query params: anio=2026&mes=3 (default: mes actual)
# Vista previa del calendario: cuántas facturas se disparan cada día
# ────────────────────────────────────────────────────────────────────────────
@bp.route('/agente/facturacion/distribucion-mes', methods=['GET'])
@token_required
def distribucion_mes(current_user):
    _, _, calcular_distribucion_mensual, _, TOTAL_FACTURAS, *_ = _get_agente()

    hoy = date.today()
    try:
        anio = int(request.args.get('anio', hoy.year))
        mes  = int(request.args.get('mes',  hoy.month))
        total = int(request.args.get('total', TOTAL_FACTURAS))
    except ValueError:
        return jsonify({'error': 'Parámetros inválidos.'}), 400

    dist = calcular_distribucion_mensual(anio, mes, total)

    resultado = [
        {
            "fecha": str(d),
            "dia_semana": d.strftime("%A"),
            "cantidad": c
        }
        for d, c in sorted(dist.items())
    ]
    return jsonify({
        "anio": anio, "mes": mes, "total": total,
        "distribucion": resultado
    }), 200
