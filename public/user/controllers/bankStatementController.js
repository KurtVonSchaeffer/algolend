const path = require('path');
const { supabaseStorage, createAuthedClient } = require('../../../config/supabaseServer');

const DOCUMENTS_BUCKET = 'documents';

// Configuration
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];

// Validation helper functions
const validateFileType = (mimeType, originalName) => {
  const fileExtension = path.extname(originalName).toLowerCase();
  
  const isValidMime = ALLOWED_MIME_TYPES.includes(mimeType);
  const isValidExtension = ALLOWED_EXTENSIONS.includes(fileExtension);
  
  return isValidMime && isValidExtension;
};

const validateFileSize = (fileSize) => {
  return fileSize <= MAX_FILE_SIZE;
};

const sanitizeFilename = (originalName) => {
  // Remove any potentially dangerous characters
  return originalName
    .replace(/[^a-zA-Z0-9.-]/g, '')
    .substring(0, 255); // Limit filename length
};

exports.uploadBankStatement = async (req, res) => {
  try {
    console.log('📥 Bank statement upload endpoint hit');

    // Auth first — before touching file data
    const authHeader = req.headers.authorization;
    let userId = null;
    let authToken = null;
    let supabaseClient = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      authToken = authHeader.replace('Bearer ', '');
      try {
        supabaseClient = createAuthedClient(authToken);
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        if (!error && user) {
          userId = user.id;
          console.log('✅ Authenticated user:', userId);
        }
      } catch (authErr) {
        console.warn('⚠️ Auth token verification failed:', authErr.message);
      }
    }

    if (!userId || !authToken) {
      console.error('❌ Missing valid auth token');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Please log in to upload documents.'
      });
    }

    supabaseClient = supabaseClient || createAuthedClient(authToken);
    const applicationId = req.body.applicationId || null; // Optional from FormData
    const storageClient = supabaseStorage;

    // If an applicationId was supplied, verify the caller owns it
    if (applicationId) {
      const { data: appOwner, error: appErr } = await supabaseClient
        .from('loan_applications')
        .select('id')
        .eq('id', applicationId)
        .eq('user_id', userId)
        .maybeSingle();
      if (appErr || !appOwner) {
        return res.status(403).json({ error: 'Forbidden', message: 'Application not found or access denied.' });
      }
    }

    console.log('✅ Authenticated user:', userId, 'ApplicationId:', applicationId || 'none');

    // File validation (after auth so unauthenticated requests always get 401)
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.', message: 'Please select a file and try again.' });
    }
    const { originalname, mimetype, size, buffer } = req.file;
    if (!validateFileType(mimetype, originalname)) {
      return res.status(400).json({ error: 'Invalid file type.', message: 'Only JPG, PNG, and PDF files are allowed.' });
    }
    if (!validateFileSize(size)) {
      return res.status(400).json({ error: 'File too large.', message: `File size must not exceed 5MB. Your file is ${(size / 1024 / 1024).toFixed(2)}MB.` });
    }
    const sanitizedFilename = sanitizeFilename(originalname);
    console.log('🏦 File validated:', sanitizedFilename, `(${(size / 1024).toFixed(2)}KB)`);

    const timestamp = Date.now();
    const storagePath = `${userId}/bank-statements/${timestamp}_${sanitizedFilename}`;

    console.log('📤 Uploading bank statement to Supabase Storage:', storagePath);

    const { error: storageError } = await storageClient.storage
      .from(DOCUMENTS_BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimetype,
        cacheControl: '3600',
        upsert: false
      });

    if (storageError) {
      console.error('❌ Supabase Storage upload error:', storageError);
      return res.status(500).json({
        error: 'Upload failed.',
        message: storageError.message
      });
    }

    const { data: publicUrlData } = storageClient.storage
      .from(DOCUMENTS_BUCKET)
      .getPublicUrl(storagePath);

    const { data: documentData, error: dbError } = await supabaseClient
      .from('document_uploads')
      .insert({
        application_id: applicationId || null,
        user_id: userId,
        file_name: sanitizedFilename,
        original_name: originalname,
        file_path: publicUrlData.publicUrl,
        file_type: 'bank_statement',
        mime_type: mimetype,
        file_size: size,
        status: 'uploaded'
      })
      .select()
      .single();

    if (dbError) {
      console.error('❌ Database insert error:', dbError);
      await storageClient.storage.from(DOCUMENTS_BUCKET).remove([storagePath]).catch(() => {
        console.warn('⚠️ Failed to delete bank statement from storage after DB error');
      });
      return res.status(500).json({
        error: 'Database error',
        message: dbError.message
      });
    }
    
    console.log('✅ Bank statement metadata stored:', documentData.id);

    res.status(200).json({
      message: 'Bank statement uploaded successfully!',
      documentId: documentData.id,
      filename: sanitizedFilename,
      size,
      sizeFormatted: `${(size / 1024).toFixed(2)}KB`,
      mimeType: mimetype,
      path: publicUrlData.publicUrl,
      uploadedAt: documentData.uploaded_at || new Date().toISOString()
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'An unexpected error occurred during file upload. Please try again.' 
    });
  }
};