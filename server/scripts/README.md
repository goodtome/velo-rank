# server/scripts/ — Active Tooling

This directory contains **reusable scripts and tools** for the velo-rank project.
One-time scripts have been archived to `archive/`.

## Database Setup & Migration

| Script | Description | Usage |
|--------|-------------|-------|
| `init-db.js` | Creates all database tables | `npm run init-db` |
| `setup-db.js` | Creates database and verifies connection | `node setup-db.js` |
| `create-db.js` | Creates the `jersey_db` database | `node create-db.js` |
| `run-migration.js` | Runs SQL migration files against dev or prod DB | `node run-migration.js` |
| `migrate-auth-tables.js` | Creates/initializes auth-related tables | `node migrate-auth-tables.js` |
| `migrate_team_classification.js` | Creates team_classification table | `node migrate_team_classification.js` |

## Data Import & Sync

| Script | Description | Usage |
|--------|-------------|-------|
| `sync-pcs.js` | Core PCS sync engine (used by app via routes/sync.js) | `npm run sync-pcs` |
| `sync-tdf2026.js` | TdF-specific auto-sync with Puppeteer | `node sync-tdf2026.js` |
| `sync-to-tidb.js` | Syncs local MySQL to TiDB Cloud (prod) | `node sync-to-tidb.js` |
| `import-stage.js` | Generic stage import from JSON data file | `node import-stage.js <file>` |
| `generate-import-script.js` | Generates MySQL import SQL from JSON data | `node generate-import-script.js <file>` |
| `import_all_classifications.py` | Imports KOM/Points/Youth from fetch_pcs_stage.py output | `python import_all_classifications.py` |
| `import_stage_data.py` | Full import: results, GC, points, mountains, youth, jerseys | `python import_stage_data.py` |
| `insert-proseries.js` | Inserts 2026 Men's ProSeries race records | `node insert-proseries.js` |
| `insert-women-proseries.js` | Inserts 2026 Women's ProSeries race records | `node insert-women-proseries.js` |
| `insert-women-wt.js` | Inserts 2026 Women's WorldTour race records | `node insert-women-wt.js` |
| `insert-worlds-continental.js` | Inserts Worlds/Continental championship records | `node insert-worlds-continental.js` |

## Scraping Tools

| Script | Description |
|--------|-------------|
| `scrape-pcs.js` | PCS scraper using axios+cheerio with anti-Cloudflare headers |
| `scrape-pcs-v2.js` | Enhanced PCS scraper with Playwright browser fallback |
| `scrape-pcs-browser.js` | PCS scraper using Puppeteer+Stealth for Cloudflare bypass |
| `fetch-pcs.py` | Python: downloads PCS stage HTML |
| `fetch_pcs_stage.py` | Python: fetches and parses PCS stage page |

## Data Maintenance

| Script | Description |
|--------|-------------|
| `cleanup-database.js` | Normalizes team/rider name inconsistencies |
| `fix-timegap.js` | Fixes PCS parsing anomalies in time_gap/total_time fields |
| `fix-points.js` | Fixes points_classification data (Prev column issues) |
| `merge_teams.js` | Merges duplicate team records |
| `update-chinese-names.js` | Batch-updates team Chinese names |
| `update_team_details.js` | Updates team category, country, logo URLs |
| `update_team_zh.js` | Updates team Chinese names via keyword matching |
| `update_uci_codes.js` | Assigns UCI 3-letter codes to teams |
| `update_uci_codes_v2.js` | Updated version with expanded team list |

## Diagnostics

| Script | Description |
|--------|-------------|
| `check-schema.js` | Dumps column info for classification tables |
| `check-pts-schema.js` | Dumps column info and indexes for points_classification |
| `seed-test-data.js` | Inserts test data for development (`npm run seed`) |

## Backup

| Script | Description | Usage |
|--------|-------------|-------|
| `backup-db.js` | Exports all tables to SQL, gzip-compresses, auto-cleans | `npm run backup` |
| `schedule-backup.js` | 24h backup scheduler (loaded by app.js at startup) | `npm run monitor` |

## Documentation

- `MANUAL_DATA_COLLECTION.md` — Guide for manual PCS data collection
- `data-templates/` — Templates for collecting stage results data

## Archive

The `archive/` subdirectory contains ~160 one-time scripts organized by category.
