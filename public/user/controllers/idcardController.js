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

const validateFileSize = (fileSize) => fileSize <= MAX_FILE_SIZE;

const sanitizeFilename = (originalName) =>
	originalName.replace(/[^a-zA-Z0-9.-]/g, '').substring(0, 255);

exports.uploadIdCard = async (req, res) => {
	try {
		console.log('🪪 ID card upload endpoint hit');

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
					console.log('✅ User authenticated:', userId);
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
		const applicationId = req.body.applicationId || null;
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

		// File validation (after auth so unauthenticated requests always get 401)
		if (!req.files || !req.files.filefront || !req.files.fileback) {
			console.log('⚠️ Both front and back files are required');
			return res.status(400).json({
				error: 'Both front and back files are required.',
				message: 'Please select both front and back images of your ID card.'
			});
		}

		const front = req.files.filefront[0];
		const back = req.files.fileback[0];

		if (!validateFileType(front.mimetype, front.originalname) || !validateFileType(back.mimetype, back.originalname)) {
			return res.status(400).json({
				error: 'Invalid file type.',
				message: 'Only JPG, PNG, and PDF files are allowed for both sides.'
			});
		}

		if (!validateFileSize(front.size) || !validateFileSize(back.size)) {
			return res.status(400).json({
				error: 'File too large.',
				message: 'Each file must not exceed 5MB.'
			});
		}

		const timestamp = Date.now();
		const sanitizedFront = sanitizeFilename(front.originalname);
		const sanitizedBack = sanitizeFilename(back.originalname);
				const frontStoragePath = `${userId}/id-cards/${timestamp}_front_${sanitizedFront}`;
				const backStoragePath = `${userId}/id-cards/${timestamp}_back_${sanitizedBack}`;

				console.log('📤 Uploading ID front to Supabase Storage:', frontStoragePath);
				const { error: frontStorageError } = await storageClient.storage
					.from(DOCUMENTS_BUCKET)
					.upload(frontStoragePath, front.buffer, {
						contentType: front.mimetype,
						cacheControl: '3600',
						upsert: false
					});

				if (frontStorageError) {
					console.error('❌ Front storage upload failed:', frontStorageError);
					return res.status(500).json({
						error: 'Upload failed',
						message: frontStorageError.message
					});
				}

				console.log('📤 Uploading ID back to Supabase Storage:', backStoragePath);
				const { error: backStorageError } = await storageClient.storage
					.from(DOCUMENTS_BUCKET)
					.upload(backStoragePath, back.buffer, {
						contentType: back.mimetype,
						cacheControl: '3600',
						upsert: false
					});

				if (backStorageError) {
					console.error('❌ Back storage upload failed:', backStorageError);
					await storageClient.storage.from(DOCUMENTS_BUCKET).remove([frontStoragePath]);
					return res.status(500).json({
						error: 'Upload failed',
						message: backStorageError.message
					});
				}

				const { data: frontUrlData } = storageClient.storage
					.from(DOCUMENTS_BUCKET)
					.getPublicUrl(frontStoragePath);
				const { data: backUrlData } = storageClient.storage
					.from(DOCUMENTS_BUCKET)
					.getPublicUrl(backStoragePath);

		const { data: frontDocData, error: frontDbError } = await supabaseClient
			.from('document_uploads')
			.insert({
				application_id: applicationId,
				user_id: userId,
				file_name: sanitizedFront,
				original_name: front.originalname,
				file_path: frontUrlData.publicUrl,
				file_type: 'id_card_front',
				mime_type: front.mimetype,
				file_size: front.size,
				status: 'uploaded'
			})
			.select()
			.single();

		if (frontDbError) {
			console.error('❌ Front DB insert error:', frontDbError);
			await storageClient.storage.from(DOCUMENTS_BUCKET).remove([frontStoragePath, backStoragePath]).catch(() => {
				console.warn('⚠️ Failed to clean up ID storage objects after front DB error');
			});
			return res.status(500).json({
				error: 'Database error',
				message: frontDbError.message
			});
		}

		const { data: backDocData, error: backDbError } = await supabaseClient
			.from('document_uploads')
			.insert({
				application_id: applicationId,
				user_id: userId,
				file_name: sanitizedBack,
				original_name: back.originalname,
				file_path: backUrlData.publicUrl,
				file_type: 'id_card_back',
				mime_type: back.mimetype,
				file_size: back.size,
				status: 'uploaded'
			})
			.select()
			.single();

		if (backDbError) {
			console.error('❌ Back DB insert error:', backDbError);
			await storageClient.storage.from(DOCUMENTS_BUCKET).remove([frontStoragePath, backStoragePath]).catch(() => {
				console.warn('⚠️ Failed to clean up ID storage objects after back DB error');
			});
			await supabaseClient.from('document_uploads').delete().eq('id', frontDocData.id);
			return res.status(500).json({
				error: 'Database error',
				message: backDbError.message
			});
		}

		console.log('✅ Document records created:', frontDocData.id, backDocData.id);

		res.json({
			message: 'ID card uploaded successfully!',
			documents: {
				front: {
					documentId: frontDocData.id,
					filename: sanitizedFront,
					path: frontUrlData.publicUrl
				},
				back: {
					documentId: backDocData.id,
					filename: sanitizedBack,
					path: backUrlData.publicUrl
				}
			},
			uploadedAt: new Date().toISOString()
		});
	} catch (err) {
		console.error('❌ Error uploading ID card:', err);
		res.status(500).json({
			error: 'Server error.',
			message: 'An error occurred while uploading your ID card.'
		});
	}
};
