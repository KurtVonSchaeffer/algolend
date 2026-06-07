# Audit Trail System Documentation

## Overview

The audit trail system provides comprehensive logging and tracking of all compliance-critical operations in the SureSystems platform. It tracks loan state changes, user actions, financial transactions, admin activities, and system events.

## Architecture

### Service Layer (services/auditService.js)

The audit service provides functions for logging and retrieving audit events:

#### Logging Functions

- **logAuditEvent(userId, entityType, entityId, action, data)** - Generic entity audit logging
  - Used for tracking general entity changes
  - Parameters: JSONB old_values, new_values, changesSummary, metadata, notes

- **logLoanStateChange(loanId, userId, previousStatus, newStatus, data)** - Loan state transitions
  - Tracks status changes, balance updates, payment date changes
  - Captures reason and metadata

- **logUserAction(userId, actionType, targetType, targetId, data)** - User/admin actions
  - Tracks approval, decline, override, review, export, delete actions
  - Captures IP address and user agent
  - Examples: approval_reason, decline_reason

- **logFinancialTransaction(loanId, transactionType, amount, data)** - Payment and fee tracking
  - transaction_type: 'payment', 'fee', 'interest', 'default_charge', 'reversal'
  - Captures balance before/after, reference numbers, status

- **logAdminAction(adminId, actionCategory, actionDescription, data)** - High-risk admin actions
  - action_category: 'application_management', 'loan_management', 'payout_management', 'system_config'
  - Risk level: 'low', 'medium', 'high'
  - Affected records tracking

- **logSystemEvent(eventType, severity, eventDescription, data)** - System-level events
  - event_type: 'config_change', 'error', 'warning', 'integration_call', 'scheduled_task'
  - severity: 'debug', 'info', 'warning', 'error', 'critical'

#### Retrieval Functions

- **getAuditTrail(filters)** - Query audit_log with filters
  - Supports: user_id, entity_type, entity_id, action, start_date, end_date, limit

- **getLoanStateHistory(loanId)** - Get all status changes for a loan

- **getUserActionHistory(userId, limit)** - Get user's action history

- **getRecentAuditActivity(days)** - Get activity from last N days (view-based)

### Database Schema (sql/add_comprehensive_audit_trail.sql)

#### Tables

**1. audit_log** - Entity-agnostic audit trail
- user_id, entity_type, entity_id, action
- old_values, new_values (JSONB for flexible data)
- changes_summary, metadata, notes
- created_at, updated_at timestamps

**2. loan_state_history** - Loan-specific tracking
- loan_id, user_id, previous_status, new_status
- balance transitions: previous_balance, new_balance
- payment date changes: previous_payment_date, new_payment_date
- reason for change, metadata

**3. user_action_log** - User/admin actions
- user_id, action_type, target_type, target_id
- action_details (JSONB)
- notes, approval_reason, decline_reason
- ip_address, user_agent for security tracking

**4. financial_transaction_log** - Payment tracking
- loan_id, transaction_type, amount
- balance_before, balance_after
- reference_number, external_reference, status
- metadata for additional details

**5. admin_action_audit** - Admin action tracking
- admin_id, action_category, action_description
- affected_records (JSONB list)
- risk_level: low, medium, high
- ip_address, session_id
- approval_status, reviewed_by, review_notes

**6. system_event_log** - System events
- event_type, severity, event_description
- event_data (JSONB), affected_users_count
- resolution_status, resolution_notes
- Timestamps for creation and resolution

**7. recent_audit_activity (VIEW)** - Combined activity view
- Unions audit_log, loan_state_history, user_action_log
- Filters to last 7 days
- Used for dashboard activity feeds

### API Endpoints

All endpoints require proper authentication and return audit data in JSON format.

#### GET /api/audit/trail

Query audit logs with flexible filtering.

**Query Parameters:**
- `user_id` - Filter by user who performed the action
- `entity_type` - Filter by entity type (loan, application, disbursement, etc.)
- `entity_id` - Filter by specific entity
- `action` - Filter by action type
- `start_date` - ISO timestamp for range start
- `end_date` - ISO timestamp for range end
- `limit` - Maximum results (default: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": "uuid",
      "entity_type": "loan",
      "entity_id": 123,
      "action": "status_change",
      "old_values": {...},
      "new_values": {...},
      "changes_summary": "Status changed from ACTIVE to DEFAULT",
      "metadata": {...},
      "created_at": "2026-04-27T10:00:00Z"
    }
  ],
  "error": null
}
```

#### GET /api/audit/loan-state/:loanId

Get all status changes for a specific loan.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "loan_id": 123,
      "user_id": "uuid",
      "previous_status": "ACTIVE",
      "new_status": "DEFAULT",
      "previous_balance": 5000.00,
      "new_balance": 4900.00,
      "reason": "Payment missed",
      "metadata": {...},
      "created_at": "2026-04-27T10:00:00Z"
    }
  ],
  "error": null
}
```

