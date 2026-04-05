# app/routes/compras_routes.py
from flask import Blueprint, request, jsonify, g, make_response, current_app
from app.database import get_db
from app.auth_decorator import token_required
import datetime
from fpdf import FPDF
import io
from decimal import Decimal

bp = Blueprint('compras', __name__)

# --- CRUD Órdenes de Compra ---

@bp.route('/negocios/<int:negocio_id>/compras/orden', methods=['POST'])
@token_required
def crear_orden_compra(current_user, negocio_id):
    data = request.get_json()
    proveedor_id = data.get('proveedor_id')
    detalles = data.get('detalles') # [{producto_id, cantidad, precio_costo}]
    observaciones = data.get('observaciones', '')
    
    if not proveedor_id or not detalles:
        return jsonify({'error': 'Faltan datos obligatorios (proveedor o productos)'}), 400

    db = get_db()
    try:
        # Generar número de OC correlativo (ej: OC-0001)
        db.execute("SELECT COUNT(*) as total FROM ordenes_compra WHERE negocio_id = %s", (negocio_id,))
        count = db.fetchone()['total']
        numero_oc = f"OC-{str(count + 1).zfill(4)}"

        total_estimado = sum(Decimal(str(d['cantidad'])) * Decimal(str(d.get('precio_costo', 0))) for d in detalles)

        # 1. Insertar cabecera
        db.execute(
            """
            INSERT INTO ordenes_compra (negocio_id, proveedor_id, usuario_id, numero_oc, total_estimado, observaciones, estado)
            VALUES (%s, %s, %s, %s, %s, %s, 'abierta') RETURNING id
            """,
            (negocio_id, proveedor_id, current_user['id'], numero_oc, float(total_estimado), observaciones)
        )
        orden_id = db.fetchone()['id']

        # 2. Insertar detalles
        for item in detalles:
            subtotal = Decimal(str(item['cantidad'])) * Decimal(str(item.get('precio_costo', 0)))
            db.execute(
                """
                INSERT INTO ordenes_compra_detalle (orden_id, producto_id, cantidad, precio_costo_actual, subtotal)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (orden_id, item['producto_id'], item['cantidad'], item.get('precio_costo', 0), float(subtotal))
            )

        g.db_conn.commit()
        return jsonify({'message': 'Orden de Compra creada con éxito', 'id': orden_id, 'numero_oc': numero_oc}), 201

    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/compras/ordenes', methods=['GET'])
@token_required
def listar_ordenes_compra(current_user, negocio_id):
    db = get_db()
    estado = request.args.get('estado')
    query = """
        SELECT oc.*, p.nombre as proveedor_nombre, u.nombre as usuario_nombre
        FROM ordenes_compra oc
        JOIN proveedores p ON oc.proveedor_id = p.id
        JOIN usuarios u ON oc.usuario_id = u.id
        WHERE oc.negocio_id = %s
    """
    params = [negocio_id]
    if estado:
        query += " AND oc.estado = %s"
        params.append(estado)
    
    query += " ORDER BY oc.fecha DESC"
    try:
        db.execute(query, tuple(params))
        rows = db.fetchall()
        
        # Formatear decimales y fechas
        result = []
        for r in rows:
            d = dict(r)
            # Manejo robusto de tipos para JSON
            if 'total_estimado' in d and isinstance(d['total_estimado'], Decimal):
                d['total_estimado'] = float(d['total_estimado'])
            
            if 'fecha' in d and d['fecha']:
                if hasattr(d['fecha'], 'isoformat'):
                    d['fecha'] = d['fecha'].isoformat()
                else:
                    d['fecha'] = str(d['fecha']) # Fallback a string si ya lo es o es otro tipo

            result.append(d)
            
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/compras/orden/<int:orden_id>', methods=['GET'])
@token_required
def detalle_orden_compra(current_user, orden_id):
    db = get_db()
    db.execute("""
        SELECT oc.*, p.nombre as proveedor_nombre, p.email as proveedor_email, p.cuit as proveedor_cuit
        FROM ordenes_compra oc
        JOIN proveedores p ON oc.proveedor_id = p.id
        WHERE oc.id = %s
    """, (orden_id,))
    oc = db.fetchone()
    if not oc: return jsonify({'error': 'No encontrada'}), 404
    
    db.execute("""
        SELECT ocd.*, p.nombre as producto_nombre, p.sku
        FROM ordenes_compra_detalle ocd
        JOIN productos p ON ocd.producto_id = p.id
        WHERE ocd.orden_id = %s
    """, (orden_id,))
    detalles = db.fetchall()
    
    res = dict(oc)
    res['detalles'] = [dict(d) for d in detalles]
    
    # --- Trazabilidad: Buscar Ingreso vinculado ---
    db.execute("""
        SELECT id, factura_tipo, factura_prefijo, factura_numero, fecha
        FROM ingresos_mercaderia
        WHERE orden_compra_id = %s
    """, (orden_id,))
    ingreso = db.fetchone()
    if ingreso:
        res['ingreso_vinculado'] = dict(ingreso)
        if hasattr(res['ingreso_vinculado']['fecha'], 'isoformat'):
             res['ingreso_vinculado']['fecha'] = res['ingreso_vinculado']['fecha'].isoformat()
    
    # Conversión de tipos para JSON
    for k, v in res.items():
        if isinstance(v, Decimal): res[k] = float(v)
        if isinstance(v, datetime.datetime): res[k] = v.isoformat()
    
    for d in res['detalles']:
        for k, v in d.items():
            if isinstance(v, Decimal): d[k] = float(v)
            
    return jsonify(res)

# --- Generación de PDF ---

class PDF_OC(FPDF):
    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.cell(0, 10, f'Página {self.page_no()}', 0, 0, 'C')

@bp.route('/negocios/<int:negocio_id>/compras/orden/<int:orden_id>/pdf', methods=['GET'])
@token_required
def generar_pdf_oc(current_user, negocio_id, orden_id):
    db = get_db()
    # 1. Obtener datos de la OC
    db.execute("""
        SELECT oc.*, p.nombre as prov_nombre, p.direccion as prov_direccion, p.telefono as prov_tel, p.cuit as prov_cuit, p.email as prov_email
        FROM ordenes_compra oc
        JOIN proveedores p ON oc.proveedor_id = p.id
        WHERE oc.id = %s
    """, (orden_id,))
    oc = db.fetchone()
    
    # 2. Obtener datos del Negocio
    db.execute("SELECT * FROM negocios WHERE id = %s", (negocio_id,))
    negocio = db.fetchone()
    
    # 3. Obtener detalles
    db.execute("""
        SELECT ocd.*, p.nombre as prod_nombre, p.sku, p.unidad_medida
        FROM ordenes_compra_detalle ocd
        JOIN productos p ON ocd.producto_id = p.id
        WHERE ocd.orden_id = %s
    """, (orden_id,))
    detalles = db.fetchall()

    if not oc or not negocio:
        return "Orden no encontrada", 404

    # --- Generar PDF con FPDF ---
    pdf = PDF_OC()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    
    # --- ENCABEZADO PROFESIONAL ---
    pdf.set_fill_color(245, 245, 245)
    pdf.rect(10, 10, 190, 35, 'F')
    
    pdf.set_xy(15, 15)
    pdf.set_font('Arial', 'B', 18)
    pdf.set_text_color(44, 62, 80)
    pdf.cell(100, 10, negocio['nombre'].upper(), 0, 0, 'L')
    
    pdf.set_xy(115, 15)
    pdf.set_font('Arial', 'B', 14)
    pdf.set_text_color(127, 140, 141)
    pdf.cell(80, 10, 'ORDEN DE COMPRA', 0, 1, 'R')
    
    pdf.set_xy(15, 25)
    pdf.set_font('Arial', '', 9)
    pdf.set_text_color(50, 50, 50)
    pdf.cell(100, 5, f"CUIT: {negocio.get('cuit', '-')}", 0, 1)
    pdf.set_x(15)
    pdf.cell(100, 5, f"Dir: {negocio.get('direccion', '-')}", 0, 1)
    
    pdf.set_xy(115, 25)
    pdf.set_font('Arial', 'B', 10)
    pdf.set_text_color(44, 62, 80)
    pdf.cell(80, 5, f"Número: {oc['numero_oc']}", 0, 1, 'R')
    pdf.set_x(115)
    pdf.cell(80, 5, f"Fecha: {oc['fecha'].strftime('%d/%m/%Y %H:%M')}", 0, 1, 'R')
    
    pdf.ln(12)
    
    # --- SECCIÓN PROVEEDOR ---
    pdf.set_font('Arial', 'B', 11)
    pdf.set_fill_color(52, 73, 94)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 8, '  DETALLES DEL PROVEEDOR', 0, 1, 'L', fill=True)
    
    pdf.ln(2)
    pdf.set_text_color(0, 0, 0)
    pdf.set_font('Arial', 'B', 10)
    pdf.cell(100, 6, f"Razón Social: {oc['prov_nombre']}", 0, 0)
    pdf.set_font('Arial', '', 10)
    pdf.cell(90, 6, f"CUIT: {oc['prov_cuit'] or '-'}", 0, 1)
    
    pdf.cell(100, 6, f"Teléfono: {oc['prov_tel'] or '-'}", 0, 0)
    pdf.cell(90, 6, f"Email: {oc['prov_email'] or '-'}", 0, 1)
    pdf.cell(0, 6, f"Dirección: {oc['prov_direccion'] or '-'}", 0, 1)
    
    pdf.ln(5)
    
    # --- TABLA DE ITEMS ---
    pdf.set_font('Arial', 'B', 10)
    pdf.set_fill_color(230, 233, 237)
    pdf.set_text_color(44, 62, 80)
    
    pdf.cell(20, 8, 'Cant.', 1, 0, 'C', fill=True)
    pdf.cell(100, 8, ' Producto / Descripción', 1, 0, 'L', fill=True)
    pdf.cell(35, 8, 'Precio Unit. (Est.)', 1, 0, 'R', fill=True)
    pdf.cell(35, 8, 'Subtotal', 1, 1, 'R', fill=True)
    
    pdf.set_font('Arial', '', 10)
    pdf.set_text_color(0, 0, 0)
    
    for d in detalles:
        pdf.cell(20, 7, str(round(d['cantidad'], 2)), 1, 0, 'C')
        pdf.cell(100, 7, f" {d['prod_nombre'][:50]}", 1, 0, 'L')
        pdf.cell(35, 7, f"$ {float(d['precio_costo_actual']):,.2f} ", 1, 0, 'R')
        pdf.cell(35, 7, f"$ {float(d['subtotal']):,.2f} ", 1, 1, 'R')
        
    pdf.ln(2)
    pdf.set_font('Arial', 'B', 12)
    pdf.set_text_color(44, 62, 80)
    pdf.cell(120, 10, '', 0, 0)
    pdf.cell(35, 10, 'TOTAL: ', 0, 0, 'R')
    pdf.cell(35, 10, f"$ {float(oc['total_estimado']):,.2f} ", 1, 1, 'R')
    
    if oc['observaciones']:
        pdf.ln(5)
        pdf.set_font('Arial', 'B', 10)
        pdf.cell(0, 5, 'Observaciones:', 0, 1)
        pdf.set_font('Arial', '', 9)
        pdf.set_text_color(80, 80, 80)
        pdf.multi_cell(0, 5, oc['observaciones'], 1, 'L')

    # Retornar el PDF
    output = io.BytesIO()
    pdf.output(output)
    response = make_response(output.getvalue())
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = f'inline; filename={oc["numero_oc"]}.pdf'
    return response

@bp.route('/negocios/<int:negocio_id>/compras/orden/<int:orden_id>/data-para-ingreso', methods=['GET'])
@token_required
def get_oc_data_for_income(current_user, negocio_id, orden_id):
    """Retorna los datos de la OC para precargar el ingreso de mercadería."""
    db = get_db()
    db.execute("""
        SELECT oc.*, p.nombre as proveedor_nombre
        FROM ordenes_compra oc
        JOIN proveedores p ON oc.proveedor_id = p.id
        WHERE oc.id = %s AND oc.negocio_id = %s
    """, (orden_id, negocio_id))
    oc = db.fetchone()
    if not oc: return jsonify({'error': 'No encontrada'}), 404
    
    db.execute("""
        SELECT ocd.*, p.nombre as producto_nombre, p.sku
        FROM ordenes_compra_detalle ocd
        JOIN productos p ON ocd.producto_id = p.id
        WHERE ocd.orden_id = %s
    """, (orden_id,))
    detalles = db.fetchall()
    
    res = {
        'proveedor_id': oc['proveedor_id'],
        'proveedor_nombre': oc['proveedor_nombre'],
        'referencia': f"Importado de OC: {oc['numero_oc']}",
        'detalles': []
    }
    for d in detalles:
        res['detalles'].append({
            'producto_id': d['producto_id'],
            'producto_nombre': d['producto_nombre'],
            'sku': d['sku'],
            'cantidad': float(d['cantidad']),
            'precio_costo': float(d['precio_costo_actual'])
        })
    return jsonify(res)

@bp.route('/negocios/<int:negocio_id>/compras/orden/<int:orden_id>/cancelar', methods=['PUT'])
@token_required
def cancelar_orden_compra(current_user, orden_id):
    db = get_db()
    try:
        db.execute("UPDATE ordenes_compra SET estado = 'cancelada' WHERE id = %s", (orden_id,))
        g.db_conn.commit()
        return jsonify({'message': 'Orden cancelada'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500
