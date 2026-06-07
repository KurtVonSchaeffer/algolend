const { supabaseStorage, createAuthedClient } = require('../../../config/supabaseServer');

const DOCUMENTS_BUCKET = 'documents';

const uploadTillSlip = async (req, res) => {
  try {
    console.log('📥 Till slip upload endpoint hit');

    // Check if file was uploaded
    if (!req.file) {
      console.error('❌ No file uploaded');
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please select a till slip to upload.'
      });
    }

    const { buffer, originalname, mimetype, size } = req.file;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(mimetype)) {
      console.error('❌ Invalid file type:', mimetype);
      return res.status(400).json({
        error: 'Invalid file type',
        message: 'Only JPG, PNG, and PDF files are allowed.'
      });
    }

    console.log(`🧾 File validated: ${originalname} (${(size / 1024).toFixed(2)}KB)`);

    // Get user ID from session (optional - can be null)
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
          console.log('✅ User authenticated:', userId);
        }
      } catch (error) {
        console.warn('⚠️ Auth token verification failed:', error.message);
      }
    }

    if (!userId || !authToken) {
      console.error('❌ Missing valid auth token for till slip upload');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Please log in again before uploading your till slip.'
      });
    }

    supabaseClient = supabaseClient || createAuthedClient(authToken);
    const storageClient = supabaseStorage;

    // Sanitize filename
    const sanitizedFilename = originalname.replace(/[^a-zA-Z0-9.-]/g, '_');

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const storagePath = `${userId}/till-slips/${timestamp}_${sanitizedFilename}`;

    console.log('📤 Uploading till slip to Supabase Storage:', storagePath);

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
        error: 'Upload failed',
        message: storageError.message
      });
    }

    const { data: publicUrlData } = storageClient.storage
      .from(DOCUMENTS_BUCKET)
      .getPublicUrl(storagePath);

    // Save metadata to database
    const { data: dbData, error: dbError } = await supabaseClient
      .from('document_uploads')
      .insert({
        file_name: sanitizedFilename,
        original_name: originalname,
        file_path: publicUrlData.publicUrl,
        file_type: 'till_slip',
        mime_type: mimetype,
        file_size: size,
        user_id: userId,
        status: 'uploaded'
      })
      .select()
      .single();

    if (dbError) {
      console.error('❌ Database insert error:', dbError);
      await storageClient.storage.from(DOCUMENTS_BUCKET).remove([storagePath]).catch(() => {
        console.warn('⚠️ Failed to remove storage object after DB error');
      });
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to record till slip upload. Please try again.'
      });
    }

    console.log('✅ Document metadata saved to database:', dbData.id);

    res.json({
      message: 'Till slip uploaded successfully',
      filename: sanitizedFilename,
      path: publicUrlData.publicUrl,
      documentId: dbData.id,
      uploadedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Unexpected error in uploadTillSlip:', error);
    res.status(500).json({
      error: 'Server error',
      message: error.message
    });
  }
};

module.exports = { uploadTillSlip };
