# 🤖 Baboon AI Scanner - Documentación Técnica

Este módulo permite la automatización total de la carga de facturas y remitos utilizando visión artificial (IA) mediante **Gemini 1.5 Flash**. Está diseñado bajo un esquema modular para permitir su fácil portabilidad a otros proyectos.

## 📁 Estructura de Archivos

| Archivo | Función |
| :--- | :--- |
| `app/routes/ia_routes.py` | Servidor: Procesa imágenes, gestiona el Prompt Maestro y devuelve JSON. |
| `app/static/js/modules/ia_scanner.js` | Cliente Core: Lógica de cámara, carga de archivos y UI del Scanner. |
| `app/static/ingresos.html` | UI: Botón disparador e integración visual Premium. |
| `app/static/js/modules/ingresos.js` | Integración: Mapea los datos de la IA al formulario de compras. |

---

## 🚀 Guía de Implementación (Walkthrough)

### 1. Preparación del Entorno
Es necesario contar con la librería de Google y la API Key:
```bash
pip install google-generativeai
```
En el archivo `.env` o variables de entorno:
`GEMINI_API_KEY=AIzaSy...`

### 2. El Prompt Maestro (System Prompt)
Ubicado en `ia_routes.py`, este prompt es el corazón del sistema. Está instruido para:
- Reconocer el formato de facturas argentinas (Punto de Venta - Número).
- Discriminar alícuotas de IVA (27%, 21%, 10.5%, 2.5%).
- Extraer ítems aunque la tabla sea compleja.

### 3. El Modal Premium
El modal está inyectado dinámicamente desde `ia_scanner.js`. Utiliza:
- **Estado de Carga:** Un spinner personalizado que indica que la IA está pensando.
- **Captura Flexible:** Funciona tanto para subir archivos desde PC como para abrir la cámara en dispositivos móviles (`capture="environment"`).

---

## ⚠️ Consideraciones Importantes

> [!IMPORTANT]
> **Privacidad y Datos:** La imagen se procesa en memoria y se envía directamente a la API de Google. No se almacena en el servidor local para cumplir con normativas de privacidad de datos sensibles.

> [!TIP]
> **Calidad de Imagen:** Para mejores resultados, se recomienda tomar la foto de frente y con buena iluminación. Gemini es muy tolerante, pero las sombras pronunciadas sobre los números pueden causar errores de precisión.

> [!WARNING]
> **Validación Humana:** Aunque la IA es extremadamente precisa (95%+), el usuario siempre debe revisar los totales antes de hacer clic en "Guardar Ingreso". El sistema resalta los campos poblados por la IA para facilitar esta revisión.

---

## 🛠️ Mantenimiento y Migración
Para llevar este módulo a otro proyecto:
1. Copia `ia_routes.py` a la carpeta de rutas del nuevo proyecto.
2. Registra el blueprint en el `create_app()` de la nueva app.
3. Copia `ia_scanner.js` a tu carpeta de módulos estáticos.
4. Llama a `BaboonAIScanner.openModal()` desde cualquier botón con el callback de mapeo deseado.

---
**Desarrollado por el Equipo Baboon Premium - IA Division** 🚀
