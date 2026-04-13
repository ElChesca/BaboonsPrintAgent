# ✅ Walkthrough: CRM Meta (WhatsApp / Instagram / Facebook)

> **Fecha:** 2026-04-10  
> **Conversación:** ec8ce9d0-c400-4b00-a802-143878f0ab7f  
> **Estado de migración SQL:** ✅ Ejecutada con éxito en producción (Neon)

---

## 📦 Resumen de cambios implementados

### FASE 1 — Base de Datos
- ✅ `crm_leads` extendida con 7 columnas nuevas (`plataforma_origen`, `wa_id`, `instagram_id`, `facebook_id`, `activo`, `actualizado_en`, `etiqueta`)
- ✅ Deduplicación de registros preexistentes (conserva `MAX(id)` por grupo)
- ✅ Constraint único `crm_leads_negocio_tel_plataforma_uq` creado
- ✅ Tabla `meta_configuraciones` creada (credenciales Meta por negocio)
- ✅ Tabla `crm_mensajes` creada con FK a `crm_leads(id)` y control de duplicados por `meta_msg_id`

### FASE 2 — Backend
- ✅ `app/routes/crm_meta_routes.py` creado con 6 endpoints
- ✅ Registrado en `app/__init__.py` (sin tocar blueprints existentes)

### FASE 3 — Registro del Módulo
- ✅ `admin_routes.py`: `crm_meta` en catálogo bajo 'Ventas' para `['resto', 'distribuidora', 'retail']`
- ✅ `_modules_seeded = False` reseteado para forzar re-seed
- ✅ `erp_registry.js`: entrada `crm_meta` agregada con color verde WhatsApp

### FASE 4 — Frontend
- ✅ `app/static/crm_meta.html`: layout tipo WhatsApp Web (dos paneles)
- ✅ `app/static/js/modules/crm_meta.js`: lógica completa con polling de 10s

---

## 🧪 Pasos de Verificación Manual

Seguí estos pasos **en orden** desde la interfaz del ERP:

### Paso 1 — Verificar que el módulo aparece en el dashboard

1. Hacer **deploy** a Fly.io (`git push main`)
2. Abrir el ERP y seleccionar cualquier negocio (Restó, Distribuidora o Retail)
3. En el dashboard principal, verificar que aparece la tarjeta **"CRM Meta (WhatsApp/IG/FB)"** en la sección de `operaciones`
4. ✅ Esperado: la tarjeta muestra el ícono de clientes con borde verde

---

### Paso 2 — Configurar las credenciales Meta

1. Abrir el módulo **CRM Meta**
2. Verificar que el badge superior dice **"● Sin configurar"** (color amarillo)
3. Hacer clic en **⚙️ Configurar Meta**
4. Completar el formulario:
   - **Phone Number ID**: obtenido en Meta Business Suite → WhatsApp → Número de teléfono
   - **Access Token**: token permanente de la app en Meta Developers
   - **Verify Token**: un string secreto propio (ej: `baboons_crm_2026`)
   - **WABA ID** (opcional)
5. Hacer clic en **Guardar configuración**
6. ✅ Esperado: badge cambia a **"● Conectado"** (color verde)

---

### Paso 3 — Verificar el Webhook de verificación (GET)

Desde un navegador o Postman, acceder a:

```
GET https://[tu-dominio]/api/webhooks/meta
    ?hub.mode=subscribe
    &hub.challenge=TEST_BABOONS_123
    &hub.verify_token=[el Verify Token que configuraste]
```

- ✅ Esperado: respuesta `200 OK` con cuerpo `TEST_BABOONS_123` (texto plano)
- ❌ Si retorna `403`: el verify_token no coincide con lo guardado en `meta_configuraciones`

---

### Paso 4 — Registrar el Webhook en Meta Business Suite

1. Ir a [Meta Developers](https://developers.facebook.com) → tu app → WhatsApp → Configuración
2. En **Webhooks**, hacer clic en **Editar**
3. URL de callback: `https://[tu-dominio]/api/webhooks/meta`
4. Token de verificación: el mismo string que configuraste en el ERP
5. Hacer clic en **Verificar y guardar**
6. ✅ Esperado: Meta muestra ✅ Verificado

---

### Paso 5 — Recibir un mensaje de prueba

1. Enviar un mensaje de WhatsApp **al número de la cuenta configurada**
2. Volver al ERP → módulo **CRM Meta**
3. Hacer clic en **🔄** (refresh)
4. ✅ Esperado: el contacto aparece en la lista izquierda con el preview del mensaje
5. Hacer clic sobre el contacto
6. ✅ Esperado: el mensaje aparece como burbuja gris (izquierda, `tipo_emisor = 'cliente'`)

---

### Paso 6 — Enviar una respuesta desde el ERP

1. Con el contacto seleccionado, escribir un mensaje en el input inferior
2. Presionar **Enter** o el botón **Enviar**
3. ✅ Esperado: burbuja verde (derecha, `tipo_emisor = 'agente'`) aparece en el chat
4. Verificar en el teléfono que el mensaje llegó via WhatsApp
5. Verificar en la DB: `SELECT * FROM crm_mensajes ORDER BY fecha DESC LIMIT 5;`

---

### Paso 7 — Verificar integridad de los datos existentes en crm_leads

```sql
-- Ver los leads existentes con las nuevas columnas
SELECT id, nombre, telefono, plataforma_origen, activo, wa_id, etiqueta
FROM crm_leads
ORDER BY id
LIMIT 20;

-- Verificar que no hay duplicados por el nuevo constraint
SELECT negocio_id, telefono, plataforma_origen, COUNT(*)
FROM crm_leads
WHERE telefono IS NOT NULL
GROUP BY negocio_id, telefono, plataforma_origen
HAVING COUNT(*) > 1;
-- Esperado: 0 filas (sin duplicados)

-- Ver mensajes recibidos
SELECT cm.id, cl.nombre, cm.mensaje, cm.tipo_emisor, cm.fecha
FROM crm_mensajes cm
JOIN crm_leads cl ON cl.id = cm.lead_id
ORDER BY cm.fecha DESC
LIMIT 20;
```

---

## ⚠️ Situaciones de error comunes

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| Módulo no aparece en dashboard | `_modules_seeded` no se reseteó | Reiniciar el servidor Flask una vez |
| Badge dice "● Sin configurar" después de guardar | Error al guardar en DB | Revisar logs del servidor |
| Webhook retorna `403` | Verify token incorrecto | Re-verificar string en ⚙️ Configurar Meta |
| Webhook retorna `403` pero el token es correcto | La config tiene `activo = FALSE` | `UPDATE meta_configuraciones SET activo = TRUE WHERE negocio_id = X` |
| Mensaje llega al webhook pero no aparece en chat | `phone_number_id` no coincide | Verificar que el Phone Number ID en ⚙️ sea el mismo que envía Meta |
| Error al enviar desde ERP | Access token expirado | Regenerar token en Meta Developers y re-guardar en ⚙️ |
