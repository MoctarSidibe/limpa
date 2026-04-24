import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'leboulanger_dev_secret_2024';
const hashPin = (pin: string) => crypto.createHash('sha256').update(pin).digest('hex');

// ---- Middleware : vérifie le token JWT sur les routes protégées ----
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentification requise.' });
    return;
  }
  try {
    const payload = jwt.verify(auth.split(' ')[1], JWT_SECRET) as any;
    (req as any).userId = payload.userId;
    (req as any).role = payload.role;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré. Reconnectez-vous.' });
  }
};

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, phone, pin, pushToken } = req.body;

    if (!phone || !pin || pin.length !== 4) {
      res.status(400).json({ error: 'Numéro de téléphone et PIN (4 chiffres) obligatoires.' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { phoneNumber: phone } });
    if (existing) {
      res.status(409).json({ error: 'Ce numéro est déjà associé à un compte.' });
      return;
    }

    const user = await prisma.user.create({
      data: {
        phoneNumber: phone,
        name: name || 'Client',
        pin: hashPin(pin),
        role: 'CLIENT',
        pushToken: pushToken || null,
        virtualCard: { create: { balance: 0, points: 0 } },
      },
    });

    const token = jwt.sign({ userId: user.id, role: user.role, bakeryId: user.bakeryId ?? null }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      message: 'Compte créé avec succès ! 🥐',
      userId: user.id,
      name: user.name,
      role: user.role,
      phone: user.phoneNumber,
      bakeryId: user.bakeryId ?? null,
      token,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de la création du compte.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { phone, pin, pushToken } = req.body;

    if (!phone || !pin) {
      res.status(400).json({ error: 'Numéro et PIN obligatoires.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { phoneNumber: phone } });

    if (!user || user.pin !== hashPin(pin)) {
      res.status(401).json({ error: 'Numéro ou PIN incorrect.' });
      return;
    }

    if (pushToken && user.pushToken !== pushToken) {
      await prisma.user.update({
        where: { id: user.id },
        data: { pushToken },
      });
    }

    const token = jwt.sign({ userId: user.id, role: user.role, bakeryId: user.bakeryId ?? null }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      userId: user.id,
      name: user.name || 'Client',
      role: user.role,
      phone: user.phoneNumber,
      bakeryId: user.bakeryId ?? null,
      token,
      message: `Bienvenue, ${user.name || 'cher client'} ! 👋`,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de la connexion.' });
  }
});

export default router;
