import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

const uploadsDir = path.join(__dirname, '../uploads'); // backend/uploads/ — same as static server
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      (cb as any)(new Error('Seules les images sont acceptées.'), false);
    }
  },
});

router.post('/', upload.single('image'), (req: any, res: any) => {
  if (!req.file) {
    res.status(400).json({ error: 'Aucune image reçue.' });
    return;
  }
  res.json({ url: `/uploads/${req.file.filename}` });
});

export default router;
