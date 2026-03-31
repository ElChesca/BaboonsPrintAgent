# Fly.io Cost Optimization Plan

This plan aims to reduce Fly.io costs for the `munidigitalsanluis` app by aligning configuration with the provided guide and removing unused resources discovered during the audit.

## User Review Required

> [!IMPORTANT]
> **Ghost Volume Deletion**: I found an unattached volume `vol_r77p9nk32618x73r` (1GB). Deleting it will stop its billing. Please confirm if it's safe to destroy.
> **RAM Adjustment**: The local `fly.toml` specifies 1GB, but the app is already running with 512MB. I will update the file to 512MB to match reality and the guide's recommendation.

## Proposed Changes

### Configuration Optimization

#### [MODIFY] [fly.toml](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/fly.toml)

- Update `memory` from `1gb` to `512mb`.
- Change `auto_stop_machines` from `'stop'` to `true`.

### Resource Cleanup

- Delete unattached volume `vol_r77p9nk32618x73r`.

## Verification Plan

### Automated Tests
- Run `fly machines list --app munidigitalsanluis` to verify machine state.
- Run `fly volumes list --app munidigitalsanluis` to verify volume deletion.
- Use `fly config validate` to ensure `fly.toml` is correct.

### Manual Verification
- Deploy changes using `fly deploy` (if approved and necessary).
- Monitor logs to ensure `auto-stop` is working as expected.
