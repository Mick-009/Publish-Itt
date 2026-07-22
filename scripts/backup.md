# Manual backup — MongoDB Atlas

Run weekly during alpha. Requires `mongodump` (part of MongoDB Database Tools).

## Command

```bash
mongodump \
  --uri="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>" \
  --out="backups/$(date +%Y-%m-%d)"
```

Replace the URI with your Atlas connection string (same value as the `MONGO_URL` env var in Render).
`<dbname>` should match the `DB_NAME` env var. The `--out` flag writes each collection as a BSON file under `backups/YYYY-MM-DD/`.

## Restore

```bash
mongorestore \
  --uri="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>" \
  backups/YYYY-MM-DD/
```

## Notes

- Atlas M0 free tier includes continuous backups in the Atlas UI (Backup tab).
  This script is a local belt-and-suspenders copy.
- Keep backup directories out of version control — add `backups/` to `.gitignore`.
- Automated backups are deferred; revisit when moving off the free tier.
