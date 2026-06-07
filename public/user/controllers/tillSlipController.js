const path = require('path');
const { supabase } = require('../../../config/supabaseServer');

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

    // TEMPORARY HARDCODE FOR TESTING
    let userId = '997d61b7-bb60-4bf0-b81b-2f1251611208';
    console.log('⚠️ USING HARDCODED userId FOR TESTING:', userId);
    
    // Get user ID - try token first, then query params, then FormData
    // let userId = null;
    // const authHeader = req.headers.authorization;
    
    // if (authHeader && authHeader.startsWith('Bearer ')) {
    //   const token = authHeader.replace('Bearer ', '');
    //   const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    //   
    //   if (user) {
    //     userId = user.id;
    //     console.log('✅ Authenticated via token:', userId);
    //   } else {
    //     console.warn('⚠️ Token verification failed:', authError?.message);
    //   }
    // }
    // 
    // // Fallback to query parameters
    // if (!userId) {
    //   userId = req.query.userId;
    //   if (userId) {
    //     console.log('✅ Using userId from query params:', userId);
    //   }
    // }
    // 
    // // Fallback to FormData
    // if (!userId) {
    //   userId = req.body.userId;
    //   if (userId) {
    //     console.log('✅ Using userId from FormData:', userId);
    //   }
    // }
    //
    // if (!userId) {
    //   console.error('❌ No userId found in token, query, or FormData');
    //   return res.status(401).json({
    //     error: 'Unauthorized',
    //     message: 'Please log in to upload documents.'
    //   });
    // }

    const applicationId = req.query.applicationId || req.body.applicationId || null;
    
    // TEMPORARY: Create a placeholder application_id if none provided (schema requires NOT NULL)
    // TODO: Fix schema to allow NULL application_id
    const tempApplicationId = applicationId || 1; // Use ID 1 as placeholder
    
    console.log('📋 Upload info:', { userId, applicationId: applicationId || 'none (using placeholder)' });

    // Create storage path: till-slips/{userId}/{timestamp}_{filename}
    const timestamp = Date.now();
    const storagePath = `${userId}/${timestamp}_${sanitizedFilename}`;
    
    console.log('📋 Upload info:', { userId, applicationId: applicationId || 'none' });

    console.log('📤 Uploading to Supabase Storage:', storagePath);

    // Create authenticated client if token available
    let uploadClient = supabase;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { createClient } = require('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
      uploadClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } }
      });
      console.log('✅ Using authenticated Supabase client for upload');
    }

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
    const { data: documentData, error: dbError } = await supabase
      .from('documents')
      .insert({
        application_id: tempApplicationId, // Using placeholder because schema requires NOT NULL
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
