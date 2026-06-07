import { supabase } from './supabaseClient.js';

// DocuSeal Configuration (via backend proxy)
const DOCUSEAL_PROXY_URL = '/api/docuseal';
const DOCUSEAL_TEMPLATE_ID = import.meta.env.VITE_DOCUSEAL_TEMPLATE_ID;
const DOCUSEAL_ENABLED = import.meta.env.VITE_DOCUSEAL_ENABLED !== 'false';

/**
 * Checks if DocuSeal is configured with API key and template ID.
 * @returns {boolean} True if both are present, false otherwise.
 */
export function isDocuSealConfigured() {
  return Boolean(DOCUSEAL_ENABLED && DOCUSEAL_TEMPLATE_ID);
}

/**
 * Send a contract via DocuSeal
 * @param {Object} applicationData - The loan application data
 * @param {Object} profileData - The user profile data
 * @returns {Promise<Object>} DocuSeal submission response
 */
export async function sendContract(applicationData, profileData) {
  try {
    if (!isDocuSealConfigured()) {
      throw new Error('DocuSeal integration is disabled');
    }

    const response = await fetch(`${DOCUSEAL_PROXY_URL}/send-contract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        applicationData,
        profileData
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('DocuSeal proxy error:', response.status, error);
      throw new Error(error.error || error.message || `Failed to send contract: ${response.status}`);
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error('Invalid response from DocuSeal API');
    }
    
    // DocuSeal returns an array of submitters
    const submitter = data[0];
    
    // Save submission info to database
    await saveSubmissionToDatabase(submitter, applicationData.id);
    
    return {
      submission_id: submitter.submission_id,
      submitter_id: submitter.id,
      slug: submitter.slug,
      status: submitter.status,
      embed_src: submitter.embed_src,
      email: submitter.email
    };
  } catch (error) {
    console.error('DocuSeal send contract error:', error);
    throw error;
  }
}

/**
 * Get submission status from DocuSeal
 * @param {string} submissionId - The DocuSeal submission ID
 * @returns {Promise<Object>} Submission status
 */
export async function getSubmissionStatus(submissionId) {
  try {
    const response = await fetch(`${DOCUSEAL_PROXY_URL}/submissions/${submissionId}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || `Failed to fetch submission status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('DocuSeal get status error:', error);
    throw error;
  }
}

/**
 * Get submitter details from DocuSeal
 * @param {string} submitterId - The DocuSeal submitter ID
 * @returns {Promise<Object>} Submitter details
 */
export async function getSubmitterDetails(submitterId) {
  try {
    const response = await fetch(`${DOCUSEAL_PROXY_URL}/submitters/${submitterId}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || `Failed to fetch submitter details: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('DocuSeal get submitter error:', error);
    throw error;
  }
}

/**
 * Get all submissions for an application
 * @param {string} applicationId - The application ID
 * @returns {Promise<Array>} Array of submissions
 */
export async function getApplicationSubmissions(applicationId) {
  try {
    const { data, error } = await supabase
      .from('docuseal_submissions')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return [];
  }
}

/**
 * Save DocuSeal submission to database
 * @param {Object} submitter - DocuSeal submitter data
 * @param {string} applicationId - Application ID
 */
async function saveSubmissionToDatabase(submitter, applicationId) {
  try {
    const { error } = await supabase
      .from('docuseal_submissions')
      .insert({
        application_id: applicationId,
        submission_id: submitter.submission_id,
        submitter_id: submitter.id,
        slug: submitter.slug,
        status: submitter.status || 'pending',
        email: submitter.email,
        name: submitter.name,
        role: submitter.role,
        embed_src: submitter.embed_src,
        sent_at: submitter.sent_at,
        opened_at: submitter.opened_at,
        completed_at: submitter.completed_at,
        metadata: submitter.metadata || {},
        created_at: new Date().toISOString()
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error saving submission to database:', error);
    throw error;
  }
}

/**
 * Update submission status in database
 * @param {string} submissionId - DocuSeal submission ID
 * @param {string} status - New status
 * @param {Object} additionalFields - Additional fields to update
 */
export async function updateSubmissionStatus(submissionId, status, additionalFields = {}) {
  try {
    const { error } = await supabase
      .from('docuseal_submissions')
      .update({ 
        status,
        ...additionalFields,
        updated_at: new Date().toISOString()
      })
      .eq('submission_id', submissionId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating submission status:', error);
    throw error;
  }
}

/**
 * Update submitter status in database
 * @param {string} submitterId - DocuSeal submitter ID
 * @param {string} status - New status
 * @param {Object} additionalFields - Additional fields to update
 */
export async function updateSubmitterStatus(submitterId, status, additionalFields = {}) {
  try {
    const { error } = await supabase
      .from('docuseal_submissions')
      .update({ 
        status,
        ...additionalFields,
        updated_at: new Date().toISOString()
      })
      .eq('submitter_id', submitterId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating submitter status:', error);
    throw error;
  }
}

/**
 * Get DocuSeal embed URL
 * @param {string} submitterSlug - The submitter slug
 * @returns {string} Embed URL
 */
export function getEmbedUrl(submitterSlug) {
  return `https://docuseal.co/s/${submitterSlug}`;
}

/**
 * Resend contract email to a specific submitter
 * @param {string} submitterId - DocuSeal submitter ID
 * @param {Object} options - Optional email customization
 * @returns {Promise<Object>} Updated submitter data
 */
export async function resendContract(submitterId, options = {}) {
  try {
    const response = await fetch(`${DOCUSEAL_PROXY_URL}/submitters/${submitterId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        send_email: true,
        ...options
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || `Failed to resend contract: ${response.status}`);
    }

    const data = await response.json();
    
    // Update database with new sent_at timestamp
    await updateSubmitterStatus(submitterId, data.status, {
      sent_at: data.sent_at
    });

    return data;
  } catch (error) {
    console.error('DocuSeal resend error:', error);
    throw error;
  }
}

/**
 * Archive/void a submission
 * @param {string} submissionId - DocuSeal submission ID
 * @returns {Promise<Object>} Archive confirmation
 */
export async function voidSubmission(submissionId) {
  try {
    const response = await fetch(`${DOCUSEAL_PROXY_URL}/submissions/${submissionId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || `Failed to archive submission: ${response.status}`);
    }

    const data = await response.json();

    // Update in database
    await updateSubmissionStatus(submissionId, 'archived', {
      archived_at: data.archived_at
    });

    return data;
  } catch (error) {
    console.error('DocuSeal archive error:', error);
    throw error;
  }
}

/**
 * Helper function to get submitter ID from submission
 * @param {string} submissionId - DocuSeal submission ID
 * @param {string} email - Optional email to filter specific submitter
 * @returns {Promise<string>} Submitter ID
 */
export async function getSubmitterIdFromSubmission(submissionId, email = null) {
  try {
    const submission = await getSubmissionStatus(submissionId);
    
    if (!submission.submitters || submission.submitters.length === 0) {
      throw new Error('No submitters found for this submission');
    }
    
    // If email provided, find matching submitter
    if (email) {
      const submitter = submission.submitters.find(s => s.email === email);
      if (!submitter) {
        throw new Error(`No submitter found with email: ${email}`);
      }
      return submitter.id;
    }
    
    // Return the first submitter's ID
    return submission.submitters[0].id;
  } catch (error) {
    console.error('Error getting submitter ID:', error);
    throw error;
  }
}

/**
 * Download completed document
 * @param {string} submitterId - DocuSeal submitter ID
 * @returns {Promise<Object>} Document details with download URL
 */
export async function getCompletedDocument(submitterId) {
  try {
    const submitter = await getSubmitterDetails(submitterId);
    
    if (submitter.status !== 'completed') {
      throw new Error('Document has not been completed yet');
    }
    
    if (!submitter.documents || submitter.documents.length === 0) {
      throw new Error('No documents found for this submitter');
    }
    
    return submitter.documents;
  } catch (error) {
    console.error('Error getting completed document:', error);
    throw error;
  }
}

/**
 * Get audit log URL for completed submission
 * @param {string} submissionId - DocuSeal submission ID
 * @returns {Promise<string>} Audit log URL
 */
export async function getAuditLogUrl(submissionId) {
  try {
    const submission = await getSubmissionStatus(submissionId);
    
    if (submission.status !== 'completed') {
      throw new Error('Submission has not been completed yet');
    }
    
    if (!submission.audit_log_url) {
      throw new Error('Audit log not available');
    }
    
    return submission.audit_log_url;
  } catch (error) {
    console.error('Error getting audit log:', error);
    throw error;
  }
}

/**
 * Webhook handler for DocuSeal events
 * @param {Object} webhookPayload - Webhook payload from DocuSeal
 * @returns {Promise<void>}
 */
export async function handleDocuSealWebhook(webhookPayload) {
  try {
    const { event_type, data } = webhookPayload;
    
    switch (event_type) {
      case 'form.viewed':
        await updateSubmitterStatus(data.id, 'opened', {
          opened_at: data.opened_at
        });
        break;
        
      case 'form.started':
        await updateSubmitterStatus(data.id, 'started');
        break;
        
      case 'form.completed':
        await updateSubmitterStatus(data.id, 'completed', {
          completed_at: data.completed_at,
          values: data.values
        });
        break;
        
      case 'submission.created':
        // Handle new submission creation if needed.
        break;
        
      case 'submission.archived':
        await updateSubmissionStatus(data.id, 'archived', {
          archived_at: data.archived_at
        });
        break;
        
      default:
        console.log('Unhandled webhook event:', event_type);
    }
  } catch (error) {
    console.error('Error handling DocuSeal webhook:', error);
    throw error;
  }
}
