// Basic Express server for Portal
const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const tillSlipRoute = require('./routes/tillSlipRoute');
const bankStatementRoute = require('./routes/bankStatementRoute');
const idcardRoute = require('./routes/idcardRoute');
const kyc = require(path.join(__dirname, '..', 'user-portal', 'Services', 'kycService'));

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5001;

// Serve static files from public
app.use(express.static(path.join(__dirname, 'public')));

// API routes.

// Document upload routes
app.use('/api/tillslip', tillSlipRoute);
app.use('/api/bankstatement', bankStatementRoute);
app.use('/api/idcard', idcardRoute);

// KYC API routes
app.post('/api/kyc/create-session', async (req, res) => {
  try {
    const result = await kyc.createSession(req.body);
    res.json(result);
  } catch (error) {
    console.error('KYC session error:', error);
    console.error('DIDIT_API_KEY:', process.env.DIDIT_API_KEY);
    console.error('DIDIT_WEBHOOK_SECRET_KEY:', process.env.DIDIT_WEBHOOK_SECRET_KEY);
    console.error('DIDIT_WORKFLOW_ID:', process.env.DIDIT_WORKFLOW_ID);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/kyc/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-signature'];
    const payload = req.body;
    if (!signature || !kyc.verifyWebhookSignature(payload, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    kyc.updateSessionFromWebhook(payload);
    res.status(200).json({ received: true });
  } catch (error) {
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

app.get('/api/kyc/session/:sessionId', async (req, res) => {
  try {
    const result = await kyc.getSessionStatus(req.params.sessionId);
    res.json(result);
  } catch (error) {
    res.status(404).json({ error: 'Session not found' });
  }
});

app.get('/api/kyc/user/:userId/status', async (req, res) => {
  try {
    const result = await kyc.getUserKycStatus(req.params.userId);
    res.json(result);
  } catch (error) {
    console.error('Error getting KYC status:', error);
    res.status(500).json({ verified: false, error: error.message });
  }
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Portal app running at http://localhost:${PORT}`);
});
// Fallback to index.html for SPA routing