#### GET /api/audit/user-actions/:userId

Get action history for a specific user.

**Query Parameters:**
- `limit` - Maximum results (default: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": "uuid",
      "action_type": "approval",
      "target_type": "application",
      "target_id": 456,
      "action_details": {...},
      "approval_reason": "Meets affordability criteria",
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2026-04-27T10:00:00Z"
    }
  ],
  "error": null
}
```

#### GET /api/audit/recent

Get recent audit activity from the last N days.

**Query Parameters:**
- `days` - Number of days to look back (default: 7)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "log_type": "audit",
      "id": 1,
      "user_id": "uuid",
      "entity_type": "loan",
      "action": "status_change",
      "created_at": "2026-04-27T10:00:00Z",
      "entity_id": 123
    }
  ],
  "error": null
}
```

#### POST /api/audit/event

Manually log an audit event.

**Request Body:**
```json
{
  "userId": "uuid",
  "entityType": "loan",
  "entityId": 123,
  "action": "manual_review",
  "data": {
    "oldValues": {...},
    "newValues": {...},
    "changesSummary": "Manual review completed",
    "metadata": {...},
    "notes": "Additional context"
  }
}
```

**Response:**
```json
{
  "success": true,
  "error": null
}
```

## Integration Points

The audit system has been integrated into the following workflows:

### 1. Loan Default Management
- **Mark Default**: Logs loan state change with default amount
- **Clear Default**: Logs loan state change back to active status

### 2. Disbursement Operations
- **Create Disbursement**: Logs financial transaction for loan amount
- **Update Status**: Logs user action for status changes
- **Export CSV**: Logs user action with batch ID and export details

### 3. Metadata Capture
All audit events capture:
- IP Address: `req.ip || req.connection.remoteAddress`
- User Agent: `req.get('user-agent')`
- Timestamps: Automatically added by database

## Deployment

### Prerequisites
- Supabase database with service role key access
- Node.js for running migration script

### Step 1: Run Migration

Execute the SQL migration to create audit tables:

**Option A: Automated (with service role key)**
```bash
SUPABASE_SERVICE_ROLE_KEY="your-key-here" node scripts/runMigration.js
```

**Option B: Manual (via Supabase dashboard)**
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Create a new query
4. Copy the contents of `sql/add_comprehensive_audit_trail.sql`
5. Execute the query

### Step 2: Verify Tables

Check that all audit tables were created:
```bash
curl -X GET "http://localhost:5000/api/audit/recent?days=1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Should return: `{"success":true,"data":[],"error":null}`

(Empty data is expected before any audit events are logged)

### Step 3: Test Audit Logging

Perform operations that trigger audit logging (mark default, create disbursement, etc.) and verify:

```bash
curl -X GET "http://localhost:5000/api/audit/trail?entity_type=loan" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Usage Examples

### Query loan state history
```javascript
const response = await fetch('/api/audit/loan-state/123');
const { data: history } = await response.json();
console.log(`Loan has ${history.length} state transitions`);
```

### Find all user actions
```javascript
const response = await fetch(`/api/audit/user-actions/${userId}`);
const { data: actions } = await response.json();
console.log(`User performed ${actions.length} actions`);
```

### Filter by date range
```javascript
const response = await fetch(
  '/api/audit/trail?' +
  'entity_type=disbursement&' +
  'start_date=2026-04-01&' +
  'end_date=2026-04-30'
);
const { data: records } = await response.json();
```

### Recent activity dashboard
```javascript
const response = await fetch('/api/audit/recent?days=7');
const { data: activity } = await response.json();
// Shows all activity from last 7 days across all audit sources
```

## Performance Considerations

- **Indexing**: All audit tables include indexes on commonly queried fields
- **Retention**: Tables use `ON DELETE CASCADE` for referential integrity
- **Query Optimization**: Use filters to reduce result sets
- **Recent Activity View**: Pre-filtered to 7-day window for performance

## Security

- All audit endpoints require authentication
- IP addresses and user agents captured for security tracking
- Admin actions tracked with risk levels
- Approval workflows require documented reasons
- All modifications create immutable audit records

## Future Enhancements

- Admin action approval workflows
- Audit log encryption for sensitive data
- Export functionality for compliance reporting
- Automated alerts for high-risk actions
- Real-time audit dashboard
- Integration with external audit systems
