# Optimization of Sincronizador - Performance Improved 🚀

The synchronization script has been converted to an **Incremental Strategy** for daily runs. Instead of rebuilding the entire 14-month history every day, it now only queries the necessary recent data and merges it with existing local records.

## Summary of Optimization

### 🕒 Before vs After
*   **Before**: Each daily run performed a full historical query from 2025-01-01 (≈400 days of data).
*   **After**: 
    *   **Daily Transactions**: Queries only the last **10 days**.
    *   **Monthly Concepts**: Queries only the **current year** (2026).
    *   **Full Rebuild**: Preserved for Fridays (Weekly Run) or manual forced runs.

## Key Technical Changes

### 1. New Logic Engines
Three specialized query windows were added:
*   `CTE_INC`: Optimized for 10-day lookback.
*   `CTE_YEAR`: Optimized for current year aggregations.
*   `CTE_PESADA`: Kept for full historical integrity.

### 2. Incremental Merge Function
A new `fusionar_incremental` function ensures data integrity:
*   Loads existing data from local `.csv`.
*   Identifies records to be updated based on dates/months.
*   Removes old versions of those specific days/months from the historical record.
*   Appends the fresh data from Oracle.
*   Saves the unified results back to disk and uploads them to the server.

## Files Modified

#### [sincronizador.py](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/local_scripts/sincronizador.py)
*   Added `fusionar_incremental` utility.
*   Added dynamic logic to switch CTEs based on the run mode (`RUN_DIARIO` vs `RUN_SEMANAL`).
*   Implemented merge logic for `recaudacion_diaria` and `reca_concepto`.

## Verification Results

*   **Query Performance**: Replaced a query of ~400 days with a query of 10 days for the most frequent task. 
*   **Data Integrity**: Verified that the logic preserves 2025 data by reading the local CSV before performing any updates.
*   **Frequency**: Full data washes are still scheduled for Fridays to catch any historical backtracking or corrections in the source database.
