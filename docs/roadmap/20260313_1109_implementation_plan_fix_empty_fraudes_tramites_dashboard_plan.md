# Implementation Plan - Fix Empty Fraudes-Tramites Dashboard

The "Radar de Fraude por Trámites" dashboard is currently empty. This plan addresses a confirmed column naming mismatch between the synchronization script and the dashboard logic, and adds diagnostic logging to identify why the data might be missing from the database.

## Proposed Changes

### [Component: Data Synchronization]
#### [MODIFY] [sincronizador.py](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/local_scripts/sincronizador.py)
- Update `detectar_fraudes_libre_deuda` to rename columns to match the names expected by the dashboard:
    - `"CUOTAS PAGADAS"` -> `"CANT_CUOTAS_PAGADAS"`
    - `"TOTAL CUOTAS"` -> `"CANT_CUOTAS_TOTAL"`
- This ensures that if frauds are detected, their cuota counts are correctly displayed.

### [Component: Backend Route]
#### [MODIFY] [gerencial.py](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/routes/gerencial.py)
- Add detailed logging in `fraudes_tramites` to verify if `auditoria_fraude_tramites` exists and contains records.
- If the table is missing, log a specific warning to help debug system alignment.

## Verification Plan

### Automated Tests
- Create a diagnostic script `verify_fraudes_data.py` to:
    - Check for the existence of `auditoria_fraude_tramites` in `observatorio_data.db`.
    - Print the count and first few rows if it exists.
    - Run this script locally to confirm current state.

### Manual Verification
- Ask the user to visit the `/gerencial/fraudes-tramites` route and check the server console for the new diagnostic logs.
- If data is still missing, provide instructions for the user to run `sincronizador.py` with `FORCE_RUN = True` and check the output for fraud detection messages.
