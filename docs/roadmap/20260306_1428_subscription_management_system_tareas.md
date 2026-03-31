# Subscription Management System

- [ ] Research and Design [/]
    - [/] Research `negocios` and `usuarios` schema
    - [ ] Design `suscripciones_pagos` table
    - [ ] Create implementation plan
- [x] Research and Design [x]
    - [x] Research `negocios` and `usuarios` schema
    - [x] Design `suscripciones_pagos` table
    - [x] Create implementation plan
- [x] Backend Implementation [x]
    - [x] Create database migration for subscription tracking
    - [x] Implementation of API for Super Admin to manage payments
    - [x] Middleware or endpoint to check subscription status
- [x] Frontend Implementation [x]
    - [x] Super Admin Control Panel (Panel de Pagos)
    - [x] Home page notification bar for overdue payments
- [x] Subscription System Improvements [x]
    - [x] Fix broken API call in `main.js` (switched to fetchData)
    - [x] Add "Registrar Pago" modal to `admin_apps.html`
    - [x] Refactor `admin_apps.js` for modal stability and multi-month support
    - [x] Debug and resolve UI freeze in payment history modal
    - [x] Move modals to `index.html` to prevent stacking context issues
    - [x] Fix z-index conflict in `global.css` (Namespaced custom modal styles)
    - [x] Update legacy HTML files for compatibility
    - [x] Refactor `checkSubscriptionStatus` to use `fetchData` (fix 401 errors)
    - [x] Final verification and documentation update
- [x] Verification [x]
    - [x] Verify freeze and 401 are resolved
    - [x] Verify multi-month payment registration
    - [x] Final walkthrough

- [x] Subscription Debt Tracking [x]
    - [x] Plan debt calculation logic
    - [x] Update backend to calculated accumulated debt
    - [x] Update Super Admin UI with "Deuda" column
    - [x] Verify calculation against various scenarios

- [x] Mixed Payment logic in Backend & Admin Mode [x]
    - [x] Plan UI and Backend logic
    - [x] Update `hoja_ruta.html` (Driver Mode) with Mixed Payment UI
    - [x] Implement split logic in `logistica.js` (Driver Mode)
    - [x] Update `distribucion_routes.py` to handle Cta Cte in mixed payments
    - [x] Fix missing Cta Cte registration for single method payments
    - [x] Verify accounting across all methods

- [x] Restrict Seller App to 'Delivery Only' [x]
    - [x] Remove payment methods from `seller.html`
    - [x] Update `seller.js` to handle delivery-only confirmation
    - [x] Modify backend to support 'Delivery without Payment' status
