"""
Generate SACRRA Layout 700v2 fixed-width file from AlgoLend loan book Excel.

Usage:
    python scripts/generate_sacrra_from_loanbook.py \
        --input  "/path/to/Detailed_Loan_Report.xlsx" \
        --srn    TT0109 \
        --name   "ALGOLEND" \
        --output ./output

Options:
    --status   Comma-separated statuses to include (default: Active,Non-Performing)
               Use "ALL" to include every status.
    --input    Path to the Excel loan book
    --srn      Supplier Reference Number issued by SACRRA (default: TT0109)
    --name     Trading name for header (default: ALGOLEND)
    --output   Output directory (default: current dir)
"""

import argparse
import os
import sys
from datetime import date, datetime

try:
    import pandas as pd
except ImportError:
    sys.exit("pandas is required: pip install pandas openpyxl")


# ── Constants ──────────────────────────────────────────────────────────────────

VERSION        = '06'          # Layout 700v2
RECORD_TYPE    = 'D'           # Monthly data record
FREQUENCY_MAP  = {'Monthly': '03', 'Weekly': '01', 'Fortnightly': '02'}

# Status code map from loan book → SACRRA Layout 700v2
# blank = active/current  T = settled  V = cancelled
STATUS_MAP = {
    'Active':         '',
    'Non-Performing': '',    # active with arrears, tracked via months_in_arrears
    'Paid':           'T',
    'Written Off':    'W',
    'Cancelled':      'V',
    'Not Approved':   'V',
    'Application':    '',
}

# Account type map: loan product → SACRRA account type code
# M = short-term (1 month)  P = personal loan (multi-month)
def account_type(product, payments):
    try:
        n = int(payments or 1)
    except (ValueError, TypeError):
        n = 1
    return 'M' if n == 1 else 'P'


# ── Formatting helpers ─────────────────────────────────────────────────────────

def aL(val, length):
    """Alpha field: left-aligned, space-padded, truncated."""
    return str(val or '').replace('\r', '').replace('\n', '')[:length].ljust(length)

def nR(val, length):
    """Numeric field: digits only, right-aligned, zero-padded."""
    digits = ''.join(c for c in str(val or '') if c.isdigit()) or '0'
    return digits[-length:].zfill(length)

def fmt_date(val):
    """Return YYYYMMDD string from various date inputs, or '00000000'."""
    if pd.isna(val) or not val:
        return '00000000'
    if isinstance(val, (date, datetime)):
        return val.strftime('%Y%m%d')
    s = str(val).strip().replace('-', '').replace('/', '')
    # Handle DD/MM/YYYY → YYYYMMDD
    if len(s) == 8 and s[:2].isdigit() and int(s[:2]) <= 31:
        return s[4:8] + s[2:4] + s[0:2]
    return s[:8] if len(s) >= 8 else s.zfill(8)

def clean_id(val):
    """Strip non-digits, pad to 13."""
    digits = ''.join(c for c in str(val or '') if c.isdigit())
    return digits.zfill(13)[:13]

def derive_title(gender):
    return 'MS' if str(gender or '').strip().upper().startswith('F') else 'MR'

def money(val):
    """Return integer rands from numeric value."""
    try:
        return max(0, int(round(float(val or 0))))
    except (ValueError, TypeError):
        return 0


# ── Build one 700-char data record ────────────────────────────────────────────

