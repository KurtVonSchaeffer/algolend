import { resolve } from 'path';

export default {
  base: '/', 
 
  server: {
    host: true,
    hmr: {
      clientPort: 443, 
    }
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        // Core
        main: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        settings: resolve(__dirname, 'settings.html'),
        users: resolve(__dirname, 'users.html'),

        // Applications
        applications: resolve(__dirname, 'applications.html'),
        applicationDetail: resolve(__dirname, 'application-detail.html'),
        createApplicationStep1: resolve(__dirname, 'create-application-step1.html'),
        
        // Payments
        incomingPayments: resolve(__dirname, 'incoming-payments.html'),
        outgoingPayments: resolve(__dirname, 'outgoing-payments.html'),
        
        // Analytics 
        analytics: resolve(__dirname, 'analytics.html'),

        // Financials 
        financials: resolve(__dirname, 'financials.html'),

        // Compliance
        sacrra:            resolve(__dirname, 'sacrra.html'),
        sacrraValidator:   resolve(__dirname, 'sacrra-validator.html'),
        mandates:          resolve(__dirname, 'mandates.html'),
        ncrReporting:      resolve(__dirname, 'ncr-reporting.html'),
        ncrRegisters:      resolve(__dirname, 'ncr-registers.html'),
        complianceTracker: resolve(__dirname, 'compliance-tracker.html'),
        goaml:             resolve(__dirname, 'goaml.html'),
        portfolio:         resolve(__dirname, 'portfolio.html'),

        // Configuration
        creditRules: resolve(__dirname, 'credit-rules.html'),
        cashLedger:  resolve(__dirname, 'cash-ledger.html'),
        loanBook:    resolve(__dirname, 'loan-book.html')
      },
    },
  },
};