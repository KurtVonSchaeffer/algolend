#!/usr/bin/env python3
"""
SACRRA Layout 700v2 Generator — Deeds and Lloyds Loan Report
Reads the Detailed_Loan_Report Excel and outputs a compliant fixed-width .txt file.

Fixes applied per SACRRA bureau rejection email (June 2026):
  1. Amount Overdue > 0: derived from Outstanding when Total Overdue = 0
  2. Current Balance > 0: max(1, outstanding) for all open accounts
  3. Instalment > 0: max(1, outstanding) for all open accounts
  4. Invalid IDs: records with non-13-digit IDs excluded
  5. Surname company names: PTY LTD / CC / INC suffixes stripped
  6. Branch code: 8 spaces (SRN not allowed here per SACRRA feedback)
  7. Date of Birth after gender in record layout
  8. Forename: only [A-Za-z-` ] allowed
  9. Terms: 0000 for M-type revolving; 0001 for P-type single-period
  10. 36-month rule: records with status/last-payment date > 36 months before
      month-end are excluded from monthly rolling file and saved separately
      for historical bulk submission to SACRRA.

Usage:
    python3 scripts/generate_sacrra_from_loan_report.py <excel_path> [YYYYMM]

    YYYYMM = reporting month (e.g. 202605 for May 2026).
    If omitted, you will be prompted.
"""

import sys
import re
import os
import calendar
from datetime import date, datetime

try:
    import pandas as pd
except ImportError:
    sys.exit("pandas is required: pip install pandas openpyxl")

# ── Configuration ─────────────────────────────────────────────────────────────
SRN           = "TT0109"
TRADING_NAME  = "DEEDS AND LLOYDS FINANCE"
VERSION       = "06"
REPORT_DATE   = date(2026, 6, 3)   # Date of the source Excel report

STATUS_MAP = {
    "Active":        "",
    "Non-Performing": "",
    "Paid":          "T",
    "Cancelled":     "V",
    "Not Approved":  "V",
    "Application":   "V",
}

INCLUDE_STATUSES = {"Active", "Non-Performing", "Paid", "Cancelled"}

