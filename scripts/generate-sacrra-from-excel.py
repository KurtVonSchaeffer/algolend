#!/usr/bin/env python3
"""
Generate SACRRA Layout 700v2 fixed-width file from Detailed Loan Report Excel.

Usage:
  python3 scripts/generate-sacrra-from-excel.py <excel_file> [YYYY-MM]

Example:
  python3 scripts/generate-sacrra-from-excel.py \
    ~/Downloads/Detailed_Loan_Report_20260603_091707.xlsx 2026-05
"""

import sys
import re
import math
import calendar
from datetime import date, datetime
import pandas as pd

# ── Config ────────────────────────────────────────────────────────────────────
SRN          = 'TT0109'
TRADING_NAME = 'ALGOLEND'
RECORD_TYPE  = 'D'

POSITIVE_CODES        = {'C', 'T', 'V', 'P'}
STATUS_DATE_CAP_CODES = set('BCDGHKMPSTVXZ')
LASTPAY_CAP_CODES     = {'', 'E', 'I', 'L', 'J', 'W', 'Y'}

# Company-name indicators — records whose surname matches are skipped
_COMPANY_RE = re.compile(
    r'\b(PTY\.?\s*LTD\.?|LTD\.?|\bCC\b|INC\.?|CORP\.?|BK\b|NPC\b|SOC\b|RF\b|'
    r'HOLDINGS?|TRADING|INVESTMENTS?|PROPERT(Y|IES)|ENTERPRISES?|CONSULTANTS?|'
    r'SERVICES|SOLUTIONS|TECHNOLOGIES?|INDUSTRIES|CONSTRUCTION|CONTRACTORS?|'
    r'TRANSPORT|LOGISTICS|SUPPLIES|DISTRIBUTORS?|PROCESSORS?|WAREHOUSING|'
    r'MANAGEMENT|DEVELOPMENT|DEVELOPERS?|BUILDERS?|PROJECTS?|FINANC(E|IAL)|'
    r'CAPITAL|GROUP|TRUST|FOUNDATION|CHURCH|MINISTRY|MINISTRIES)\b|\(PTY\)|&\s',
    re.IGNORECASE
)

# ── Helpers ───────────────────────────────────────────────────────────────────
def al(val, length):
    return str(val or '').replace('\r', '').replace('\n', '')[:length].ljust(length)

def nr(val, length):
    digits = re.sub(r'[^0-9]', '', str(val or '')) or '0'
    return digits[-length:].zfill(length)

def fmt_date(val):
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return '00000000'
    if isinstance(val, (date, datetime)):
        return val.strftime('%Y%m%d')
    s = str(val).strip()
    m = re.match(r'^(\d{2})/(\d{2})/(\d{4})$', s)
    if m:
        return f'{m.group(3)}{m.group(2)}{m.group(1)}'
    m = re.match(r'^(\d{4})-(\d{2})-(\d{2})', s)
    if m:
        return f'{m.group(1)}{m.group(2)}{m.group(3)}'
    return '00000000'

def to_int8(s):
    digits = re.sub(r'[^0-9]', '', str(s or ''))[:8]
    return int(digits) if digits else 0

def luhn_sa_id(id_str):
    """Return True if the SA ID passes the SACRRA Luhn-like check."""
    if not re.match(r'^\d{13}$', id_str):
        return False
    odd = sum(int(id_str[i]) for i in range(0, 12, 2))
    even_n = int(''.join(id_str[i] for i in range(1, 12, 2))) * 2
    even = sum(int(d) for d in str(even_n))
    return (10 - (odd + even) % 10) % 10 == int(id_str[12])

def derive_title(gender):
    return 'MRS  ' if str(gender or '').strip().upper()[:1] == 'F' else 'MR   '

def clean_surname(s):
    s = str(s or '').strip()
    # Strip trailing business suffixes
    s = re.sub(r'\s*(PTY\.?\s*LTD\.?|LTD\.?|\bCC\b|INC\.?|CORP\.?|\(PTY\)|BK|NPC|RF)\s*$',
               '', s, flags=re.IGNORECASE)
    s = re.sub(r'\s*&.*$', '', s)  # strip "& Co", "& Partners" etc.
    return s.strip()

def clean_forename(s):
    # SACRRA allows A-Z, a-z, hyphen, single quote, backtick, space
    return re.sub(r"[^A-Za-z\-\' ` ]", '', str(s or '')).strip()

def gender_code(val):
    return 'F' if str(val or '').strip().upper()[:1] == 'F' else 'M'

def map_status(status_label):
    s = str(status_label or '').strip()
    if s == 'Paid':           return 'T'
    if s == 'Cancelled':      return 'V'
    if s == 'Active':         return ''
    if s == 'Non-Performing': return ''
    return None   # Not Approved, Application → skip

