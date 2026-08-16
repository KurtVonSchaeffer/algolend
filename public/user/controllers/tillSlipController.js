const path = require('path');
const { supabase, createAuthedClient } = require('../../../config/supabaseServer');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];

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

const uploadTillSlip = async (req, res) => {
  try {
    console.log('📥 Till slip upload endpoint hit');

    // Auth first — before touching file data
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please log in to upload documents.' });
    }
    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createAuthedClient(token);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please log in to upload documents.' });
    }
    const userId = user.id;
    console.log('✅ Authenticated via token:', userId);

    const applicationId = req.query.applicationId || req.body.applicationId || null;
    if (!applicationId) {
      return res.status(400).json({ error: 'applicationId is required' });
    }

    // Verify the caller owns this application
    const { data: appOwner, error: appErr } = await supabaseClient
      .from('loan_applications')
      .select('id')
      .eq('id', applicationId)
      .eq('user_id', userId)
      .maybeSingle();
    if (appErr || !appOwner) {
      return res.status(403).json({ error: 'Forbidden', message: 'Application not found or access denied.' });
    }

    // Check if file exists
    if (!req.file) {
      console.log('⚠ No file received in request');
      return res.status(400).json({
        error: 'No file uploaded.',
        message: 'Please select a file and try again.'
      });
    }

    const { originalname, mimetype, size, buffer } = req.file;

    // Validate file type
    if (!validateFileType(mimetype, originalname)) {
      console.log('⚠ Invalid file type:', mimetype, originalname);
      return res.status(400).json({
        error: 'Invalid file type.',
        message: 'Only JPG, PNG, and PDF files are allowed.'
      });
    }

    // Validate file size
    if (!validateFileSize(size)) {
      console.log('⚠ File size exceeds limit:', size);
      return res.status(400).json({
        error: 'File too large.',
        message: `File size must not exceed 5MB. Your file is ${(size / 1024 / 1024).toFixed(2)}MB.`
      });
    }

    // Sanitize filename
    const sanitizedFilename = sanitizeFilename(originalname);
    console.log('🧾 File validated:', sanitizedFilename, `(${(size / 1024).toFixed(2)}KB)`);

    console.log('📋 Upload info:', { userId, applicationId });

    // Create storage path: till-slips/{userId}/{timestamp}_{filename}
    const timestamp = Date.now();
    const storagePath = `${userId}/${timestamp}_${sanitizedFilename}`;
    

    console.log('📤 Uploading to Supabase Storage:', storagePath);

    const uploadClient = supabaseClient;
    console.log('✅ Using authenticated Supabase client for upload');

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await uploadClient.storage
      .from('documents')
      .upload(storagePath, buffer, {
        contentType: mimetype,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Supabase upload error:', uploadError);
      return res.status(500).json({
        error: 'Upload failed',
        message: uploadError.message
      });
    }

    console.log('✅ File uploaded to storage:', uploadData.path);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    // Insert record into documents table (tracked by userId)
    const { data: documentData, error: dbError } = await uploadClient
      .from('documents')
      .insert({
        application_id: applicationId,
        uploaded_by: userId,
        file_name: sanitizedFilename,
        storage_path: storagePath,
        file_type: 'till_slip',
        status: 'unverified'
      })
      .select()
      .single();

    if (dbError) {
      console.error('❌ Database insert error:', dbError);
      // Try to clean up uploaded file
      await supabase.storage.from('documents').remove([storagePath]);
      return res.status(500).json({
        error: 'Database error',
        message: dbError.message
      });
    }
    
    console.log('✅ Document record created:', documentData.id);

    res.status(200).json({
      message: 'Till slip uploaded successfully!',
      documentId: documentData.id,
      filename: sanitizedFilename,
      size: size,
      sizeFormatted: `${(size / 1024).toFixed(2)}KB`,
      mimeType: mimetype,
      url: publicUrl,
      storagePath: storagePath,
      uploadedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'An unexpected error occurred during file upload. Please try again.' 
    });
  }
};

module.exports = {
  uploadTillSlip
};
