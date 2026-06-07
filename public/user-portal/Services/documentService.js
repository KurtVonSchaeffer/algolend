// Document Status Service
// Checks if documents are already uploaded by user (tracked by userId)

import { supabase } from '/Services/supabaseClient.js';

/**
 * Check if a specific document type exists for a user
 * @param {string} userId - The user ID (from Supabase auth)
 * @param {string} fileType - The document type (till_slip, bank_statement, id_card_front, id_card_back)
 * @returns {Promise<boolean>} - True if document exists
 */
export async function checkDocumentExistsByUser(userId, fileType) {
  try {
    const { data, error } = await supabase
      .from('document_uploads')
      .select('id, file_name, uploaded_at')
      .eq('user_id', userId)
      .eq('file_type', fileType)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') { // no rows
      console.error('Error checking document:', error);
      return false;
    }

    return !!data;
  } catch (err) {
    console.error('Error in checkDocumentExistsByUser:', err);
    return false;
  }
}

/**
 * Check if both ID card sides are uploaded by user
 * @param {string} userId - The user ID (from Supabase auth)
 * @returns {Promise<{front: boolean, back: boolean}>}
 */
export async function checkIdCardExistsByUser(userId) {
  try {
    const { data, error } = await supabase
      .from('document_uploads')
      .select('file_type')
      .eq('user_id', userId)
      .in('file_type', ['id_card_front', 'id_card_back']);

    if (error) {
      console.error('Error checking ID card:', error);
      return { front: false, back: false };
    }

    const front = data.some(doc => doc.file_type === 'id_card_front');
    const back = data.some(doc => doc.file_type === 'id_card_back');

    return { front, back };
  } catch (err) {
    console.error('Error in checkIdCardExistsByUser:', err);
    return { front: false, back: false };
  }
}

/**
 * Get document info for display (by user)
 * @param {string} userId - The user ID (from Supabase auth)
 * @param {string} fileType - The document type
 * @returns {Promise<object|null>}
 */
export async function getDocumentInfoByUser(userId, fileType) {
  try {
    const { data, error } = await supabase
      .from('document_uploads')
      .select('id, file_name, uploaded_at, status')
      .eq('user_id', userId)
      .eq('file_type', fileType)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return null;
    }

    return data;
  } catch (err) {
    return null;
  }
}

// Legacy functions (deprecated - use userId-based functions above)
export async function checkDocumentExists(applicationId, fileType) {
  try {
    const { data, error } = await supabase
      .from('document_uploads')
      .select('id, file_name, uploaded_at')
      .eq('application_id', applicationId)
      .eq('file_type', fileType)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking document:', error);
      return false;
    }

    return !!data;
  } catch (err) {
    console.error('Error in checkDocumentExists:', err);
    return false;
  }
}

export async function checkIdCardExists(applicationId) {
  try {
    const { data, error } = await supabase
      .from('document_uploads')
      .select('file_type')
      .eq('application_id', applicationId)
      .in('file_type', ['id_card_front', 'id_card_back']);

    if (error) {
      console.error('Error checking ID card:', error);
      return { front: false, back: false };
    }

    const front = data.some(doc => doc.file_type === 'id_card_front');
    const back = data.some(doc => doc.file_type === 'id_card_back');

    return { front, back };
  } catch (err) {
    console.error('Error in checkIdCardExistsByUser:', err);
    return { front: false, back: false };
  }
}

export async function getDocumentInfo(applicationId, fileType) {
  try {
    const { data, error } = await supabase
      .from('document_uploads')
      .select('id, file_name, uploaded_at, status')
      .eq('application_id', applicationId)
      .eq('file_type', fileType)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return null;
    }

    return data;
  } catch (err) {
    return null;
  }
}
