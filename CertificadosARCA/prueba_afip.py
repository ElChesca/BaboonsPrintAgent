from datetime import datetime
from afip import Afip

cert = open("CertificadosARCA/certificado.crt").read()
# Key (Puede estar guardado en archivos, DB, etc)
key = open("CertificadosARCA/key.key").read()
# CUIT del certificado
tax_id = 23255653059
afip = Afip({
    "CUIT": tax_id,
    "cert": cert,
    "key": key
})

# Numero del punto de venta
punto_de_venta = 1

# Tipo de factura
tipo_de_factura = 6 # 6 = Factura B

# Número de la ultima Factura B
last_voucher = afip.ElectronicBilling.getLastVoucher(punto_de_venta, tipo_de_factura)

# Concepto de la factura
#
# Opciones:
#
# 1 = Productos 
# 2 = Servicios 
# 3 = Productos y Servicios
concepto = 1

# Tipo de documento del comprador
#
# Opciones:
#
# 80 = CUIT 
# 86 = CUIL 
# 96 = DNI
# 99 = Consumidor Final 
tipo_de_documento = 99

# Numero de documento del comprador (0 para consumidor final)
numero_de_documento = 0

# Numero de factura
numero_de_factura = last_voucher+1

# Fecha de la factura en formato aaaammdd (hasta 10 dias antes y 10 dias despues)
fecha = int(datetime.today().strftime("%Y%m%d"))

# Importe sujeto al IVA (sin icluir IVA)
importe_gravado = 100

# Importe exento al IVA
importe_exento_iva = 0

# Importe de IVA
importe_iva = 21

# Condición frente al IVA del receptor
# 
# Opciones:
#
# 1 = IVA Responsable Inscripto
# 4 = IVA Sujeto Exento
# 5 = Consumidor Final
# 6 = Responsable Monotributo
# 7 = Sujeto No Categorizado
# 8 = Proveedor del Exterior
# 9 = Cliente del Exterior
# 10 = IVA Liberado – Ley N° 19.640
# 13 = Monotributista Social
# 15 = IVA No Alcanzado
# 16 = Monotributo Trabajador Independiente Promovido
condicion_iva_receptor = 5

# Los siguientes campos solo son obligatorios para los conceptos 2 y 3
if concepto == 2 or concepto == 3:
	# Fecha de inicio de servicio en formato aaaammdd
	fecha_servicio_desde = int(datetime.today().strftime("%Y%m%d"))

	# Fecha de fin de servicio en formato aaaammdd
	fecha_servicio_hasta = int(datetime.today().strftime("%Y%m%d"))

	# Fecha de vencimiento del pago en formato aaaammdd
	fecha_vencimiento_pago = int(datetime.today().strftime("%Y%m%d"))
else:
	fecha_servicio_desde = None
	fecha_servicio_hasta = None
	fecha_vencimiento_pago = None

data = {
	"CantReg": 1, # Cantidad de facturas a registrar
	"PtoVta": punto_de_venta,
	"CbteTipo": tipo_de_factura, 
	"Concepto": concepto,
	"DocTipo": tipo_de_documento,
	"DocNro": numero_de_documento,
	"CbteDesde": numero_de_factura,
	"CbteHasta": numero_de_factura,
	"CbteFch": fecha,
	"FchServDesde": fecha_servicio_desde,
	"FchServHasta": fecha_servicio_hasta,
	"FchVtoPago": fecha_vencimiento_pago,
	"ImpTotal": importe_gravado + importe_iva + importe_exento_iva,
	"ImpTotConc": 0, # Importe neto no gravado
	"ImpNeto": importe_gravado,
	"ImpOpEx": importe_exento_iva,
	"ImpIVA": importe_iva,
	"ImpTrib": 0, # Importe total de tributos
	"MonId": "PES", # Tipo de moneda usada en la factura ("PES" = pesos argentinos) 
	"MonCotiz": 1, # Cotización de la moneda usada (1 para pesos argentinos)  
	"CondicionIVAReceptorId" : condicion_iva_receptor, 
	"Iva": [ # Alícuotas asociadas al factura
		{
			"Id": 5, # Id del tipo de IVA (5 = 21%)
			"BaseImp": importe_gravado,
			"Importe": importe_iva 
    		}
  	] 
}

# Creamos la Factura 
res = afip.ElectronicBilling.createVoucher(data)

# Mostramos por pantalla los datos de la nueva Factura 
print({
	"cae": res["CAE"], # CAE asignado a la Factura
	"vencimiento": res["CAEFchVto"] # Fecha de vencimiento del CAE
})
