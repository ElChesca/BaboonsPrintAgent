# app/services/mercado_pago_service.py
import requests
import uuid
import sys
from app.database import get_db

class MercadoPagoService:
    def __init__(self, negocio_id):
        self.negocio_id = negocio_id
        self.access_token = None
        self.device_id = None
        self._load_config()

    def _load_config(self):
        """Carga las credenciales desde la tabla de configuraciones."""
        db = get_db()
        db.execute(
            "SELECT clave, valor FROM configuraciones WHERE negocio_id = %s AND clave IN ('mp_access_token', 'mp_device_id')",
            (self.negocio_id,)
        )
        configs = {row['clave']: row['valor'] for row in db.fetchall()}
        self.access_token = configs.get('mp_access_token')
        self.device_id = configs.get('mp_device_id')

    def is_configured(self):
        return bool(self.access_token and self.device_id)

    def create_payment_intent(self, amount, description="Venta Baboons", external_reference=None):
        """
        Envía una orden de pago al dispositivo Point configurado.
        API: POST /point/integration-api/devices/{device_id}/payment-intents
        """
        if not self.is_configured():
            return {"error": "Configuración de Mercado Pago incompleta"}

        url = f"https://api.mercadopago.com/point/integration-api/devices/{self.device_id}/payment-intents"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "X-Idempotency-Key": str(uuid.uuid4())
        }
        
        payload = {
            "amount": int(amount), # Mercado Pago Point a veces requiere entero en centavos o float dependiendo del dispositivo
            "description": description,
            "payment": {
                "installments": 1,
                "type": "credit_card" # O dejar que el cliente elija en el dispositivo
            }
        }
        
        if external_reference:
            payload["external_reference"] = external_reference

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            return response.json()
        except Exception as e:
            return {"error": f"Error de conexión con Mercado Pago: {str(e)}"}

    def get_payment_status(self, payment_intent_id):
        """Consulta el estado de un intento de pago específico."""
        if not self.access_token:
            return {"error": "Falta Access Token"}

        url = f"https://api.mercadopago.com/point/integration-api/payment-intents/{payment_intent_id}"
        headers = {"Authorization": f"Bearer {self.access_token}"}
        
        try:
            response = requests.get(url, headers=headers, timeout=10)
            return response.json()
        except Exception as e:
            return {"error": str(e)}

    # --- NUEVOS MÉTODOS PARA SIMULACIÓN (MOCK FLOW) ---

    def create_order(self, amount, external_reference=None):
        """
        Paso 1: Crear la Orden de Pago (Modo Point)
        API: POST https://api.mercadopago.com/v1/orders
        """
        if not self.access_token:
             return {"error": "Falta Access Token"}

        url = "https://api.mercadopago.com/v1/orders"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "X-Idempotency-Key": str(uuid.uuid4())
        }
        
        payload = {
            "external_reference": external_reference or f"BABOONS_{int(amount)}_{self.negocio_id}",
            "type": "point",
            "amount": float(amount)
        }

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            sys.stderr.write(f"DEBUG MP Create Order Status: {response.status_code}\n")
            sys.stderr.write(f"DEBUG MP Create Order Response: {response.text}\n")
            sys.stderr.flush()
            
            # Si falla la API real, devolvemos un Mock para no bloquear la simulación del frontend
            if response.status_code != 201:
                return {
                    "id": f"MOCK_ORDR_{uuid.uuid4().hex[:8]}",
                    "status": "opened",
                    "external_reference": payload.get("external_reference")
                }
                
            return response.json()
        except Exception as e:
            return {
                "id": f"MOCK_ORDR_ERR_{uuid.uuid4().hex[:8]}",
                "status": "opened",
                "external_reference": payload.get("external_reference")
            }

    def simulate_order_event(self, order_id, status="processed"):
        """
        Paso 2: Simular el cobro de la Orden
        API: POST https://api.mercadopago.com/v1/orders/{order_id}/events
        """
        if not self.access_token:
             return {"error": "Falta Access Token"}

        url = f"https://api.mercadopago.com/v1/orders/{order_id}/events"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "X-Idempotency-Key": str(uuid.uuid4())
        }
        
        payload = {
            "status": status,
            "payment_method_type": "credit_card",
            "credit_card": {
                "installments": 1,
                "payment_method_id": "visa"
            }
        }

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            if response.status_code in [200, 204]:
                return {"success": True}
            return response.json()
        except Exception as e:
            return {"error": str(e)}

    # --- NUEVOS MÉTODOS PARA CHECKOUT PRO (PAGOS ONLINE) ---

    def create_preference(self, title, unit_price, quantity=1, external_reference=None, notification_url=None):
        """
        Crea una preferencia de pago para que el cliente pague online.
        API: POST https://api.mercadopago.com/checkout/preferences
        """
        if not self.access_token:
            return {"error": "Falta Access Token"}

        url = "https://api.mercadopago.com/checkout/preferences"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }

        payload = {
            "items": [
                {
                    "title": title,
                    "quantity": quantity,
                    "unit_price": float(unit_price),
                    "currency_id": "ARS"
                }
            ],
            "external_reference": external_reference,
            "back_urls": {
                "success": "https://multinegociobaboons-fly.fly.dev/evento/status?status=success",
                "pending": "https://multinegociobaboons-fly.fly.dev/evento/status?status=pending",
                "failure": "https://multinegociobaboons-fly.fly.dev/evento/status?status=failure"
            },
            "auto_return": "approved",
            "binary_mode": True # Solo acepta pagos aprobados o rechazados (sin estados intermedios como 'in_process')
        }

        if notification_url:
            payload["notification_url"] = notification_url

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            return response.json()
        except Exception as e:
            return {"error": f"Error al crear preferencia MP: {str(e)}"}

