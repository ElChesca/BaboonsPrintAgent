# app/routes/ia_routes.py
import os
import json
import google.generativeai as genai
from flask import Blueprint, request, jsonify, g
from app.auth_decorator import token_required

ia_bp = Blueprint('ia', __name__)

# Configuración de Gemini
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

# Prompt Maestro para Facturas Argentinas (ARCA/AFIP)
SYSTEM_PROMPT = """
Eres el 'Baboon AI Scanner', un asistente experto en contabilidad argentina.
Tu objetivo es procesar fotos de comprobantes y devolver un JSON estricto.

INSTRUCCIONES DE EXTRACCIÓN:
1. Analiza el CUIT del Emisor y la Razón Social.
2. Identifica el Tipo de Comprobante (A, B, C, Recibo, Remito).
3. Extrae el número en formato XXXX-XXXXXXXX.
4. Extrae la fecha en formato YYYY-MM-DD.
5. Desglosa los importes: Neto Gravado, IVA 27%, IVA 21%, IVA 10.5%, IVA 2.5%, Percepciones y Total.
6. Extrae los ítems en un array: {producto, cantidad, precio_unitario, iva_p}.

REGLA DE ORO:
- Devuelve ÚNICAMENTE el objeto JSON. Sin backticks, sin texto adicional.
- Si no encuentras un valor, usa null.

ESTRUCTURA JSON REQUERIDA:
{
  "cuit_emisor": "string",
  "razon_social": "string",
  "tipo_comprobante": "string",
  "nro_comprobante": "string",
  "fecha": "string",
  "neto_gravado": 0.0,
  "iva_27": 0.0,
  "iva_21": 0.0,
  "iva_105": 0.0,
  "iva_25": 0.0,
  "iibb_percepcion": 0.0,
  "iva_percepcion": 0.0,
  "total": 0.0,
  "items": [
    {
      "producto": "string",
      "cantidad": 0.0,
      "precio_unitario": 0.0,
      "iva_p": 21.0
    }
  ]
}
"""

@ia_bp.route('/ia/extract-invoice', methods=['POST'])
@token_required
def extract_invoice(current_user):
    if 'file' not in request.files:
        return jsonify({'error': 'No se recibió ningún archivo.'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Nombre de archivo vacío.'}), 400

    try:
        image_data = file.read()
        
        # Modelo 1.5 Flash por velocidad y bajo costo
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        response = model.generate_content([
            SYSTEM_PROMPT,
            {'mime_type': file.content_type, 'data': image_data}
        ])

        # Limpiar respuesta (eliminar ```json ... ``` si existen)
        clean_text = response.text.strip()
        if clean_text.startswith("```"):
            clean_text = clean_text.replace("```json", "").replace("```", "").strip()
        
        data = json.loads(clean_text)
        
        # Log de uso (opcional pero recomendado)
        print(f"IA Scan completado para usuario {current_user['id']}")
        
        return jsonify(data), 200

    except Exception as e:
        print(f"Error IA Scanner: {str(e)}")
        return jsonify({'error': 'Error al procesar con IA. Intente una imagen más nítida.'}), 500
