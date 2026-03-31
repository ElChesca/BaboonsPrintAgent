# Walkthrough - Fix for Empty Fraudes-Tramites Dashboard

I have completed the implementation to fix the empty "Radar de Fraude por Trámites" dashboard. The issue was primarily caused by a mismatch in column names between the data synchronization script and the dashboard's rendering logic.

## Changes Made

### 1. Unified Column Names in Synchronization
Modified [sincronizador.py](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/local_scripts/sincronizador.py) to use the exact column names expected by the dashboard:
- Renamed `"TOTAL CUOTAS"` to `"CANT_CUOTAS_TOTAL"`.
- Renamed `"CUOTAS PAGADAS"` to `"CANT_CUOTAS_PAGADAS"`.

### 2. Implementation & Diagnostic Logs in Dashboard
Updated [gerencial.py](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/routes/gerencial.py):
- Completed the `fraudes_tramites` route logic to handle the data loading and KPI calculations.
- Added **diagnostic logs** that will appear in the server console (Fly.io logs) to show exactly how many rows are being loaded or if the table is empty.

## Final Steps for the User

To see the data in your dashboard, please follow these steps:

1.  **Deploy the Changes:**
    Run the following command in your terminal to update the production server:
    ```bash
    fly deploy
    ```

2.  **Run the Synchronizer:**
    Once deployed, run your local synchronization script. Ensure you have the necessary environment for it (Oracle client, etc.):
    ```bash
    python local_scripts/sincronizador.py
    ```
    > [!TIP]
    > If you want to force the fraud detection today (even if it's not Friday), you can temporarily set `FORCE_RUN = True` at the top of `sincronizador.py`.

3.  **Check the Dashboard:**
    Visit `https://munidigitalsanluis.fly.dev/gerencial/fraudes-tramites` and verify if the data appears.

If the dashboard is still empty after running the synchronizer, please check the Fly.io logs (`fly logs`) to see the diagnostic messages I added:
- `🔍 DEBUG: Cargando tabla 'auditoria_fraude_tramites'...`
- `✅ DEBUG: Se cargaron X filas.`
