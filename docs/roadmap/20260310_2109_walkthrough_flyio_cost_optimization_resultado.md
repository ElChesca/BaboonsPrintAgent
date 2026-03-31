# Walkthrough: Fly.io Cost Optimization

I have successfully completed the cost optimization for the `munidigitalsanluis` application.

## Changes Made

### 1. Configuration Optimization
Modified [fly.toml](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/fly.toml) to align with best practices:
- **Memory Reduced**: Lowered VM memory from 1GB to **512MB** (matching the actual running machine).
- **Auto-Stop Enabled**: Set `auto_stop_machines = true` to ensure machines shut down when there is no traffic.
- **Auto-Start & Min Machines**: Confirmed `auto_start_machines = true` and `min_machines_running = 0`.

### 2. Resource Cleanup
- **Volume Deleted**: Successfully destroyed the unattached volume `vol_r77p9nk32618x73r` (1GB), which was incurring unnecessary monthly costs.

## Verification Results

### Configuration Validation
Launched `fly config validate` to ensure the new settings are correct.
```powershell
Validating C:\Users\usuario\Documents\MuniSL\muniDigitalSanLuis\fly.toml
✓ Configuration is valid
```

### Volume Verification
Checked the current volumes for the app to confirm deletion.
```powershell
ID                      STATE   NAME                    SIZE    REGION  ZONE    ENCRYPTED       ATTACHED VM     CREATED AT   
vol_4qgdj2yl7ol17k6v    created observatorio_data       1GB     gru     4f2c    true            17817922c43518  3 months ago
```
> [!NOTE]
> Only the active volume `vol_4qgdj2yl7ol17k6v` remains.

## Next Steps
- The next time you run `fly deploy`, these memory and auto-stop settings will be fully applied to the production machines.
- Monitor your next Fly.io invoice; you should see a reduction due to the deleted volume and optimized RAM.
