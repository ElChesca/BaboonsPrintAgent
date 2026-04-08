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
Tu objetivo es procesar fotos o documentos PDF de comprobantes y devolver un JSON estricto.

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

INSTRUCCIONES CRÍTICAS: 
1. Respeta CADA LÍNEA del comprobante. No agrupes items aunque se repitan.
2. Si un item tiene precio unitario 0 o indica que es regalo/bonificación, marca "bonificado": true.
3. Si el precio unitario no está claro pero hay un subtotal, calcúlalo.

ESTRUCTURA JSON REQUERIDA (Responde solo el JSON):
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
      "iva_p": 21.0,
      "bonificado": false
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
        
        # Intentar con modelos en orden de cuota/estabilidad
        models_to_try = ['gemini-1.5-flash', 'gemini-2.5-flash']
        response = None
        last_error = None

        for m_name in models_to_try:
            try:
                print(f"Probando modelo IA: {m_name}")
                model = genai.GenerativeModel(m_name)
                response = model.generate_content([
                    SYSTEM_PROMPT,
                    {'mime_type': file.content_type, 'data': image_data}
                ])
                break # Éxito
            except Exception as e:
                last_error = e
                # Si el modelo no existe (404), probamos el siguiente
                if "404" in str(e) or "not found" in str(e).lower():
                    continue
                # Si es 429 u otro error crítico, lo lanzamos para que lo atrape el bloque externo
                raise e

        if not response:
            raise last_error

        # Limpieza agresiva de JSON (Gemini a veces pone charla antes o después)
        clean_text = response.text.strip()
        if "{" in clean_text and "}" in clean_text:
            start = clean_text.find("{")
            end = clean_text.rfind("}") + 1
            clean_text = clean_text[start:end]
        
        try:
            data = json.loads(clean_text)
        except json.JSONDecodeError as je:
            print(f"Falla de formato JSON IA: {clean_text}")
            return jsonify({'error': 'La IA devolvió un formato inválido.', 'debug': str(je)}), 500
        
        # Log de uso
        print(f"IA Scan completado para usuario {current_user['id']}")
        return jsonify(data), 200

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error IA Scanner: {error_trace}")
        
        # Si es un error de cuota (Rate Limit), devolvemos 429 para que el frontend reintente
        error_msg = str(e)
        if "429" in error_msg or "ResourceExhausted" in error_msg or "quota" in error_msg.lower():
            return jsonify({'error': f'Límite de velocidad de IA alcanzado: {error_msg}'}), 429
            
        return jsonify({'error': f'Error en el motor de IA: {error_msg}'}), 500
