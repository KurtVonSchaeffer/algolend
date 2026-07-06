const { supabase } = require('./config/supabaseServer.js');

async function seedSettings() {
  const settings = {
    id: 'global',
    company_name: 'AlgoLend',
    primary_color: '#B026FF', // Luminous neon purple
    secondary_color: '#4A0E8F', // Deep purple
    tertiary_color: '#11022A', // Dark aesthetic
    theme_mode: 'dark',
    auth_overlay_color: '#1E0B3B', // Glassmorphic dark purple
    auth_overlay_enabled: true,
    carousel_slides: [
      {
        title: "Front End: Fully Branded Client Application Portal",
        text: "Real-Time Affordability Intelligence (TruID Integration)\nCorporate Document Upload & E-Contracts"
      },
      {
        title: "Back-End Risk & Compliance Engine",
        text: "Instantly run real-time CIPC company checks, AML screening, director credit scoring, and biometric liveness checks at the point of application"
      },
      {
        title: "Robust Operational Backbone",
        text: "Mandate Control Room & Live Dry-Runs\nRisk-Based Pricing & Approval Hierarchies\nFull Audit Trail & Role-Based Access Logs"
      }
    ],
    ncr_number: 'NCRCP13510',
    company_reg_number: '2023/123456/07',
    company_vat_number: '4012345678',
    company_phone: '0691195046'
  };

  const { data, error } = await supabase.from('system_settings').upsert(settings).select();
  if (error) {
    console.error('Error seeding settings:', error);
  } else {
    console.log('Settings seeded successfully!', data);
  }

  // Add some mock loans so the dashboard isn't empty
  const mockLoans = [
    {
      id: "L-1000",
      client_id: "C-001",
      amount: 500000,
      status: "Approved",
      interest_rate: 15.5,
      term_months: 24,
      purpose: "Working Capital"
    },
    {
      id: "L-1001",
      client_id: "C-002",
      amount: 1200000,
      status: "Pending",
      interest_rate: 18.0,
      term_months: 36,
      purpose: "Equipment Financing"
    },
    {
      id: "L-1002",
      client_id: "C-003",
      amount: 250000,
      status: "Active",
      interest_rate: 14.0,
      term_months: 12,
      purpose: "Inventory"
    }
  ];

  const { data: loanData, error: loanErr } = await supabase.from('loans').upsert(mockLoans).select();
  if (loanErr) {
    console.error('Error seeding loans:', loanErr);
  } else {
    console.log('Loans seeded successfully!', loanData);
  }
}

seedSettings();