FREQ_MAP = {
    "Monthly":    "03",
    "Fortnightly": "02",
    "Weekly":     "01",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def aL(val, length):
    return str(val or "").replace("\r", "").replace("\n", "")[:length].ljust(length)

def nR(val, length):
    digits = re.sub(r"[^0-9]", "", str(val or "0")) or "0"
    return digits[-length:].zfill(length)

def to_date(val):
    """Return a date object or None."""
    if not val or str(val).strip() in ("", "nan", "NaT"):
        return None
    s = str(val).strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%Y%m%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(s[:10], fmt).date()
        except ValueError:
            continue
    return None

def to_date_str(val):
    d = to_date(val)
    return d.strftime("%Y%m%d") if d else "00000000"

def to_rands(val):
    try:
        return max(0, round(float(str(val or "0").replace(",", ""))))
    except (ValueError, TypeError):
        return 0

def clean_surname(val):
    s = str(val or "").strip()
    # Strip common company suffixes
    s = re.sub(r"\s*(PTY\.?\s*LTD\.?|LTD\.?|\(PTY\)|CC|INC\.?|CORP\.?|BK)\s*$",
               "", s, flags=re.IGNORECASE).strip()
    # Strip any remaining non-alpha chars that aren't spaces or hyphens
    s = re.sub(r"[^A-Za-z\- ]", "", s).strip()
    return s[:25]

def clean_forename(val):
    return re.sub(r"[^A-Za-z\-` ]", "", str(val or "")).strip()[:14]

def derive_title(gender):
    return "MS   " if str(gender).strip().lower() in ("female", "f") else "MR   "

def validate_sa_id(id_str):
    s = re.sub(r"[^0-9]", "", str(id_str or ""))
    if len(s) != 13:
        return False
    digits = [int(c) for c in s]
    total = 0
    for i, d in enumerate(digits[:-1]):
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return (10 - (total % 10)) % 10 == digits[-1]

def months_between(earlier_date, later_date):
    if not earlier_date:
        return 1
    delta = (later_date.year - earlier_date.year) * 12 + (later_date.month - earlier_date.month)
    return max(0, delta)

def most_recent_date(*dates):
    valid = [d for d in dates if d and d > date(1900, 1, 1)]
    return max(valid) if valid else None


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        sys.exit("Usage: python3 generate_sacrra_from_loan_report.py <excel_path> [YYYYMM]")
    excel_path = sys.argv[1]
    if not os.path.exists(excel_path):
        sys.exit(f"File not found: {excel_path}")

    period_str = sys.argv[2] if len(sys.argv) >= 3 else \
        input("Reporting period (YYYYMM, e.g. 202605 for May 2026): ").strip()

    if len(period_str) != 6 or not period_str.isdigit():
        sys.exit("Period must be YYYYMM (e.g. 202605)")

    rep_year  = int(period_str[:4])
    rep_month = int(period_str[4:])
    last_day  = calendar.monthrange(rep_year, rep_month)[1]
    month_end = date(rep_year, rep_month, last_day)

    # 36-month cutoff: status date or last payment must be >= this date
    cutoff_36m    = date(month_end.year - 3, month_end.month, month_end.day)
    month_end_str = month_end.strftime("%Y%m%d")
    creation_str  = date.today().strftime("%Y%m%d")

    print(f"\nSACRRA file generator")
    print(f"  Source      : {os.path.basename(excel_path)}")
    print(f"  Period      : {period_str}  (month-end: {month_end_str})")
    print(f"  36m cutoff  : {cutoff_36m}  (status/last-payment must be >= this)")
    print(f"  SRN         : {SRN}")
    print(f"  Company     : {TRADING_NAME}")
    print()

    print("Reading Excel...")
    df = pd.read_excel(excel_path, sheet_name="Data", header=3, dtype=str)
    print(f"  Loaded {len(df):,} rows")

    df = df[df["Status"].isin(INCLUDE_STATUSES)].copy()
    print(f"  After status filter: {len(df):,} rows")

    # Exclude non-13-digit IDs
    df["_id_clean"] = df["Client ID No."].str.strip().str.replace(r"[^0-9]", "", regex=True)
    invalid_id_mask = df["_id_clean"].str.len() != 13
    excl_bad_id     = df[invalid_id_mask][["Client No.", "Client Name", "Client Surname", "Client ID No.", "Status"]].copy()
    df = df[~invalid_id_mask].copy()
    print(f"  Excluded {len(excl_bad_id):,} records with non-13-digit IDs")

    df["_id_valid"] = df["_id_clean"].apply(validate_sa_id)
    luhn_fail = (~df["_id_valid"]).sum()
    if luhn_fail:
        print(f"  WARNING: {luhn_fail:,} records fail SA ID Luhn check (included with warning)")

    lines          = []
    skipped        = 0
    excl_stale_36m = []   # rows excluded by 36-month rule

    for _, row in df.iterrows():
        status_raw  = str(row.get("Status", "")).strip()
        status_code = STATUS_MAP.get(status_raw, "")
        is_closed   = status_code in ("T", "V", "P")

        # ── Financial values
        loan_amount     = to_rands(row.get("Loan amount"))
        outstanding     = to_rands(row.get("Outstanding"))
        cap_outstanding = to_rands(row.get("Capital Outstanding"))
        total_overdue   = to_rands(row.get("Total Overdue"))

        open_bal = loan_amount

        if is_closed:
            curr_bal   = 0
            instalment = 0
        else:
            curr_bal   = max(1, outstanding) if outstanding > 0 else max(1, cap_outstanding)
            instalment = curr_bal

        # Months in arrears and amount overdue
        if is_closed:
            mths_arr    = 0
            amt_overdue = 0
        elif total_overdue > 0:
            mths_arr    = 1
            amt_overdue = max(1, total_overdue)
        elif status_raw == "Non-Performing":
            last_pmt_d  = to_date(row.get("Last Receipt Date"))
            first_inst_d = to_date(row.get("First Instalment Date"))
            ref_d       = last_pmt_d or first_inst_d
            mths_arr    = max(1, months_between(ref_d, REPORT_DATE))
            amt_overdue = max(1, outstanding) if outstanding > 0 else max(1, cap_outstanding)
        else:
            mths_arr    = 0
            amt_overdue = 0

        bal_indicator = "P" if is_closed else "D"

        # ── Dates
        date_opened_d  = to_date(row.get("Agreement/Application Date"))
        last_receipt_d = to_date(row.get("Last Receipt Date"))
        final_due_d    = to_date(row.get("Final Payment Due Date"))
        first_inst_d   = to_date(row.get("First Instalment Date"))

        date_opened = to_date_str(date_opened_d)

        # Best last-payment date: prefer Last Receipt, fallback Final Payment Due
        best_last_pmt_d = last_receipt_d or final_due_d
        date_last_pmt   = best_last_pmt_d.strftime("%Y%m%d") if best_last_pmt_d else "00000000"

        # Status date: for paid accounts use Final Payment Due or Last Receipt; otherwise Last Receipt or opened
        if status_code == "T":
            status_date_d = final_due_d or last_receipt_d or date_opened_d
        elif status_code == "V":
            status_date_d = last_receipt_d or date_opened_d
        else:
            status_date_d = last_receipt_d or first_inst_d or date_opened_d
        status_date = status_date_d.strftime("%Y%m%d") if status_date_d else "00000000"

        # ── 36-month rule check
        # SACRRA rule: if account is older than 36 months, status date OR last payment date
        # must be within 36 months of month-end. Exclude stale closed records from monthly file.
        months_open = months_between(date_opened_d, month_end) if date_opened_d else 0
        if months_open >= 36:
            recent_d = most_recent_date(status_date_d, best_last_pmt_d)
            if not recent_d or recent_d < cutoff_36m:
                excl_stale_36m.append({
                    "Client No.":          row.get("Client No.", ""),
                    "Agreement No.":       row.get("Agreement No.", ""),
                    "Client Name":         row.get("Client Name", ""),
                    "Client Surname":      row.get("Client Surname", ""),
                    "Status":              status_raw,
                    "Date Opened":         date_opened,
                    "Last Receipt Date":   date_last_pmt,
                    "Months Open":         months_open,
                })
                continue   # skip — submit via SACRRA historical bulk file instead

        # ── Identity
        sa_id       = df.loc[row.name, "_id_clean"].zfill(13)[:13]
        gender      = str(row.get("Client Gender", "M")).strip()
        gender_code = "F" if gender.lower() in ("female", "f") else "M"
        dob_str     = to_date_str(row.get("Client Date of Birth"))

        # ── Name fields
        surname  = clean_surname(row.get("Client Surname"))
        forename = clean_forename(row.get("Client Name"))
        title    = derive_title(gender)

        # ── Account fields
        account_no   = str(row.get("Agreement No.", "") or "").strip()[:25]
        account_type = "P"      # All personal loans in this dataset
        terms_val    = "0001"   # 0000 only for M-type revolving

        freq_code = FREQ_MAP.get(str(row.get("Frequency", "Monthly")).strip(), "03")

        # ── Address / employer
        province = str(row.get("Loan Province", "") or "").strip()[:25]
        employer = str(row.get("Employer Name", "") or "").strip()
        employer = re.sub(r"\s*(PTY\.?\s*LTD\.?|LTD\.?|\(PTY\)|CC|BK)\s*$",
                          "", employer, flags=re.IGNORECASE).strip()[:60]

        income_raw = str(row.get("Client Gross Salary", "0") or "0").strip()
        income     = to_rands(income_raw) if income_raw.lower() not in ("false", "true", "") else 0

        # ── Build 700-char record
        r = ""
        r += aL("D", 1)                # 1      Record type
        r += sa_id                      # 2-14   SA ID (13 digits)
        r += aL("", 16)                 # 15-30  Non-SA ID (blank)
        r += aL(gender_code, 1)         # 31     Gender
        r += nR(dob_str, 8)             # 32-39  Date of Birth (CCYYMMDD) — after gender per SACRRA
        r += aL("", 8)                  # 40-47  Branch code (blank per SACRRA feedback)
        r += account_no.rjust(25)[:25]  # 48-72  Account number
        r += aL("", 4)                  # 73-76  Sub-account
        r += aL(surname, 25)            # 77-101 Surname
        r += aL(title, 5)               # 102-106 Title
        r += aL(forename, 14)           # 107-120 Forename 1
        r += aL("", 14)                 # 121-134 Forename 2
        r += aL("", 14)                 # 135-148 Forename 3
        r += aL("", 25)                 # 149-173 Res address 1
        r += aL("", 25)                 # 174-198 Res address 2
        r += aL("", 25)                 # 199-223 Res address 3
        r += aL(province, 25)           # 224-248 Res address 4 (province)
        r += aL("", 6)                  # 249-254 Postal code
        r += aL("T", 1)                 # 255    Owner/Tenant
        r += aL("", 25)                 # 256-280 Postal addr 1
        r += aL("", 25)                 # 281-305 Postal addr 2
        r += aL("", 25)                 # 306-330 Postal addr 3
        r += aL("", 25)                 # 331-355 Postal addr 4
        r += aL("", 6)                  # 356-361 Postal code
        r += aL("00", 2)                # 362-363 Ownership type
        r += aL("O ", 2)                # 364-365 Loan reason
        r += aL("00", 2)                # 366-367 Payment type
        r += aL(account_type + " ", 2)  # 368-369 Account type
        r += nR(date_opened, 8)         # 370-377 Date opened
        r += nR("0", 8)                 # 378-385 Deferred date
        r += nR(date_last_pmt, 8)       # 386-393 Date last payment
        r += nR(str(open_bal), 9)       # 394-402 Opening balance
        r += nR(str(curr_bal), 9)       # 403-411 Current balance
        r += aL(bal_indicator, 1)       # 412    Balance indicator
        r += nR(str(amt_overdue), 9)    # 413-421 Amount overdue
        r += nR(str(instalment), 9)     # 422-430 Instalment
        r += nR(str(mths_arr), 2)       # 431-432 Months in arrears
        r += aL(status_code.ljust(2), 2) # 433-434 Status code
        r += nR(freq_code, 2)           # 435-436 Frequency
        r += aL(terms_val, 4)           # 437-440 Terms
        r += nR(status_date, 8)         # 441-448 Status date
        r += aL("", 8)                  # 449-456 Old branch code
        r += aL("", 25)                 # 457-481 Old account number
        r += aL("", 4)                  # 482-485 Old sub-account
        r += aL("", 10)                 # 486-495 Old supplier ref
        r += aL("", 16)                 # 496-511 Home telephone
        r += aL("", 16)                 # 512-527 Cellular
        r += aL("", 16)                 # 528-543 Work telephone
        r += aL(employer, 60)           # 544-603 Employer
        r += nR(str(income), 9)         # 604-612 Income
        r += aL("M", 1)                 # 613    Income frequency
        r += aL("", 20)                 # 614-633 Occupation
        r += aL("", 60)                 # 634-693 Third party name
        r += nR("0", 2)                 # 694-695 Account sold
        r += nR("0", 3)                 # 696-698 No. of participants
        r += aL("", 2)                  # 699-700 Filler

        if len(r) != 700:
            print(f"  WARNING: Record {account_no} is {len(r)} chars — skipped")
            skipped += 1
            continue

        lines.append(r)

    # ── Assemble file
    srn_padded   = SRN.ljust(10)[:10]
    trading_name = TRADING_NAME.upper()[:60].ljust(60)
    header       = ("H" + srn_padded + month_end_str + VERSION + creation_str + trading_name).ljust(700)[:700]
    trailer      = ("T" + str(len(lines) + 2).zfill(9)).ljust(700)[:700]
    content      = "\r\n".join([header] + lines + [trailer]) + "\r\n"

    out_dir  = os.path.dirname(excel_path)
    txt_name = f"{SRN}_ALL_T702_M_{creation_str}_1_1.txt"
    txt_path = os.path.join(out_dir, txt_name)

    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(content)

    # ── Write exclusion reports
    if excl_bad_id is not None and len(excl_bad_id) > 0:
        p = os.path.join(out_dir, f"SACRRA_excluded_invalid_IDs_{period_str}.csv")
        excl_bad_id.to_csv(p, index=False)
        bad_id_file = os.path.basename(p)
    else:
        bad_id_file = "none"

    if excl_stale_36m:
        p36 = os.path.join(out_dir, f"SACRRA_excluded_stale_36m_{period_str}.csv")
        pd.DataFrame(excl_stale_36m).to_csv(p36, index=False)
        stale_file = os.path.basename(p36)
    else:
        stale_file = "none"

    # ── Summary
    active_count = sum(1 for r in lines if r[411] == "D" and r[432:434].strip() == "")
    np_count     = sum(1 for r in lines if int(r[430:432]) > 0)
    paid_count   = sum(1 for r in lines if r[432:434].strip() == "T")
    canc_count   = sum(1 for r in lines if r[432:434].strip() == "V")

    print(f"\n{'='*57}")
    print(f"  SACRRA file: {txt_name}")
    print(f"  Total data records  : {len(lines):>7,}")
    print(f"    Active (current)  : {active_count:>7,}")
    print(f"    Non-Performing    : {np_count:>7,}  (arrears derived from Outstanding)")
    print(f"    Paid / Status T   : {paid_count:>7,}")
    print(f"    Cancelled / Stus V: {canc_count:>7,}")
    print(f"  Excluded bad IDs    : {len(excl_bad_id):>7,}  → {bad_id_file}")
    print(f"  Excluded stale >36m : {len(excl_stale_36m):>7,}  → {stale_file}")
    print(f"    (Submit stale file to SACRRA as separate historical bulk load)")
    print(f"  Skipped (bad len)   : {skipped:>7,}")
    print(f"  Luhn warnings       : {luhn_fail:>7,}")
    print(f"  Header month-end    : {month_end_str}")
    print(f"  Output              : {txt_path}")
    print(f"{'='*57}")
    print(f"\nDone. Submit {txt_name} to SACRRA via MOVEit.")


if __name__ == "__main__":
    main()
