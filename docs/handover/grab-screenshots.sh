#!/bin/bash
# Capture screenshots of every admin page

set -e
cd "$(dirname "$0")/screenshots"
rm -f *.png

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BASE="http://localhost:3002"

PAGES=(
  "login:auth/login.html"
  "dashboard:admin/dashboard"
  "applications:admin/applications"
  "loan-book:admin/loan-book"
  "users:admin/users"
  "cash-ledger:admin/cash-ledger"
  "incoming-payments:admin/incoming-payments"
  "outgoing-payments:admin/outgoing-payments"
  "credit-rules:admin/credit-rules"
  "sacrra:admin/sacrra"
  "sacrra-validator:admin/sacrra-validator"
  "settings:admin/settings"
)

for entry in "${PAGES[@]}"; do
  name="${entry%%:*}"
  path="${entry##*:}"
  "$CHROME" \
    --headless=new --no-sandbox --disable-gpu \
    --window-size=1440,900 \
    --screenshot="$name.png" \
    "$BASE/$path" >/dev/null 2>&1
  /bin/sleep 1
  size=$(stat -f%z "$name.png" 2>/dev/null || echo 0)
  printf "  %-25s %8s bytes\n" "$name.png" "$size"
done

echo ""
echo "Done — $(ls *.png 2>/dev/null | wc -l | tr -d ' ') images captured"