def rands(val):
    try:
        v = float(str(val or '0').replace(',', ''))
        return max(0, round(v))
    except Exception:
        return 0

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    excel_path = sys.argv[1] if len(sys.argv) > 1 else None
    if not excel_path:
        print(__doc__)
        sys.exit(1)

    if len(sys.argv) > 2:
        yr, mo = map(int, sys.argv[2].split('-'))
    else:
        today = date.today()
        mo = today.month - 1 or 12
        yr = today.year if today.month > 1 else today.year - 1

    last_day = calendar.monthrange(yr, mo)[1]
    month_end_date = date(yr, mo, last_day)
    month_end      = month_end_date.strftime('%Y%m%d')
    creation_date  = date.today().strftime('%Y%m%d')
    month_end_int  = to_int8(month_end)

    # Cutoff for the 36-month SACRRA rule
    cutoff_yr = yr - 3 if mo > 0 else yr - 4
    cutoff_mo = mo
    cutoff_int = to_int8(f'{cutoff_yr}{str(cutoff_mo).zfill(2)}{str(last_day).zfill(2)}')

    print(f'Reading: {excel_path}')
    df = pd.read_excel(excel_path, header=3, dtype=str)

    df['_sacrra_status'] = df['Status'].apply(map_status)
    df = df[df['_sacrra_status'].notna()].copy()
    print(f'Records after status filter: {len(df)}')

    srn_padded   = SRN.ljust(10)[:10]
    trading_name = al(TRADING_NAME, 60)

    header = ('H' + srn_padded + month_end + '06' + creation_date + trading_name).ljust(700)[:700]
    lines  = [header]

    skip_stats = {'invalid_id': 0, 'company_name': 0, 'stale_36mo': 0}

    for _, row in df.iterrows():
        sa_id = re.sub(r'[^0-9]', '', str(row.get('Client ID No.', '') or ''))

        # Skip non-13-digit or Luhn-invalid IDs
        if not luhn_sa_id(sa_id):
            skip_stats['invalid_id'] += 1
            continue

        raw_surname = str(row.get('Client Surname', '') or '').strip()

        # Skip company names — SACRRA rejects juristic entities in surname field
        if _COMPANY_RE.search(raw_surname):
            skip_stats['company_name'] += 1
            continue

        raw_status  = str(row.get('_sacrra_status', '') or '').strip()
        is_positive = raw_status in POSITIVE_CODES

        # ── Dates ──────────────────────────────────────────────────────────
        date_opened_str = fmt_date(row.get('Agreement/Application Date'))
        date_opened_int = to_int8(date_opened_str)

        last_pay_str = fmt_date(row.get('Last Receipt Date'))
        if raw_status in LASTPAY_CAP_CODES and to_int8(last_pay_str) > month_end_int:
            last_pay_str = month_end
        if to_int8(last_pay_str) > 0 and date_opened_int > 0 and to_int8(last_pay_str) < date_opened_int:
            last_pay_str = '00000000'

        # Status date: only for closed/settled/cancelled
        if raw_status in STATUS_DATE_CAP_CODES:
            status_date_str = fmt_date(row.get('Last Receipt Date') if raw_status == 'T'
                                       else row.get('Record Date'))
            if to_int8(status_date_str) > month_end_int:
                status_date_str = month_end
        else:
            status_date_str = '00000000'

        # ── 36-month stale-account rule ────────────────────────────────────
        # Account older than 36 months AND no payment/status date within 36 months → reject
        if date_opened_int > 0 and date_opened_int < cutoff_int:
            # We need at least one recent date: last_pay or status_date within 36 months
            best_date = max(to_int8(last_pay_str), to_int8(status_date_str))
            if best_date == 0 or best_date < cutoff_int:
                skip_stats['stale_36mo'] += 1
                continue

        # ── Financials ─────────────────────────────────────────────────────
        loan_amt        = rands(row.get('Loan amount'))
        cap_outstanding = rands(row.get('Capital Outstanding'))
        total_overdue   = rands(row.get('Total Overdue'))

        try:
            n_payments = max(1, int(float(str(row.get('No. of Payments') or '1'))))
        except Exception:
            n_payments = 1

        try:
            total_cost  = float(str(row.get('Total') or '0').replace(',', ''))
            instalment  = max(0, round(total_cost / n_payments))
        except Exception:
            instalment = 0

        # Active accounts MUST have current balance > 0 and instalment > 0
        if not is_positive:
            cap_outstanding = max(1, cap_outstanding)
            instalment      = max(1, instalment)

        # ── Months in arrears ──────────────────────────────────────────────
        open_yr  = date_opened_int // 10000 if date_opened_int else 0
        open_mo  = (date_opened_int % 10000) // 100 if date_opened_int else 0
        end_yr   = month_end_int // 10000
        end_mo   = (month_end_int % 10000) // 100
        age_mo   = max(0, (end_yr - open_yr) * 12 + (end_mo - open_mo)) if open_yr else 999

        try:
            instalment_f = total_cost / n_payments if total_cost and n_payments else 0
            raw_mths_arr = math.ceil(total_overdue / instalment_f) if instalment_f > 0 else 0
        except Exception:
            raw_mths_arr = 0

        mths_arr_int = 0 if is_positive else min(raw_mths_arr, age_mo)

        # SACRRA rule: Amount Overdue > 0 iff Months in Arrears > 0 (must be in sync)
        if mths_arr_int == 0:
            total_overdue = 0
        elif total_overdue == 0:
            mths_arr_int = 0

        mths_arr = str(mths_arr_int).zfill(2)

        # ── Name fields ────────────────────────────────────────────────────
        surname  = clean_surname(raw_surname)
        forename = clean_forename(row.get('Client Name', ''))
        gender   = gender_code(row.get('Client Gender', ''))
        employer = str(row.get('Employer Name') or '').strip()

        # DOB — '00000000' if unknown (SACRRA prefers blank to '19000101')
        dob_str = fmt_date(row.get('Client Date of Birth'))
        if dob_str[:4] in ('1900', '0000'):
            dob_str = '00000000'
        dob = nr(dob_str, 8)

        # ── SACRRA field values ────────────────────────────────────────────
        acct_no       = str(row.get('Agreement No.') or '').strip().rjust(25)[:25]
        open_bal      = nr(0 if is_positive else loan_amt, 9)
        curr_bal      = nr(0 if is_positive else cap_outstanding, 9)
        amt_overdue   = nr(0 if is_positive else total_overdue, 9)
        instalment_nr = nr(0 if is_positive else instalment, 9)
        bal_indicator = 'C' if is_positive else 'D'
        status_code   = al(raw_status or '  ', 2)
        account_type  = 'P '

        r = ''
        r += al(RECORD_TYPE, 1)         # 1
        r += sa_id                       # 2-14
        r += al('', 16)                  # 15-30
        r += al(gender, 1)              # 31
        r += dob                         # 32-39
        r += al('', 8)                   # 40-47 branch code (blank — NOT the SRN)
        r += acct_no                     # 48-72
        r += al('', 4)                   # 73-76
        r += al(surname, 25)            # 77-101
        r += al(derive_title(gender), 5)# 102-106
        r += al(forename, 14)           # 107-120
        r += al('', 14)                  # 121-134
        r += al('', 14)                  # 135-148
        r += al('', 25)                  # 149-173
        r += al('', 25)                  # 174-198
        r += al('', 25)                  # 199-223
        r += al('', 25)                  # 224-248
        r += al('', 6)                   # 249-254
        r += al('T', 1)                  # 255
        r += al('', 25)                  # 256-280
        r += al('', 25)                  # 281-305
        r += al('', 25)                  # 306-330
        r += al('', 25)                  # 331-355
        r += al('', 6)                   # 356-361
        r += al('00', 2)                 # 362-363
        r += al('O ', 2)                 # 364-365
        r += al('00', 2)                 # 366-367
        r += al(account_type, 2)        # 368-369
        r += nr(date_opened_str, 8)     # 370-377
        r += nr('0', 8)                  # 378-385
        r += nr(last_pay_str, 8)        # 386-393
        r += open_bal                    # 394-402
        r += curr_bal                    # 403-411
        r += al(bal_indicator, 1)       # 412
        r += amt_overdue                 # 413-421
        r += instalment_nr               # 422-430
        r += mths_arr                    # 431-432
        r += status_code                 # 433-434
        r += nr('03', 2)                 # 435-436
        r += nr(str(n_payments), 4)     # 437-440
        r += nr(status_date_str, 8)     # 441-448
        r += al('', 8)                   # 449-456
        r += al('', 25)                  # 457-481
        r += al('', 4)                   # 482-485
        r += al('', 10)                  # 486-495
        r += al('', 16)                  # 496-511
        r += al('', 16)                  # 512-527
        r += al('', 16)                  # 528-543
        r += al(employer, 60)           # 544-603
        r += nr('0', 9)                  # 604-612
        r += al('M', 1)                  # 613
        r += al('', 20)                  # 614-633
        r += al('', 60)                  # 634-693
        r += nr('0', 2)                  # 694-695
        r += nr('0', 3)                  # 696-698
        r += al('', 2)                   # 699-700

        assert len(r) == 700, f'Record length {len(r)} != 700 for {row.get("Agreement No.")}'
        lines.append(r)

    total_records = len(lines) + 1
    trailer = ('T' + str(total_records).zfill(9)).ljust(700)[:700]
    lines.append(trailer)

    out_path = f'{SRN}_ALL_T702_M_{month_end}_1_1.txt'
    with open(out_path, 'wb') as f:
        for line in lines:
            f.write(line.encode('ascii', errors='replace') + b'\r\n')

    total_skipped = sum(skip_stats.values())
    print(f'Done. {len(lines)-2} data records written.')
    print(f'Skipped {total_skipped}: invalid/non-SA ID={skip_stats["invalid_id"]}, '
          f'company name={skip_stats["company_name"]}, '
          f'stale >36mo={skip_stats["stale_36mo"]}')
    print(f'Output: {out_path}')

if __name__ == '__main__':
    main()
