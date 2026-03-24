#!/usr/bin/env bash
# Uploads seed images to local Supabase Storage.
# Run after `pnpm supabase db reset`:
#   pnpm seed:storage
set -e

SUPABASE_URL="http://127.0.0.1:54321"
SERVICE_ROLE_KEY=$(pnpm supabase status --output json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['SERVICE_ROLE_KEY'])")
IMAGES_DIR="supabase/seed-images"
BUCKET="product-images"

echo "Uploading seed images to local Supabase Storage..."

for FILE in "$IMAGES_DIR"/*.jpg; do
  FILENAME=$(basename "$FILE")

  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    "$SUPABASE_URL/storage/v1/object/$BUCKET/seed/$FILENAME" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: image/jpeg" \
    -H "x-upsert: true" \
    --data-binary "@$FILE")

  if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
    echo "  $FILENAME — ok"
  else
    echo "  $FILENAME — error (HTTP $HTTP_STATUS)"
    exit 1
  fi
done

echo "Done."
