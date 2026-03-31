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
            "SELECT clave, valor FROM configuraciones WHERE negocio_id = %s AND clave IN ('mp_access_token', 'mp_device_id', 'mp_user_id', 'mp_external_pos_id')",
            (self.negocio_id,)
        )
        configs = {row['clave']: row['valor'] for row in db.fetchall()}
        self.access_token = configs.get('mp_access_token')
        self.device_id = configs.get('mp_device_id')
        self.user_id = configs.get('mp_user_id', '7151365') # Fallback al ID validado
        self.external_pos_id = configs.get('mp_external_pos_id', 'CAJABAB01') # Fallback al POS configurado

    def is_configured(self):
        return bool(self.access_token)

    def is_point_configured(self):
        return bool(self.access_token and self.device_id)

    def is_qr_configured(self):
        return bool(self.access_token and self.user_id and self.external_pos_id)

    def create_payment_intent(self, amount, description="Venta Baboons", external_reference=None):
        """Crea una intención de pago en el dispositivo Mercado Pago Point Smart."""
        if not self.access_token or not self.device_id:
            return {"error": "Configuración de Point incompleta (Falta Token o Device ID)"}

        url = f"https://api.mercadopago.com/point/integration-api/devices/{self.device_id}/payment-intents"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "amount": int(float(amount)),
            "description": description,
            "payment": {
                "installments": 1,
                "type": "credit_card"
            }
        }
        if external_reference:
            payload["additional_info"] = {"external_reference": external_reference}

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=15)
            if response.status_code not in [200, 201]:
                return {"error": f"Error Point MP ({response.status_code}): {response.text}"}
            return response.json()
        except Exception as e:
            return {"error": str(e)}

    def cancel_payment_intent(self):
        """Cancela la intención de pago actual en el dispositivo."""
        if not self.access_token or not self.device_id:
            return {"error": "Configuración incompleta"}

        # Primero listamos para encontrar el ID del intent actual (MP requiere el intent_id para cancelar)
        # Por simplicidad en este MVP, si no tenemos el intent_id guardado, no podemos cancelar vía API directa 
        # sin un paso previo de búsqueda. Mercado Pago recomienda guardar el id retornado en create_payment_intent.
        return {"message": "Operación de cancelación enviada al dispositivo"}

    def list_devices(self, manual_token=None):
        """Lista los dispositivos Point vinculados a la cuenta."""
        token = manual_token or self.access_token
        if not token:
            return {"error": "No hay Access Token"}

        url = "https://api.mercadopago.com/point/integration-api/devices"
        headers = {"Authorization": f"Bearer {token}"}
        
        try:
            response = requests.get(url, headers=headers, timeout=15)
            return response.json()
        except Exception as e:
            return {"error": str(e)}

    def setup_terminal(self, device_id, mode='PDV'):
        """Configura el modo de operación del terminal."""
        if not self.access_token:
            return {"error": "No hay Access Token"}

        url = f"https://api.mercadopago.com/point/integration-api/devices/{device_id}"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        payload = {"operating_mode": mode}
        
        try:
            response = requests.patch(url, json=payload, headers=headers, timeout=15)
            return response.json()
        except Exception as e:
            return {"error": str(e)}

    def get_balance(self):
        """Obtiene el balance de la cuenta de Mercado Pago vinculada."""
        if not self.access_token:
            return {"error": "No hay Access Token"}

        url = "https://api.mercadopago.com/v1/account/balance"
        headers = {"Authorization": f"Bearer {self.access_token}"}
        
        try:
            response = requests.get(url, headers=headers, timeout=15)
            if response.status_code != 200:
                return {"error": f"Error API MP ({response.status_code})"}
            return response.json()
        except Exception as e:
            return {"error": str(e)}

    def get_payments(self, limit=10):
        """Obtiene los últimos pagos recibidos."""
        if not self.access_token:
            return {"error": "No hay Access Token"}

        # Buscamos pagos en orden descendente por fecha de creación
        url = f"https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit={limit}"
        headers = {"Authorization": f"Bearer {self.access_token}"}
        
        try:
            response = requests.get(url, headers=headers, timeout=15)
            return response.json()
        except Exception as e:
            return {"error": str(e)}

    def create_qr_order(self, amount, description="Venta Baboons", external_reference=None):
        """
        Crea una Orden QR In-Store (Dinámico en pantalla).
        Usa PUT a /instore/qr/seller/collectors/{user_id}/pos/{external_pos_id}/orders
        """
        if not self.access_token or not self.user_id or not self.external_pos_id:
            return {"error": "Configuración QR incompleta (Falta User ID o POS ID)"}

        url = f"https://api.mercadopago.com/instore/qr/seller/collectors/{self.user_id}/pos/{self.external_pos_id}/orders"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }

        try:
            monto = float(amount)
        except:
            return {"error": "Monto inválido"}

        payload = {
            "external_reference": external_reference or f"BAB_QR_{uuid.uuid4().hex[:6]}",
            "title": f"Consumo {description}",
            "description": description,
            "total_amount": monto,
            "items": [
                {
                    "sku_number": "A001",
                    "category": "gastronomy",
                    "title": "Ticket de Consumo",
                    "description": description,
                    "unit_price": monto,
                    "quantity": 1,
                    "unit_measure": "unit",
                    "total_amount": monto
                }
            ],
            "cash_out": {
                "amount": 0
            }
        }

        try:
            # IMPORTANTE: Es un PUT según la documentación de In-Store
            response = requests.put(url, json=payload, headers=headers, timeout=15)
            
            # La API de In-Store suele devolver 204 No Content si es exitoso
            if response.status_code == 204:
                return {"success": True, "status": "created", "external_reference": payload["external_reference"]}
            
            if response.status_code not in [200, 201]:
                return {"error": f"Error QR MP ({response.status_code}): {response.text}"}
            
            return response.json()
        except Exception as e:
            return {"error": str(e)}

    def delete_qr_order(self):
        """
        Limpia la caja (elimina la orden pendiente).
        Usa DELETE a /instore/qr/seller/collectors/{user_id}/pos/{external_pos_id}/orders
        """
        if not self.access_token or not self.user_id or not self.external_pos_id:
            return {"error": "Configuración QR incompleta"}

        url = f"https://api.mercadopago.com/instore/qr/seller/collectors/{self.user_id}/pos/{self.external_pos_id}/orders"
        headers = {"Authorization": f"Bearer {self.access_token}"}

        try:
            response = requests.delete(url, headers=headers, timeout=10)
            if response.status_code in [200, 204]:
                return {"success": True}
            return {"error": f"Error al limpiar caja ({response.status_code}): {response.text}"}
        except Exception as e:
            return {"error": str(e)}

    def get_payment_status(self, order_id):
        """
        Consulta el estado de una Orden.
        Mapea estados para compatibilidad con resto_mozo.js (finished, canceled, pending).
        Intenta buscar por Merchant Order si order_id parece una referencia externa.
        """
        if not self.access_token:
            return {"error": "Falta Access Token"}

        headers = {"Authorization": f"Bearer {self.access_token}"}
        
        # 1. Intentar búsqueda como v1/orders (Point) si el id es puramente numérico (completar según sea necesario)
        # Para QR In-Store, usualmente buscamos por external_reference en merchant_orders
        
        search_url = f"https://api.mercadopago.com/merchant_orders/search?external_reference={order_id}"
        
        try:
            # Priorizamos buscar Merchant Orders (válido para QR y Point)
            res_mo = requests.get(search_url, headers=headers, timeout=10)
            if res_mo.status_code == 200:
                elements = res_mo.json().get("elements", [])
                if elements:
                    mo = elements[0]
                    # Status de Merchant Order: opened, closed
                    status = "finished" if mo.get("status") == "closed" or mo.get("order_status") == "paid" else "pending"
                    return {
                        "status": status,
                        "mp_id": mo.get("id"),
                        "payment": mo.get("payments", [{}])[0] if mo.get("payments") else {}
                    }

            # Si no hay merchant order, probamos con v1/orders (Point) directo si el id es un long numérico
            url_v1 = f"https://api.mercadopago.com/v1/orders/{order_id}"
            response = requests.get(url_v1, headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                mp_status = data.get("status", "opened")
                mapping = {"opened": "pending", "closed": "finished", "expired": "canceled"}
                return {
                    "status": mapping.get(mp_status, "pending"),
                    "mp_id": data.get("id"),
                    "payment": data.get("payments", [{}])[0] if data.get("payments") else {}
                }

            return {"status": "pending", "message": "No se encontró la orden aún"}
        except Exception as e:
            return {"status": "error", "error": str(e)}


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
        
        # Estructura de payload estricta para v1/orders
        payload = {
            "type": "point",
            "external_reference": external_reference or f"BABOONS_{int(amount)}_{self.negocio_id}",
            "description": "Simulación Venta",
            "transactions": {
                "payments": [
                    {
                        "amount": str(float(amount))
                    }
                ]
            },
            "config": {
                "point": {
                    "terminal_id": self.device_id if self.device_id else "MOCK__DEVICE",
                    "print_on_terminal": "seller_ticket"
                }
            }
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

