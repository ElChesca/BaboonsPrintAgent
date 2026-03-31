# Configuracion de Notificaciones por Email en Tickets
### [Database]

#### [NEW] [migration_tickets.sql](file:///c:/Users/usuario/Documents/MultinegocioBaboons/migration_tickets.sql)
- Add columns to the `tickets` table:
    - `email_contacto`: TEXT (to store the user's specific contact email).
    - `recibir_notificaciones`: BOOLEAN (default TRUE, to opt-in for status change emails).

---

### [Tickets Module]

#### [MODIFY] [tickets.html](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/tickets.html)
- Add two new fields to the "Nuevo Ticket" form:
    - An email input for `ticket-email-contacto`.
    - A checkbox/toggle for `ticket-recibir-notificaciones`.
- Arrange them within the `ticket-form-grid`.

#### [MODIFY] [tickets.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/tickets.js)
- Update `guardarTicket` to include the new fields in the payload.
- Update `abrirTicket` to populate these fields when editing.

#### [MODIFY] [tickets_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/tickets_routes.py)
- Update `create_ticket` and `update_ticket` to handle `email_contacto` and `recibir_notificaciones`.
- Update the email notification logic in `update_ticket` to only send if `recibir_notificaciones` is TRUE, and use `email_contacto` if provided.

## Verification Plan

### Manual Verification
- **Tickets Modal**: 
    1. Open the "Nuevo Ticket" modal.
    2. Fill in the title, description, and the new **Email de contacto**.
    3. Ensure the **Recibir notificaciones por email** box is checked/active.
    4. Save the ticket and verify it is created correctly.
    5. Edit the ticket as an admin and change the status.
    6. Verify (via logs or mock mail) that an email is sent to the contact email.
    7. Repeat with the notification box unchecked and verify no email is sent.
