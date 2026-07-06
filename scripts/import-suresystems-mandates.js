/**
 * One-time import: "AlgoLend All Mandates.xlsx" from SureSystems → suresystems_mandates table.
 * Run: node scripts/import-suresystems-mandates.js
 */
require('dotenv').config();
const XLSX  = require('xlsx');
const path  = require('path');
const { createClient } = require('@supabase/supabase-js');

const FILE_PATH   = path.join(process.env.HOME, 'Downloads', 'AlgoLend All Mandates.xlsx');
const BATCH_SIZE  = 500;
const TABLE       = 'suresystems_mandates';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normaliseStatus(raw) {
    if (!raw) return 'unknown';
    const s = raw.toLowerCase();
    if (s === 'active')                          return 'success';
    if (s === 'completed')                       return 'completed';
    if (s === 'cancelled' || s === 'canceled')   return 'cancelled';
    if (s === 'cancelinprogress')                return 'cancel_in_progress';
    if (s === 'suspended')                       return 'suspended';
    return s;
}

async function run() {
    console.log('Reading:', FILE_PATH);
    const wb   = XLSX.readFile(FILE_PATH);
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
    console.log(`Loaded ${rows.length} rows from Excel.`);

    const now = new Date().toISOString();

    const records = rows.map(r => ({
        contract_reference: String(r['Contract Reference'] || '').trim(),
        status:             normaliseStatus(r['Status']),
        message:            r['Status'] || null,
        response_payload: {
            gid:                    r['GID'],
            clientNumber:           r['Client Number'],
            userReference:          r['User Reference'],
            nextDateForCollection:  r['Next Date For Collection'],
            collectionDay:          r['Collection Day'],
            frequencyCode:          r['Frequency Code'],
            installmentAmount:      r['Installment Amount'],
            noOfInstallments:       r['No Of Installments'],
            cellphoneNo:            r['Cellphone No'],
            maximumCollectionAmount:r['Maximum Collection Amount'],
            accountNo:              r['Account No'],
            nameAndSurname:         r['Name And Surname'],
            clientId:               r['Client ID'],
            trackingIndicator:      r['Tracking Indicator'],
            noOfTrackingDays:       r['No Of Tracking Days'],
            creationDate:           r['Creation Date'],
            creationType:           r['Type'],
            authenticationType:     r['Authentication Type'],
            authorisationIndicator: r['Authorisation Indicator'],
            mdaReferenceNumber:     r['MDA Reference Number'],
            mandateInitiationDate:  r['Mandate Initiation Date'],
        },
        activated_at:    r['Creation Date'] ? new Date(r['Creation Date']).toISOString() : now,
        last_checked_at: now,
        updated_at:      now,
    })).filter(r => r.contract_reference);

    console.log(`Prepared ${records.length} records to upsert (${rows.length - records.length} skipped — no contract ref).`);

    let inserted = 0;
    let failed   = 0;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        // Use insert with ignoreDuplicates — avoids needing a unique constraint.
        // On re-runs duplicates are silently skipped; update manually if needed.
        const { error } = await supabase
            .from(TABLE)
            .insert(batch, { ignoreDuplicates: true });

        if (error) {
            console.error(`Batch ${i}–${i + batch.length} FAILED:`, error.message);
            failed += batch.length;
        } else {
            inserted += batch.length;
            process.stdout.write(`\r  Upserted ${inserted} / ${records.length}...`);
        }
    }

    console.log(`\nDone. ${inserted} upserted, ${failed} failed.`);
}

run().catch(err => { console.error(err); process.exit(1); });
