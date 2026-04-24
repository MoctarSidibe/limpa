import { Router } from 'express';
import { prisma } from './prisma';

export const bakerRouter = Router();

// Ensure the caller is a BAKER/BOULANGER with a bakeryId
const requireBaker = async (req: any, res: any, next: any) => {
  try {
    const role: string = req.role ?? '';
    if (role !== 'BAKER' && role !== 'BOULANGER') {
      res.status(403).json({ error: 'Accès réservé aux boulangers.' });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { bakeryId: true },
    });
    if (!user?.bakeryId) {
      res.status(403).json({ error: "Compte non associé à une boulangerie. Contactez l'admin." });
      return;
    }
    req.bakeryId = user.bakeryId;
    next();
  } catch {
    res.status(500).json({ error: 'Erreur d\'authentification.' });
  }
};

// GET /api/baker/products — list this bakery's specialty products
bakerRouter.get('/products', requireBaker, async (req: any, res: any) => {
  try {
    const products = await (prisma.product as any).findMany({
      where: { bakeryId: req.bakeryId },
      orderBy: { name: 'asc' },
    });
    res.json({ products });
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// POST /api/baker/products — create a specialty product
bakerRouter.post('/products', requireBaker, async (req: any, res: any) => {
  try {
    const { name, price, description, image, category } = req.body;
    if (!name || price == null) {
      res.status(400).json({ error: 'Nom et prix requis.' });
      return;
    }
    const parsed = parseFloat(price);
    if (isNaN(parsed) || parsed <= 0) {
      res.status(400).json({ error: 'Prix invalide.' });
      return;
    }
    const product = await (prisma.product as any).create({
      data: {
        name: String(name).trim(),
        price: parsed,
        description: description ? String(description).trim() : null,
        image: image ? String(image).trim() : null,
        category: category ? String(category).trim() : null,
        bakeryId: req.bakeryId,
      },
    });
    res.json({ product });
  } catch {
    res.status(500).json({ error: 'Erreur lors de la création.' });
  }
});

// PUT /api/baker/products/:id — update a specialty (must belong to this bakery)
bakerRouter.put('/products/:id', requireBaker, async (req: any, res: any) => {
  try {
    const id = req.params.id as string;
    const existing = await (prisma.product as any).findUnique({ where: { id } });
    if (!existing || existing.bakeryId !== req.bakeryId) {
      res.status(403).json({ error: 'Produit introuvable ou non autorisé.' });
      return;
    }
    const { name, price, description, image, category } = req.body;
    const data: any = {};
    if (name)             data.name        = String(name).trim();
    if (price != null)    data.price       = parseFloat(price);
    if (description !== undefined) data.description = description ? String(description).trim() : null;
    if (image !== undefined)       data.image       = image ? String(image).trim() : null;
    if (category !== undefined)    data.category    = category ? String(category).trim() : null;

    const updated = await prisma.product.update({ where: { id }, data });
    res.json({ product: updated });
  } catch {
    res.status(500).json({ error: 'Erreur lors de la mise à jour.' });
  }
});

// DELETE /api/baker/products/:id — remove a specialty (must belong to this bakery)
bakerRouter.delete('/products/:id', requireBaker, async (req: any, res: any) => {
  try {
    const id = req.params.id as string;
    const existing = await (prisma.product as any).findUnique({ where: { id } });
    if (!existing || existing.bakeryId !== req.bakeryId) {
      res.status(403).json({ error: 'Produit introuvable ou non autorisé.' });
      return;
    }
    await prisma.product.delete({ where: { id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erreur lors de la suppression.' });
  }
});
