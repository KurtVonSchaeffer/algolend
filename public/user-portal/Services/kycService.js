const axios = require('axios');
const crypto = require('crypto');
const BASE_URL = process.env.DIDIT_BASE_URL || 'https://verification.didit.me';

// In-memory session storage (use database in production)
const sessions = new Map();

function verifyWebhookSignature(payload, signature) {
  try {
    const WEBHOOK_SECRET_KEY = process.env.DIDIT_WEBHOOK_SECRET_KEY;
    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET_KEY);
    hmac.update(JSON.stringify(payload));
    const computedSignature = hmac.digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computedSignature)
    );
  } catch (error) {
    return false;
  }
}

async function createSession({ userId, email, phone, metadata }) {
  const API_KEY = process.env.DIDIT_API_KEY;
  const WORKFLOW_ID = process.env.DIDIT_WORKFLOW_ID;

  if (!API_KEY || !WORKFLOW_ID) {
    const configError = new Error('KYC configuration missing: DIDIT_API_KEY and DIDIT_WORKFLOW_ID are required');
    configError.status = 503;
    configError.details = {
      missing: [
        !API_KEY ? 'DIDIT_API_KEY' : null,
        !WORKFLOW_ID ? 'DIDIT_WORKFLOW_ID' : null
      ].filter(Boolean)
    };
    throw configError;
  }

  if (!userId || !email) {
    throw new Error('userId and email are required');
  }

  let response;
  try {
    response = await axios.post(
      `${BASE_URL}/v2/session/`,
      {
        workflow_id: WORKFLOW_ID,
        vendor_data: userId,
        metadata: metadata || {},
        contact_details: {
          email: email,
          email_lang: 'en',
          phone: phone || undefined
        }
      },
      {
        headers: {
          'X-Api-Key': API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    const providerData = error?.response?.data || null;
    const providerMessage =
      providerData?.message
      || providerData?.error
      || providerData?.detail
      || error?.message
      || 'Unable to create KYC session';

    const normalized = new Error(providerMessage);
    normalized.status = status;
    normalized.details = {
      providerStatus: status,
      providerResponse: providerData,
      endpoint: `${BASE_URL}/v2/session/`
    };
    throw normalized;
  }

  const sessionData = response.data;
  
  // Store in memory
  sessions.set(sessionData.session_id, {
    userId: userId,
    sessionId: sessionData.session_id,
    sessionToken: sessionData.session_token,
    status: sessionData.status,
    email: email,
    createdAt: new Date().toISOString()
  });
  
  // Also save to database
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );
    
    // Delete any existing 'not started' sessions for this user
    // Keep 'started', 'in progress', or 'approved' sessions (don't interrupt active verification)
    const { data: existingSessions } = await supabase
      .from('kyc_sessions')
      .select('session_id, status')
      .eq('user_id', userId);
    
    if (existingSessions && existingSessions.length > 0) {
      const notStartedSessionIds = existingSessions
        .filter(s => {
          const status = (s.status || '').toString().toLowerCase().trim();
          // Only delete truly "not started" sessions - keep active or completed ones
          return status === 'not started' || status === '' || status === 'created';
        })
        .map(s => s.session_id);
      
      if (notStartedSessionIds.length > 0) {
        console.log(`🗑️ Deleting ${notStartedSessionIds.length} 'not started' KYC session(s) for user ${userId}`);
        await supabase
          .from('kyc_sessions')
          .delete()
          .in('session_id', notStartedSessionIds);
      }
    }
    
    // Now insert the new session
    await supabase.from('kyc_sessions').insert({
      session_id: sessionData.session_id,
      user_id: userId,
      status: sessionData.status,
      session_token: sessionData.session_token,
      verification_url: sessionData.url,
      created_at: new Date().toISOString()
    });
  } catch (dbError) {
    console.error('Error saving KYC session to database:', dbError);
  }
  
  return {
    success: true,
    session_id: sessionData.session_id,
    verification_url: sessionData.url,
    status: sessionData.status
  };
}

async function downloadAndUploadImage(imageUrl, userId, imageType, bucketName = 'documents') {
  try {
    if (!imageUrl) {
      console.log(`ℹ️ No ${imageType} URL provided, skipping upload`);
      return null;
    }

    console.log(`📥 Downloading ${imageType} from DIDIT...`);
    
    // Download image from DIDIT S3
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);
    
    // Determine file extension from URL or content type
    const contentType = response.headers['content-type'] || 'image/jpeg';
    const extension = contentType.includes('png') ? 'png' : 'jpg';
    const timestamp = Date.now();
    const fileName = `kyc/${userId}_${imageType}_${timestamp}.${extension}`;
    
    console.log(`📤 Uploading ${imageType} to Supabase Storage as ${fileName}...`);
    
    // Upload to Supabase Storage
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );
    
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, buffer, {
        contentType: contentType,
        upsert: false
      });
    
    if (error) {
      console.error(`❌ Error uploading ${imageType}:`, error);
      return null;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);
    
    console.log(`✅ ${imageType} uploaded successfully: ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch (err) {
    console.error(`❌ Error downloading/uploading ${imageType}:`, err);
    return null;
  }
}

/**
 * Process Didit webhook updates for KYC sessions
 * 
 * Expected status values from Didit:
 * - "Started" / "started" - User began verification
 * - "In Progress" / "in_progress" - Verification in progress
 * - "Approved" / "approved" - Verification successful
 * - "Rejected" / "rejected" - Verification failed
 * - "Expired" / "expired" - Session expired
 * 
 * This function updates the database for ALL statuses, not just approved.
 */
async function updateSessionFromWebhook(payload) {
  const { session_id, status, event_type } = payload;
  
  console.log('🔔 Webhook received:', { session_id, status, event_type, fullPayload: payload });
  
  // Normalize status for consistent comparison
  const normalizedStatus = (status || '').toString().toLowerCase().trim();
  
  // Update in-memory storage
  if (sessions.has(session_id)) {
    const session = sessions.get(session_id);
    session.status = status;
    session.lastUpdated = new Date().toISOString();
    session.eventType = event_type;
    sessions.set(session_id, session);
  }
  
  // Get userId - needed for all updates
  let userId = null;
  if (sessions.has(session_id)) {
    userId = sessions.get(session_id).userId;
  } else {
    // Fetch from database
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
      );
      const { data } = await supabase
        .from('kyc_sessions')
        .select('user_id')
        .eq('session_id', session_id)
        .single();
      userId = data?.user_id;
    } catch (err) {
      console.error('⚠️ Could not fetch user_id from database:', err);
    }
  }
  
  console.log(`👤 User ID for session: ${userId}`);
  
  // If approved, fetch full session details to get extracted data
  let extractedData = null;
  if (normalizedStatus === 'approved') {
    try {
      const sessionDetails = await getSessionStatus(session_id);
      extractedData = sessionDetails?.details || null;
      console.log('📄 Extracted session data:', extractedData);
    } catch (err) {
      console.error('⚠️ Could not fetch session details:', err);
    }
  }
  
  // Update in database (runs for ALL statuses)
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );
    
    console.log(`💾 Updating database for session ${session_id}...`);
    
    // Prepare update object
    const updateData = {
      status: status,
      event_type: event_type,
      last_updated: new Date().toISOString()
    };
    
    // Extract personal information if available
    if (extractedData) {
      const idVerification = extractedData.id_verification || extractedData.ID_Verification;
      const phoneData = extractedData.phone;
      
      if (idVerification) {
        // Extract name
        if (idVerification.first_name) updateData.first_name = idVerification.first_name;
        if (idVerification.last_name) updateData.last_name = idVerification.last_name;
        if (idVerification.full_name && !updateData.first_name) {
          const nameParts = idVerification.full_name.split(' ');
          updateData.first_name = nameParts[0];
          if (nameParts.length > 1) {
            updateData.last_name = nameParts.slice(1).join(' ');
          }
        }
        
        // Extract ID number - use document_number as primary source
        if (idVerification.document_number) {
          updateData.id_number = idVerification.document_number;
        } else if (idVerification.id_number) {
          updateData.id_number = idVerification.id_number;
        } else if (idVerification.personal_number) {
          updateData.id_number = idVerification.personal_number;
        }
        
        // Extract gender
        if (idVerification.gender || idVerification.sex) {
          updateData.gender = idVerification.gender || idVerification.sex;
        }
        
        // Extract date of birth
        if (idVerification.date_of_birth || idVerification.birth_date) {
          updateData.date_of_birth = idVerification.date_of_birth || idVerification.birth_date;
        }
        
        // Extract address information
        if (idVerification.address || idVerification.formatted_address) {
          updateData.address = idVerification.address || idVerification.formatted_address;
        }
        if (idVerification.parsed_address) {
          if (idVerification.parsed_address.street) updateData.address = idVerification.parsed_address.street;
          if (idVerification.parsed_address.city) updateData.city = idVerification.parsed_address.city;
          if (idVerification.parsed_address.postal_code) updateData.postal_code = idVerification.parsed_address.postal_code;
          if (idVerification.parsed_address.state) updateData.province = idVerification.parsed_address.state;
          if (idVerification.parsed_address.country) updateData.country = idVerification.parsed_address.country;
        }
        
        // Download and upload document images to Supabase Storage
        if (userId && normalizedStatus === 'approved') {
          console.log('🖼️ Processing KYC images for user:', userId);
          
          // Get the DIDIT image URLs (use cropped versions)
          const frontImageUrl = idVerification.front_image || idVerification.full_front_image;
          const backImageUrl = idVerification.back_image || idVerification.full_back_image;
          const selfieImageUrl = idVerification.portrait_image;
          
          // Download and upload images in parallel
          const [frontUrl, backUrl, selfieUrl] = await Promise.all([
            downloadAndUploadImage(frontImageUrl, userId, 'id_front'),
            downloadAndUploadImage(backImageUrl, userId, 'id_back'),
            downloadAndUploadImage(selfieImageUrl, userId, 'selfie')
          ]);
          
          // Use uploaded URLs if successful, otherwise keep DIDIT URLs as fallback
          updateData.id_front_image_url = frontUrl || frontImageUrl || null;
          updateData.id_back_image_url = backUrl || backImageUrl || null;
          updateData.selfie_image_url = selfieUrl || selfieImageUrl || null;
          
          console.log('✅ Image processing complete');
        } else {
          // If not approved or no userId, just store the DIDIT URLs
          if (idVerification.front_image) {
            updateData.id_front_image_url = idVerification.front_image;
          } else if (idVerification.full_front_image) {
            updateData.id_front_image_url = idVerification.full_front_image;
          }
          
          if (idVerification.back_image) {
            updateData.id_back_image_url = idVerification.back_image;
          } else if (idVerification.full_back_image) {
            updateData.id_back_image_url = idVerification.full_back_image;
          }
          
          if (idVerification.portrait_image) {
            updateData.selfie_image_url = idVerification.portrait_image;
          }
        }
      }
      
      // Extract phone number from phone verification data
      if (phoneData && phoneData.full_number) {
        updateData.phone_number = phoneData.full_number;
      }
      
      // Store full extracted data as JSON
      updateData.extracted_data = extractedData;
    }
    
    const { error } = await supabase
      .from('kyc_sessions')
      .update(updateData)
      .eq('session_id', session_id);
    
    if (error) {
      console.error('❌ Error updating KYC session in database:', error);
    } else {
      console.log(`✅ KYC session ${session_id} updated in DB`);
      console.log(`📊 Status: "${status}" (normalized: "${normalizedStatus}")`);
      if (updateData.first_name || updateData.last_name) {
        console.log(`👤 Extracted: ${updateData.first_name} ${updateData.last_name}, ID: ${updateData.id_number}`);
      }
      
      // Update profiles table with phone number if KYC is approved
      if (normalizedStatus === 'approved' && userId && updateData.phone_number) {
        console.log('📞 Updating profile with phone number from KYC...');
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ contact_number: updateData.phone_number })
          .eq('id', userId);
        
        if (profileError) {
          console.error('❌ Error updating profile phone number:', profileError);
        } else {
          console.log(`✅ Profile updated with phone number: ${updateData.phone_number}`);
        }
      }
    }
  } catch (dbError) {
    console.error('❌ Error updating KYC session:', dbError);
  }
}

async function getSessionStatus(sessionId) {
  const API_KEY = process.env.DIDIT_API_KEY;
  if (sessions.has(sessionId)) {
    const sessionData = sessions.get(sessionId);
    try {
      const response = await axios.get(
        `${BASE_URL}/v2/session/${sessionId}/decision/`,
        { headers: { 'X-Api-Key': API_KEY } }
      );
      return {
        success: true,
        session: sessionData,
        details: response.data
      };
    } catch (apiError) {
      return {
        success: true,
        session: sessionData
      };
    }
  }
  // If not in storage, try API
  const response = await axios.get(
    `${BASE_URL}/v2/session/${sessionId}/decision/`,
    { headers: { 'X-Api-Key': API_KEY } }
  );
  return {
    success: true,
    details: response.data
  };
}

function normalizeKycStatusValue(value) {
  return (value || '').toString().trim().toLowerCase();
}

function isVerifiedStatus(value) {
  const normalized = normalizeKycStatusValue(value);
  return [
    'approved',
    'verified',
    'completed',
    'complete',
    'success',
    'successful',
    'passed',
    'pass'
  ].includes(normalized);
}

function extractDecisionStatus(details = {}) {
  const candidates = [
    details?.status,
    details?.decision,
    details?.result,
    details?.verification_status,
    details?.session_status,
    details?.session?.status,
    details?.data?.status,
    details?.data?.decision,
    details?.decision_result,
    details?.outcome
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return '';
}

async function getUserKycStatus(userId) {
  // Check database first
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );
    
    // Get the most recently updated session (not created)
    const { data, error } = await supabase
      .from('kyc_sessions')
      .select('session_id, status, event_type, last_updated, created_at')
      .eq('user_id', userId)
      .order('last_updated', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!error && data) {
      console.log(`📋 KYC Status for user ${userId}:`, {
        status: data.status,
        statusType: typeof data.status,
        statusLength: data.status?.length,
        statusTrimmed: data.status?.trim(),
        rawData: data
      });
      
      const statusStr = (data.status || '').toString().trim();
      let isApproved = isVerifiedStatus(statusStr);
      let resolvedStatus = statusStr;

      if (!isApproved && data.session_id) {
        try {
          const decision = await getSessionStatus(data.session_id);
          const decisionStatus = extractDecisionStatus(decision?.details || {});
          if (decisionStatus) {
            resolvedStatus = decisionStatus;
            isApproved = isVerifiedStatus(decisionStatus);

            if (isApproved) {
              await supabase
                .from('kyc_sessions')
                .update({ status: decisionStatus, last_updated: new Date().toISOString() })
                .eq('session_id', data.session_id);
            }
          }
        } catch (decisionErr) {
          console.warn('Could not fetch live Didit decision status:', decisionErr?.message || decisionErr);
        }
      }
      
      console.log(`✅ Is Approved: ${isApproved}`);
      
      // Return normalized status for frontend
      const normalizedStatus = normalizeKycStatusValue(resolvedStatus);
      
      return {
        verified: isApproved,
        status: resolvedStatus,
        normalizedStatus: normalizedStatus, // Lowercase for easier comparison
        sessionId: data.session_id,
        updatedAt: data.last_updated || data.created_at,
        eventType: data.event_type
      };
    }
  } catch (dbError) {
    console.error('Error fetching KYC status from database:', dbError);
  }
  
  // Fall back to in-memory check
  const userSessions = Array.from(sessions.values())
    .filter(session => session.userId === userId);
  if (userSessions.length === 0) {
    return {
      verified: false,
      message: 'No KYC sessions found'
    };
  }
  const latestSession = userSessions.sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  )[0];
  return {
    verified: isVerifiedStatus(latestSession.status),
    status: latestSession.status,
    sessionId: latestSession.sessionId,
    updatedAt: latestSession.lastUpdated || latestSession.createdAt
  };
}

module.exports = {
  verifyWebhookSignature,
  createSession,
  updateSessionFromWebhook,
  getSessionStatus,
  getUserKycStatus,
  sessions
};
