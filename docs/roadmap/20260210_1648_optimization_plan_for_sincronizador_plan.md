# Optimization Plan for Sincronizador

The daily synchronization is currently slow because it performs a full historical rebuild (from Jan 1st, 2025, to today) every day. As we are now in Feb 2026, this range covers over 13 months of transactional data, leading to slow Oracle queries.

## Proposed Changes

### [local_scripts](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/local_scripts)

#### [MODIFY] [sincronizador.py](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/local_scripts/sincronizador.py)
1.  **Introduce Incremental Update Logic**: 
    *   Create a helper function to merge new data with existing local CSV data.
    *   Modify `ejecutar_sql` or the main flow to only query the last 7-10 days for `RUN_DIARIO` (to capture late renditions/adjustments) and merge it with the historical data loaded from the local CSV.
2.  **Toggle between LIGERA and PESADA**: 
    *   For `RUN_DIARIO` (non-weekly), use a new `CTE_DIARIA_REDUCIDA` that only looks at a small window.
    *   Keep the full `CTE_PESADA` for `RUN_SEMANAL` to ensure data integrity and catch any older modifications.
3.  **Update Hardcoded Dates**:
    *   Ensure the script handles the transition between years (2025/2026) more dynamically if needed, though currently it seems to be hardcoded to start at 2025.

## Verification Plan

### Automated Tests
*   Since there are no existing unit tests, I will:
    1.  Test connectivity and query execution for a small range.
    *   Run the script with a `LIMIT 10` or a very short range to verify the merging logic works without breaking the CSV structure.

### Manual Verification
1.  Run the script in "Daily" mode and measure the time.
2.  Check the resulting `recaudacion_diaria.csv` and `reca_concepto.csv` to ensure they still contain historical data.
3.  Verify that new data from the last few days is correctly included.
