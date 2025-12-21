# Classifarr v0.18.5-alpha

## System Health & Logging Fixes

### Database Query Audits
Following an audit of database queries, we identified and fixed issues in the System Health and System Logs endpoints that were using outdated table names and columns.

- **System Health:** Now correctly checks specific configuration tables (`ollama_config`, `radarr_config`, etc.) instead of the generic settings table. This ensures the dashboard accurately reflects configured services.
- **System Logs:** Updated to query the `classification_history` table using the correct column names (`library_id` instead of `selected_library`, `metadata` instead of `webhook_response`) and performs a JOIN to display library names.

## Upgrade
```bash
docker pull cloudbyday90/classifarr:0.18.5-alpha
docker restart classifarr
```
