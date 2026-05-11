#!/usr/bin/env bash
# Nightly Postgres dump for The Drink Exchange.
# Run via cron at, say, 04:00 ACDT after the daily summary has been sent.
# Required env: DATABASE_URL, S3_BUCKET, optional S3_PREFIX, AWS creds via env.

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL not set" >&2
  exit 1
fi
if [[ -z "${S3_BUCKET:-}" ]]; then
  echo "S3_BUCKET not set" >&2
  exit 1
fi

PREFIX="${S3_PREFIX:-drink-exchange/backups}"
TS=$(date -u +%Y%m%dT%H%M%SZ)
FILE="drink-exchange-${TS}.sql.gz"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

pg_dump --format=plain --no-owner --no-privileges "$DATABASE_URL" | gzip -9 > "$TMP/$FILE"
SIZE=$(stat -c%s "$TMP/$FILE" 2>/dev/null || stat -f%z "$TMP/$FILE")
echo "Dumped $FILE ($SIZE bytes)"

aws s3 cp "$TMP/$FILE" "s3://${S3_BUCKET}/${PREFIX}/${FILE}"
echo "Uploaded to s3://${S3_BUCKET}/${PREFIX}/${FILE}"

# Retention: prune anything older than 30 days
CUTOFF=$(date -u -d '30 days ago' +%Y%m%d 2>/dev/null || date -u -v -30d +%Y%m%d)
aws s3 ls "s3://${S3_BUCKET}/${PREFIX}/" | awk '{print $4}' | while read -r f; do
  if [[ "$f" =~ drink-exchange-([0-9]{8})T ]]; then
    if [[ "${BASH_REMATCH[1]}" < "$CUTOFF" ]]; then
      aws s3 rm "s3://${S3_BUCKET}/${PREFIX}/${f}"
      echo "Pruned $f"
    fi
  fi
done
