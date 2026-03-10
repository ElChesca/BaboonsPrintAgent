# app/services/eventos_notifications.py
import qrcode
import io
import os
from flask import current_app, render_template_string
from flask_mail import Message
from app import mail

class EventosNotificationsService:
    @staticmethod
    def generar_qr_base64(token):
        """Genera un código QR a partir de un token (UUID) y lo devuelve como bytes."""
        # Se puede usar una URL que el operador escaneará
        data = f"https://multinegociobaboons-fly.fly.dev/api/eventos/asistencia?token={token}"
        
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(data)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='PNG')
        return img_byte_arr.getvalue()

    @staticmethod
    def enviar_confirmacion_inscripcion(inscripcion, evento):
        """Envía el correo electrónico de confirmación con el QR adjunto."""
        try:
            # Generar el QR
            qr_bytes = EventosNotificationsService.generar_qr_base64(inscripcion['token_asistencia'])
            
            msg = Message(
                subject=f"Confirmación de Inscripción: {evento['titulo']}",
                recipients=[inscripcion['email']],
                sender=current_app.config['MAIL_DEFAULT_SENDER']
            )
            
            # Template simple de email
            html_content = f"""
            <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                        <h2 style="color: #2c3e50;">¡Hola {inscripcion['nombre_cliente']}!</h2>
                        <p>Tu inscripción para el evento <strong>{evento['titulo']}</strong> ha sido confirmada con éxito.</p>
                        
                        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p style="margin: 5px 0;"><strong>Fecha del Evento:</strong> {evento['fecha_evento']}</p>
                            <p style="margin: 5px 0;"><strong>Ubicación:</strong> {evento['ubicacion'] or 'A confirmar'}</p>
                        </div>

                        <p>Presentá el código QR adjunto el día del evento para registrar tu ingreso.</p>
                        
                        <p style="font-size: 0.9em; color: #7f8c8d;">Si tenés alguna duda, contactanos respondiendo a este correo.</p>
                        
                        <hr style="border: 0; border-top: 1px solid #eee;">
                        <p style="text-align: center; color: #95a5a6; font-size: 0.8em;">Potenciado por Baboons</p>
                    </div>
                </body>
            </html>
            """
            msg.html = html_content
            
            # Adjuntar QR
            msg.attach(
                filename="entrada_qr.png",
                content_type="image/png",
                data=qr_bytes
            )
            
            mail.send(msg)
            return True
        except Exception as e:
            print(f"Error enviando email: {e}")
            return False
