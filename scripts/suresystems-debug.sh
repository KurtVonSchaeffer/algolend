#!/bin/bash
# SureSystems DebiCheck — Full Debug with visible headers
# Run: bash scripts/suresystems-debug.sh

set -a
source .env
set +a

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║       SURESYSTEMS DebiCheck — Full Request Debug             ║"
echo "║       $(date '+%Y-%m-%d %H:%M:%S')                                   ║"
echo "╚══════════════════════════════════════════════════════════════╝"

# ── STEP 1: Config ───────────────────────────────────────────────
echo ""
echo "── STEP 1: CONFIGURATION ────────────────────────────────────────"
echo "  BASE_URL         : $SURESYSTEMS_BASE_URL"
echo "  MERCHANT_GID     : $SURESYSTEMS_MERCHANT_GID"
echo "  REMOTE_GID       : $SURESYSTEMS_REMOTE_GID"
echo "  BASIC_USERNAME   : $SURESYSTEMS_BASIC_AUTH_USERNAME"
echo "  BASIC_PASSWORD   : $SURESYSTEMS_BASIC_AUTH_PASSWORD"
echo "  CLIENT_ID        : $SURESYSTEMS_CLIENT_ID"
echo "  CLIENT_SECRET    : $SURESYSTEMS_CLIENT_SECRET"
echo "  SYSTEM_USERNAME  : $SURESYSTEMS_SYSTEM_USERNAME"

# ── STEP 2: Basic Auth ───────────────────────────────────────────
echo ""
echo "── STEP 2: BASIC AUTH ────────────────────────────────────────────"
RAW_CREDS="$SURESYSTEMS_BASIC_AUTH_USERNAME:$SURESYSTEMS_BASIC_AUTH_PASSWORD"
BASIC_B64=$(echo -n "$RAW_CREDS" | base64)
echo "  Raw        : $RAW_CREDS"
echo "  Base64     : $BASIC_B64"
echo "  Header     : Basic $BASIC_B64"

# ── STEP 3: Digital Signature ────────────────────────────────────
echo ""
echo "── STEP 3: DIGITAL SIGNATURE ─────────────────────────────────────"
DTS=$(date '+%Y-%m-%d %H:%M:%S')
SIG_INPUT="${SURESYSTEMS_CLIENT_ID}${DTS}"
HMAC=$(echo -n "$SIG_INPUT" | openssl dgst -sha512 -hmac "$SURESYSTEMS_CLIENT_SECRET" -binary | base64)

echo "  dsClientId     : $SURESYSTEMS_CLIENT_ID"
echo "  dsDTS          : $DTS"
echo "  dsClientSecret : $SURESYSTEMS_CLIENT_SECRET"
echo ""
echo "  Formula:"
echo "    input     = dsClientId + dsDTS"
echo "    input     = \"$SIG_INPUT\""
echo "    algorithm = HMAC-SHA512"
echo "    key       = $SURESYSTEMS_CLIENT_SECRET"
echo "    output    = base64"
echo ""
echo "  dsHMAC: $HMAC"

# ── STEP 4 & 5: Full curl request ────────────────────────────────
echo ""
echo "── STEP 4+5+6: FULL REQUEST (verbose — shows exact headers sent) ──"
echo ""

TODAY=$(date '+%Y%m%d')
TIME_NOW=$(date '+%H%M%S')

PAYLOAD=$(cat <<JSON
{
  "messageInfo": {
    "merchantGid": $SURESYSTEMS_MERCHANT_GID,
    "remoteGid": $SURESYSTEMS_REMOTE_GID,
    "messageDate": "$TODAY",
    "messageTime": "$TIME_NOW",
    "systemUserName": "$SURESYSTEMS_SYSTEM_USERNAME",
    "frontEndUserName": "$SURESYSTEMS_SYSTEM_USERNAME"
  },
  "mandate": {
    "clientNo": "Tyme",
    "userReference": "TEST",
    "frequencyCode": 4,
    "installmentAmount": 100,
    "noOfInstallments": 4,
    "origin": 15,
    "binNumber": "",
    "panTrailer": "",
    "contractReference": "46BD3900211115",
    "magId": 45,
    "debitValueType": 1,
    "typeOfAuthorizationRequired": 3,
    "initialAmount": 0,
    "firstCollectionDate": "20260630",
    "maximumCollectionAmount": 150,
    "adjustmentCategory": 1,
    "adjustmentAmount": 0,
    "adjustmentRate": 0,
    "collectionDay": 30,
    "dateAdjustmentRuleIndicator": 1,
    "trackingIndicator": 1,
    "numberOfTrackingDays": 3,
    "debitSequenceType": "RCUR",
    "debtorAccountName": "Tyme ABC",
    "debtorIdentificationType": 1,
    "debtorIdentificationNo": "8512257442083",
    "debtorAccountNumber": "51000716346",
    "debtorAccountType": 1,
    "debtorBranchNumber": "678910",
    "entryClass": "0033",
    "debtorTelephone": "0704227326",
    "debtorEmail": "",
    "mandateInitiationDate": "$TODAY",
    "authorizationIndicator": "0229",
    "dateList": ""
  }
}
JSON
)

URL="$SURESYSTEMS_BASE_URL/api/sssdswitchuadsrest/v3/mandates/load"

# -v shows > for sent headers, < for received headers
curl -v \
  -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $BASIC_B64" \
  -H "dsClientId: $SURESYSTEMS_CLIENT_ID" \
  -H "dsDTS: $DTS" \
  -H "dsHMAC: $HMAC" \
  -d "$PAYLOAD" \
  2>&1

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Lines starting with '>' = headers WE SENT                  ║"
echo "║  Lines starting with '<' = headers WE RECEIVED BACK         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
