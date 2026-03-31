# User Objective: Fix Delivery Reports and Auto-Assignment

> [!CAUTION]
> **REGLA DE ORO (DATABASE_SAFETY.md):** 
> 1. PROHIBIDO ejecutar mutaciones (INSERT/UPDATE/DELETE/TRUNCATE) directamente.
> 2. El Agente solo propone SQL; el Usuario lo ejecuta.
> 3. El .env local apunta a NEON (PRODUCCIÓN). ¡Cuidado extremo!

## Progress Checklist
- [x] Fix Picking List totals including 'pendiente' orders <!-- id: 22 -->
- [x] Implement Bulk Order Management <!-- id: 25 -->
    - [x] Add HR Filter to Orders UI <!-- id: 26 -->
    - [x] Add checkboxes and selection logic <!-- id: 27 -->
    - [x] Add bulk status change buttons and logic <!-- id: 28 -->
- [x] Final Verification of Reports <!-- id: 24 -->
- [x] Implement Driver Route Map <!-- id: 29 -->
    - [x] Add "View Map" button and full-screen modal <!-- id: 30 -->
    - [x] Implement polyline drawing in Detail and Modal <!-- id: 31 -->
    - [x] Optimize map for mobile view <!-- id: 32 -->
