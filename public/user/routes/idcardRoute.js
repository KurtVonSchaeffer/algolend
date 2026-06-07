const express = require('express');
const multer = require('multer');
const { uploadIdCard } = require('../controllers/idcardController');

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// For two files: filefront and fileback
router.post('/upload', upload.fields([
  { name: 'filefront', maxCount: 1 },
  { name: 'fileback', maxCount: 1 }
]), uploadIdCard);

module.exports = router;
