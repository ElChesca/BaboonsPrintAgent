# Walkthrough: Corrección de Pre-Cuenta y Regularización de Arquitectura

He completado las modificaciones necesarias para que el sistema de impresión de Restó reconozca correctamente el formato de la Pre-Cuenta (con precios unitarios, subtotales y leyendas legales).

## Cambios Realizados

### 1. Agente Local de Impresión (`baboons_print_router.py`)
> [!IMPORTANT]
> **ESTE ERA EL PROBLEMA PRINCIPAL.** El agente tenía el título "COMANDA DE COCINA" fijo en el código.
- Se actualizó para que reconozca el campo `type: 'BILL'`.
- Ahora, si es una cuenta, imprime el contenido dinámico enviado por el servidor en lugar del formato rígido de cocina.

### 2. Base de Datos (`migrations/`)
- Se creó la migración formal: `migrations/2026_04_02_1830_add_es_caja_to_resto_impresoras.sql`.
- Se eliminó el código de migración automática que estaba "sucio" dentro de las rutas de Python, cumpliendo con la **Regla 16**.

### 3. Backend (`resto_routes.py`)
- Se limpió la función `solicitar_cuenta_comanda`.
- Se aseguró que el envío de datos al agente local incluya tanto el texto formateado (`content`) como los ítems, para máxima compatibilidad.

## Instrucciones para Verificación Manual

Para ver los cambios reflejados, debes seguir estos pasos **exactamente**:

1.  **REINICIAR EL AGENTE**: Cierra el programa `Baboons_Print_Router` (o la consola donde corre el `.py`) y vuélvelo a ejecutar. Esto es vital para que tome el nuevo código que permite imprimir cuentas.
2.  **RECARGAR EL ERP**: En el navegador, asegúrate de estar en la `v1.6.6` (puedes hacer `Ctrl + F5`).
3.  **IMPRIMIR CUENTA**: Ve a una mesa abierta en el POS Mozo y presiona el ícono de la impresora <i class="fas fa-print"></i> (Solicitar Cuenta).
4.  **VALIDAR**: El ticket debe salir ahora con el título `*** PRE-CUENTA ***`, el detalle de `Cantidad x Precio = Subtotal` y la versión `V.1.0` al final.

---
> [!NOTE]
> Se han sincronizado estos documentos en la carpeta `docs/` según la Regla 5 del proyecto.