def build_record(row, srn, branch_code):
    raw_status = STATUS_MAP.get(str(row.get('Status', '')).strip(), '')
    is_closed  = raw_status in ('T', 'V', 'W', 'C', 'P')

    sa_id       = clean_id(row.get('Client ID No.', ''))
    gender      = str(row.get('Client Gender', '') or '').strip()
    dob         = fmt_date(row.get('Client Date of Birth'))
    surname     = str(row.get('Client Surname', '') or '').strip()
    first_name  = str(row.get('Client Name', '') or '').strip()
    employer    = str(row.get('Employer Name', '') or '').strip()
    province    = str(row.get('Loan Province', '') or '').strip()

    acct_no     = str(row.get('Agreement No.', '') or '').strip().replace(' ', '')
    n_payments  = row.get('No. of Payments', 1)
    acct_type   = account_type(row.get('Loan Product', ''), n_payments)
    freq        = FREQUENCY_MAP.get(str(row.get('Frequency', '') or '').strip(), '03')
    terms       = nR(n_payments or 1, 4)

    date_opened   = fmt_date(row.get('Agreement/Application Date'))
    date_last_pmt = fmt_date(row.get('Last Receipt Date'))
    status_date   = fmt_date(row.get('Last Receipt Date') or row.get('Agreement/Application Date'))

    open_bal  = nR(0 if is_closed else money(row.get('Loan amount', 0)), 9)
    curr_bal  = nR(0 if is_closed else money(row.get('Capital Outstanding', 0)), 9)
    overdue   = nR(0 if is_closed else money(row.get('Total Overdue', 0)), 9)
    # Instalment: for closed accounts = 0
    loan_amt  = money(row.get('Loan amount', 0))
    n_pay     = max(1, int(n_payments or 1))
    instl_val = 0 if is_closed else money(row.get('Capital Outstanding', loan_amt) or loan_amt / n_pay)
    instalment = nR(instl_val, 9)

    months_arr  = '01' if str(row.get('Status', '')).strip() == 'Non-Performing' else '00'
    bal_ind     = 'P' if is_closed else 'D'
    status_code = aL(raw_status or '  ', 2)
    loan_reason = aL('O', 2)     # O = Standard personal loan

    r = ''
    r += aL(RECORD_TYPE, 1)             # 1:      D = Monthly data
    r += sa_id                           # 2-14:   SA ID (N13)
    r += aL('', 16)                      # 15-30:  Non-SA ID (blank)
    r += aL('M' if gender.upper().startswith('M') else 'F', 1)  # 31: Gender
    r += nR(dob, 8)                      # 32-39:  DOB CCYYMMDD
    r += aL(branch_code, 8)             # 40-47:  Branch code (8 chars)
    r += acct_no.rjust(25)[:25]         # 48-72:  Account number (right-aligned)
    r += aL('', 4)                       # 73-76:  Sub-account
    r += aL(surname, 25)                 # 77-101: Surname
    r += aL(derive_title(gender), 5)     # 102-106:Title
    r += aL(first_name, 14)              # 107-120:Forename 1
    r += aL('', 14)                      # 121-134:Forename 2
    r += aL('', 14)                      # 135-148:Forename 3
    r += aL('', 25)                      # 149-173:Res address 1
    r += aL('', 25)                      # 174-198:Res address 2
    r += aL(province, 25)               # 199-223:Res address 3 (province as city)
    r += aL('', 25)                      # 224-248:Res address 4
    r += aL('', 6)                       # 249-254:Postal code
    r += aL('T', 1)                      # 255:    T=Tenant (no address in source)
    r += aL('', 25)                      # 256-280:Postal address 1
    r += aL('', 25)                      # 281-305:Postal address 2
    r += aL('', 25)                      # 306-330:Postal address 3
    r += aL('', 25)                      # 331-355:Postal address 4
    r += aL('', 6)                       # 356-361:Postal code (postal)
    r += aL('01', 2)                     # 362-363:Ownership type (01=Individual)
    r += loan_reason                     # 364-365:Loan reason
    r += aL('00', 2)                     # 366-367:Payment type
    r += aL(acct_type, 2)               # 368-369:Account type (M or P)
    r += nR(date_opened, 8)             # 370-377:Date opened
    r += nR('0', 8)                      # 378-385:Deferred payment date
    r += nR(date_last_pmt, 8)           # 386-393:Date last payment
    r += open_bal                        # 394-402:Opening balance
    r += curr_bal                        # 403-411:Current balance
    r += aL(bal_ind, 1)                  # 412:    Balance indicator D/P
    r += overdue                         # 413-421:Amount overdue
    r += instalment                      # 422-430:Instalment
    r += months_arr                      # 431-432:Months in arrears
    r += status_code                     # 433-434:Status code
    r += nR(freq, 2)                     # 435-436:Frequency
    r += terms                           # 437-440:Terms
    r += nR(status_date, 8)             # 441-448:Status date
    r += aL('', 8)                       # 449-456:Old branch code
    r += aL('', 25)                      # 457-481:Old account number
    r += aL('', 4)                       # 482-485:Old sub-account
    r += aL('', 10)                      # 486-495:Old supplier ref
    r += aL('', 16)                      # 496-511:Home telephone
    r += aL('', 16)                      # 512-527:Cellular
    r += aL('', 16)                      # 528-543:Work telephone
    r += aL(employer, 60)               # 544-603:Employer
    r += nR('0', 9)                      # 604-612:Income
    r += aL('M', 1)                      # 613:    Income frequency
    r += aL('', 20)                      # 614-633:Occupation
    r += aL('', 60)                      # 634-693:Third party name
    r += nR('0', 2)                      # 694-695:Account sold to third party
    r += nR('0', 3)                      # 696-698:No of participants
    r += aL('', 2)                       # 699-700:Filler

    assert len(r) == 700, f"Record length {len(r)} != 700 for agreement {acct_no}"
    return r


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Generate SACRRA Layout 700v2 file from loan book Excel')
    parser.add_argument('--input',  required=True, help='Path to Excel loan book')
    parser.add_argument('--srn',    default='TT0109', help='SACRRA Supplier Reference Number')
    parser.add_argument('--name',   default='ALGOLEND', help='Trading name')
    parser.add_argument('--output', default='.', help='Output directory')
    parser.add_argument('--status', default='Active,Non-Performing',
                        help='Comma-separated statuses to include (or ALL)')
    args = parser.parse_args()

    print(f'[SACRRA] Reading: {args.input}')
    df = pd.read_excel(args.input, header=2)
    df.columns = df.iloc[0]
    df = df.iloc[1:].reset_index(drop=True)

    if args.status.upper() != 'ALL':
        statuses = [s.strip() for s in args.status.split(',')]
        df = df[df['Status'].isin(statuses)].reset_index(drop=True)

    print(f'[SACRRA] Records to export: {len(df)}')

    today        = date.today()
    # Month end = last day of current month
    import calendar
    last_day     = calendar.monthrange(today.year, today.month)[1]
    month_end    = today.replace(day=last_day).strftime('%Y%m%d')
    creation_dt  = today.strftime('%Y%m%d')

    # SRN: left-aligned in 10-char field
    srn_field    = args.srn.ljust(10)[:10]
    trading_name = args.name.upper().ljust(60)[:60]

    # Header
    header = ('H' + srn_field + month_end + VERSION + creation_dt + trading_name).ljust(700)[:700]

    # Branch code: SRN left-padded to 8
    branch_code  = args.srn.ljust(8)[:8]

    # Build records
    records = []
    errors  = []
    for idx, row in df.iterrows():
        try:
            records.append(build_record(row.to_dict(), args.srn, branch_code))
        except Exception as e:
            errors.append(f'Row {idx + 4} (Agreement {row.get("Agreement No.", "?")}): {e}')

    if errors:
        print(f'[SACRRA] ⚠ {len(errors)} record errors:')
        for e in errors[:20]:
            print(f'  {e}')

    # Trailer
    total    = len(records) + 2  # header + data + trailer
    trailer  = ('T' + str(total).zfill(9)).ljust(700)[:700]

    # Assemble file
    lines    = [header] + records + [trailer]
    content  = '\r\n'.join(lines) + '\r\n'

    # Filename: {SRN}_ALL_T702_M_{YYYYMMDD}_1_1
    filename = f'{args.srn}_ALL_T702_M_{creation_dt}_1_1'
    out_path = os.path.join(args.output, filename)
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f'[SACRRA] ✅ File written: {out_path}')
    print(f'[SACRRA]    Header date:  {month_end}')
    print(f'[SACRRA]    Records:      {len(records)}')
    print(f'[SACRRA]    Total lines:  {total}')
    print(f'[SACRRA]    Errors:       {len(errors)}')


if __name__ == '__main__':
    main()
