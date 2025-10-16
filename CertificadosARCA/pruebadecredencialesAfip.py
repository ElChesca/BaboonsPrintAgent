import os
from afip import Afip 

# -- 1. CONFIGURACIÓN INICIAL --
CERT_PATH = "CertificadosARCA/Multinegocio_18b7c00d792f9327.crt" 
KEY_PATH = "CertificadosARCA/private_key.key"
CUIT = 23255653059 # Asegúrate de que este sea el CUIT correcto para Homologación

print("--- INICIANDO PRUEBA DE CONEXIÓN DEFINITIVA ---")
print(f"Usando CUIT: {CUIT}")
print(f"Certificado: {CERT_PATH}")
print(f"Clave Privada: {KEY_PATH}")

try:
    print("\n1. Creando instancia de Afip...")
    afip = Afip({
        "cuit": CUIT,
        "key": KEY_PATH, 
        "cert": CERT_PATH,
        "homologacion": True 
    })
    print("   Instancia creada con éxito.")

    print("\n2. Verificando estado del servidor de AFIP...")
    server_status = afip.ElectronicBilling.getServerStatus()
    
    print("\n¡CONEXIÓN Y AUTENTICACIÓN EXITOSAS!")
    print("El problema no está en el código, sino en los datos o habilitaciones.")
    print("\nEstado de los servidores de AFIP:")
    for service, status in server_status.items():
        print(f"  - {service}: {status}")

except Exception as e:
    print(f"\nERROR CRÍTICO: La conexión o autenticación falló.")
    print(f"   MOTIVO: {e}")
    print("\n   REVISA ESTOS PUNTOS:")
    print("   1. ¿El CUIT en el script es el mismo que usaste para generar los certificados?")
    print("   2. ¿Habilitaste el servicio 'Facturación Electrónica' para este CUIT en el entorno de Homologación de AFIP?")
    print("   3. ¿La llave privada (.key) corresponde al certificado (.crt) que estás usando?")

print("\n--- PRUEBA FINALIZADA ---")
