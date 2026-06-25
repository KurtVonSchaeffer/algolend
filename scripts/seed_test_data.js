/**
 * seed_test_data.js — populate AlgoLend with realistic fake data for testing
 * Usage: node scripts/seed_test_data.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const tsAgo  = (d) => new Date(Date.now() - d * 86400000).toISOString();
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); };
const monthsAhead = (n) => { const d = new Date(); d.setMonth(d.getMonth()+n); return d.toISOString().slice(0,10); };

const makeOffer = (p, t, r=0.05) => {
  const m = p * r * Math.pow(1+r,t) / (Math.pow(1+r,t)-1);
  return { offer_principal: p, offer_monthly_repayment: Math.round(m*100)/100, offer_total_repayment: Math.round(m*t*100)/100, offer_interest_rate: r*100 };
};

async function run() {
  console.log('🌱  Seeding AlgoLend test data…\n');

  // 1. Branch
  const { data: br } = await sb.from('branches').select('id').limit(1);
  let branchId = br?.[0]?.id;
  if (!branchId) {
    const { data: newBr, error } = await sb.from('branches')
      .insert([{ name: 'Johannesburg HQ', region: 'Gauteng', address: '1 Sandton Drive, Sandton, 2196', phone: '0110001234' }])
      .select().single();
    if (error) { console.error('branch:', error.message); process.exit(1); }
    branchId = newBr.id;
    console.log(`✓ Branch created (id: ${branchId})`);
  } else {
    console.log(`✓ Branch exists (id: ${branchId})`);
  }

  // 2. Profiles
  const borrowers = [
    { full_name:'Thabo Nkosi',     identity_number:'8001015009087', cell_tel_no:'0821230001', email:'thabo.nkosi.seed@example.com',   role:'borrower', branch_id:branchId },
    { full_name:'Lindiwe Dlamini', identity_number:'8503224800086', cell_tel_no:'0731230002', email:'lindi.dlamini.seed@example.com',  role:'borrower', branch_id:branchId },
    { full_name:'Sipho Molefe',    identity_number:'9206075800085', cell_tel_no:'0661230003', email:'sipho.molefe.seed@example.com',   role:'borrower', branch_id:branchId },
    { full_name:'Nomsa Khumalo',   identity_number:'7812124800084', cell_tel_no:'0601230004', email:'nomsa.khumalo.seed@example.com',  role:'borrower', branch_id:branchId },
    { full_name:'Kagiso Sithole',  identity_number:'9510106800083', cell_tel_no:'0841230005', email:'kagiso.sithole.seed@example.com', role:'borrower', branch_id:branchId },
    { full_name:'Ayanda Zulu',     identity_number:'8807274800082', cell_tel_no:'0711230006', email:'ayanda.zulu.seed@example.com',    role:'borrower', branch_id:branchId },
  ];
  const { data: profiles, error: profErr } = await sb.from('profiles').insert(borrowers).select();
  if (profErr) { console.error('profiles:', profErr.message); process.exit(1); }
  console.log(`✓ ${profiles.length} borrower profiles`);

  // 3. Loan applications
  const seq = parseInt(Date.now().toString().slice(-3), 10) * 10;
  const base = { has_credit_life_insurance:false, offer_credit_life_total:0, credit_life_contract_signed:false, source:'IN_BRANCH' };

  const apps = [
    { ...base, user_id:profiles[0].id, branch_id:branchId, loan_number:seq+1, amount:15000, term_months:12, loan_purpose:'Home renovation',   status:'DISBURSED',      created_at:tsAgo(30), repayment_start_date:monthsAhead(1), ...makeOffer(15000,12) },
    { ...base, user_id:profiles[1].id, branch_id:branchId, loan_number:seq+2, amount:8000,  term_months:6,  loan_purpose:'School fees',        status:'DEBICHECK_AUTH', created_at:tsAgo(3),  repayment_start_date:monthsAhead(1), ...makeOffer(8000,6)  },
    { ...base, user_id:profiles[2].id, branch_id:branchId, loan_number:seq+3, amount:25000, term_months:24, loan_purpose:'Vehicle repair',      status:'OFFERED',        created_at:tsAgo(1),  repayment_start_date:monthsAhead(1), ...makeOffer(25000,24) },
    { ...base, user_id:profiles[3].id, branch_id:branchId, loan_number:seq+4, amount:5000,  term_months:3,  loan_purpose:'Emergency expenses',  status:'BUREAU_CHECKING',created_at:tsAgo(2) },
    { ...base, user_id:profiles[4].id, branch_id:branchId, loan_number:seq+5, amount:50000, term_months:36, loan_purpose:'Business expansion',  status:'DECLINED',       created_at:tsAgo(10) },
    { ...base, user_id:profiles[5].id, branch_id:branchId, loan_number:seq+6, amount:12000, term_months:12, loan_purpose:'Medical bills',       status:'STARTED',        created_at:new Date().toISOString() },
  ];

  const { data: insertedApps, error: appErr } = await sb.from('loan_applications').insert(apps).select();
  if (appErr) { console.error('loan_applications:', appErr.message); process.exit(1); }
  console.log(`✓ ${insertedApps.length} loan applications`);

  // 4. Cash journal entry for disbursed loan
  const disbApp = insertedApps.find(a => a.status === 'DISBURSED');
  if (disbApp) {
    const { error: jErr } = await sb.from('cash_journal').insert([{
      entry_date:      daysAgo(5),
      entry_type:      'cash_out',
      category:        'loan_disbursement',
      description:     `Loan disbursement — L${String(disbApp.loan_number).padStart(4,'0')} / ${profiles[0].full_name}`,
      reference:       String(disbApp.id).slice(0,8).toUpperCase(),
      amount:          disbApp.offer_principal || disbApp.amount,
      created_by_name: 'Seed Script',
    }]);
    if (jErr) console.warn('cash_journal:', jErr.message);
    else console.log('✓ Cash journal entry');
  }

  console.log('\n✅  Done. Refresh the admin dashboard.\n');
  console.log('Seeded profiles:');
  profiles.forEach(p => console.log(`  • ${p.full_name.padEnd(18)} ${p.email}`));
}

run().catch(e => { console.error(e); process.exit(1); });
