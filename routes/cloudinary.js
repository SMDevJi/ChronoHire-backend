import express from 'express';
import { generateUploadSignature } from '../utils/cloudinary.js';
import authMiddleware from '../middleware/middleware.js';

const router = express.Router();

router.post('/generate-signature', authMiddleware, (req, res) => {
  let { field } = req.body
  let folder
  if (field == 'ProfilePic') {
    folder = 'ChronoHire/ProfilePics'
  }
  try {
    const data = generateUploadSignature(folder);
    return res.status(200).json({ success: true, signature: data })
  } catch (error) {
    console.error('Signature generation error:', error);
    return res.status(500).json({ success: false, message: "Error generating signature." })
  }
});

export default router;
