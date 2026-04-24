import 'dotenv/config'; // MUST be first — loads .env before any other module reads process.env

import express from 'express';
import cors from 'cors';
import path from 'path';
import paymentRoutes from './payment.controller';
import orderRoutes from './order.controller';
import authRoutes, { requireAuth } from './auth.controller';
import adminRoutes, { courierRouter } from './admin.controller';
import { bakerRouter } from './baker.controller';
import uploadRouter from './upload.controller';
import { prisma } from './prisma';
import { sendPushNotification } from './push';

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded product images as static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Request logger — shows every incoming request in the terminal
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ---- Routes ----
app.use('/api/auth', authRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/admin', requireAuth, adminRoutes);
app.use('/api/courier', requireAuth, courierRouter);
app.use('/api/baker', requireAuth, bakerRouter);
app.use('/api/upload', requireAuth, uploadRouter);

// ---- Products ----
// ?bakeryId=X → returns global products (bakeryId IS NULL) + bakery X's specialties
// no param    → returns global products only
app.get('/api/products', async (req, res) => {
  try {
    const bakeryId = req.query.bakeryId as string | undefined;
    const where: any = bakeryId
      ? { OR: [{ bakeryId: null }, { bakeryId }] }
      : { bakeryId: null };
    const products = await (prisma.product as any).findMany({
      where,
      orderBy: { name: 'asc' },
    });
    res.json({ products });
  } catch (e) {
    res.status(500).json({ error: 'Erreur lors de la récupération des produits.' });
  }
});

// ---- User wallet ----
app.get('/api/user/:userId/wallet', requireAuth, async (req, res) => {
  try {
    const userId = req.params.userId as string;
    const card = await prisma.virtualCard.findUnique({ where: { userId } });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { phoneNumber: true, name: true } });
    if (!card) { res.status(404).json({ error: 'Portefeuille introuvable.' }); return; }
    res.json({ balance: card.balance, points: card.points, phone: user?.phoneNumber });
  } catch (e) {
    res.status(500).json({ error: 'Erreur portefeuille.' });
  }
});

// ---- User activity (Transactions & Orders) ----
app.get('/api/user/:userId/activity', requireAuth, async (req, res) => {
  try {
    const userId = req.params.userId as string;
    
    // Fetch Top-ups
    const transactions = await prisma.transaction.findMany({
      where: { userId, status: 'SUCCESS' },
      select: { id: true, amount: true, provider: true, createdAt: true },
    });

    // Fetch Purchases
    const orders = await prisma.order.findMany({
      where: { userId },
      select: { id: true, pickupCode: true, total: true, createdAt: true },
    });

    // Merge and map
    const mappedTransactions = transactions.map(t => ({
      id: t.id,
      type: 'RECHARGE',
      provider: t.provider,
      title: `Rechargement via ${t.provider.replace('_', ' ')}`,
      amount: t.amount,
      isPositive: true,
      createdAt: t.createdAt,
    }));

    const mappedOrders = orders.map(o => ({
      id: o.id,
      type: 'ORDER',
      title: `Commande #${o.pickupCode}`,
      amount: o.total,
      isPositive: false,
      createdAt: o.createdAt,
    }));

    const activity = [...mappedTransactions, ...mappedOrders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ activity });
  } catch (e) {
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'activité.' });
  }
});

// ---- Redeem points → balance ----
app.post('/api/user/:userId/redeem-points', requireAuth, async (req, res) => {
  try {
    const userId = req.params.userId as string;
    const { points: pointsToRedeem } = req.body;

    if (!pointsToRedeem || pointsToRedeem < 100) {
      res.status(400).json({ error: 'Minimum 100 points requis pour échanger.' });
      return;
    }

    const card = await prisma.virtualCard.findUnique({ where: { userId } });
    if (!card) { res.status(404).json({ error: 'Portefeuille introuvable.' }); return; }
    if (card.points < pointsToRedeem) {
      res.status(400).json({ error: 'Points insuffisants.' });
      return;
    }

    const settings = await prisma.platformSettings.findFirst();
    const POINTS_TO_FCFA = settings?.pointsRedeemRate ?? 10;
    const gained = pointsToRedeem * POINTS_TO_FCFA;

    const updated = await prisma.virtualCard.update({
      where: { id: card.id },
      data: { balance: card.balance + gained, points: card.points - pointsToRedeem },
    });

    await prisma.transaction.create({
      data: { userId, amount: gained, provider: 'POINTS', status: 'SUCCESS', reference: `pts_${userId}_${Date.now()}` },
    });

    res.json({ message: `${pointsToRedeem} points convertis en ${gained} FCFA !`, balance: updated.balance, points: updated.points, gained });
  } catch (e) {
    res.status(500).json({ error: 'Erreur lors de la conversion de points.' });
  }
});

// ---- User order history ----
app.get('/api/user/:userId/orders', requireAuth, async (req, res) => {
  try {
    const userId = req.params.userId as string;
    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        bakery: { select: { name: true, address: true } },
        items: { include: { product: { select: { name: true, price: true } } } },
      },
    });
    // Expose discount and couponCode on each order
    const enriched = orders.map(o => ({ ...o, discount: (o as any).discount ?? 0, couponCode: (o as any).couponCode ?? null }));
    res.json({ orders: enriched });
  } catch (e) {
    res.status(500).json({ error: 'Erreur lors de la récupération des commandes.' });
  }
});


// ---- Cancel recurring subscription ----
app.delete('/api/order/:id/recurrence', requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: 'Commande introuvable.' }) as any;
    if (order.userId !== (req as any).userId) return res.status(403).json({ error: 'Accès refusé.' }) as any;
    await prisma.order.update({
      where: { id },
      data: { recurrence: 'NONE', nextRecurrenceAt: null } as any,
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur lors de l\'annulation de l\'abonnement.' });
  }
});

// ---- Seeding ----

const SEED_BAKERIES = [
  {
    name: 'La Mie Câline - Libreville Centre',
    address: 'Boulevard Triomphal Omar Bongo, Centre-Ville, Libreville',
    latitude: 0.4180,  // ~0.2 km from fallback GPS → always nearest, no surcharge
    longitude: 9.4680,
  },
  {
    name: 'Pâtisserie Le Cocotier',
    address: 'Rue des Cocotiers, Quartier Louis, Libreville',
    latitude: 0.4500,  // ~6.5 km from fallback → +~1 900 FCFA surcharge
    longitude: 9.4200,
  },
  {
    name: 'La Mie Câline - Akanda',
    address: 'Route d\'Angondjé, Carrefour Akanda, Libreville Nord',
    latitude: 0.5052,  // ~10 km from fallback → +~2 900 FCFA surcharge
    longitude: 9.4893,
  },
];

const seedData = async () => {
  // Bakeries — create if none exist, then always sync coordinates/addresses
  const bakeryCount = await prisma.bakery.count();
  if (bakeryCount === 0) {
    await prisma.bakery.createMany({ data: SEED_BAKERIES });
    console.log('[SEED] 3 boulangeries créées.');
  } else {
    // Keep coords and addresses in sync with seed definitions (fix stale dev data)
    for (const b of SEED_BAKERIES) {
      await prisma.bakery.updateMany({
        where: { name: b.name },
        data: { address: b.address, latitude: b.latitude, longitude: b.longitude },
      });
    }
    console.log('[SEED] Coordonnées boulangeries mises à jour.');
  }

  // Products
  const productCount = await prisma.product.count();
  if (productCount === 0) {
    await prisma.product.createMany({
      data: [
        { name: 'Croissant au beurre', price: 700, description: "L'incontournable croissant frais et croustillant fait maison chaque matin.", image: 'croissant', category: 'viennoiserie' },
        { name: 'Baguette Tradition', price: 500, description: 'Pain à la farine de blé sélectionné, croûte craquante.', image: 'baguette', category: 'pain' },
        { name: 'Pain de Campagne', price: 1500, description: 'Pain au levain naturel, croûte épaisse, parfait pour vos repas en famille.', image: 'bread', category: 'pain' },
        { name: 'Éclair au Chocolat', price: 900, description: 'Pâte à choux légère garnie de crème pâtissière au chocolat noir.', image: 'eclair', category: 'patisserie' },
        { name: 'Tarte aux Fraises', price: 2000, description: 'Tarte sablée aux fraises fraiches du marché avec crème pâtissière.', image: 'tarte', category: 'patisserie' },
        { name: 'Palmier Feuilleté', price: 400, description: 'Biscuit feuilleté au sucre caramélisé, croquant et léger.', image: 'palmier', category: 'viennoiserie' },
        { name: 'Pain au Chocolat', price: 750, description: 'Viennoiserie feuilletée avec deux barres de chocolat noir au cœur.', image: 'croissant', category: 'viennoiserie' },
        { name: 'Mille-feuille', price: 1800, description: 'Alternance de feuilletages croustillants et de crème pâtissière vanillée.', image: 'tarte', category: 'patisserie' },
      ],
    });
    console.log('[SEED] 8 produits créés.');
  }

  // Platform settings — create once if absent
  const settingsCount = await prisma.platformSettings.count();
  if (settingsCount === 0) {
    await prisma.platformSettings.create({
      data: { feePerKm: 300, roundingUnit: 25, minFee: 0, alertPendingMinutes: 15, alertConfirmedMinutes: 45, alertPickedUpMinutes: 90, pointsEarnRate: 1, pointsRedeemRate: 10 },
    });
    console.log('[SEED] Paramètres plateforme créés (300 FCFA/km, arrondi 25F).');
  }
};

// ---- Recurring orders processor (runs every hour) ----
const processRecurringOrders = async () => {
  try {
    const now = new Date();
    const due = await prisma.order.findMany({
      where: { recurrence: { in: ['DAILY', 'WEEKLY'] }, nextRecurrenceAt: { lte: now } },
      include: { items: true },
    });

    for (const original of due) {
      const card = await prisma.virtualCard.findUnique({ where: { userId: original.userId } });
      if (!card || card.balance < original.total) {
        // Not enough balance — notify user and skip
        const user = await prisma.user.findUnique({ where: { id: original.userId }, select: { pushToken: true } });
        if (user?.pushToken) {
          await sendPushNotification(
            user.pushToken,
            '⚠️ Renouvellement impossible',
            `Solde insuffisant pour renouveler votre commande quotidienne. Rechargez votre portefeuille.`,
            { type: 'RECURRENCE_FAILED', orderId: original.id },
          );
        }
        continue;
      }

      const pickupCode = Math.random().toString(36).substring(2, 5).toUpperCase() + '-' + String(Math.floor(Math.random() * 900) + 100);
      const nextAt = original.recurrence === 'DAILY'
        ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
        : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      let newOrderId: string | undefined;
      await prisma.$transaction(async (tx) => {
        const newOrder = await tx.order.create({
          data: {
            userId: original.userId,
            bakeryId: original.bakeryId,
            total: original.total,
            status: 'PENDING',
            deliveryType: original.deliveryType,
            recurrence: original.recurrence,
            address: original.address,
            pickupCode,
            latitude: original.latitude,
            longitude: original.longitude,
            extraFee: original.extraFee,
            nextRecurrenceAt: nextAt,
          },
        });
        newOrderId = newOrder.id;
        await tx.orderItem.createMany({
          data: original.items.map(i => ({ orderId: newOrder.id, productId: i.productId, quantity: i.quantity })),
        });
        await tx.virtualCard.update({ where: { id: card.id }, data: { balance: card.balance - original.total } });
        await tx.order.update({ where: { id: original.id }, data: { nextRecurrenceAt: null } as any });
      });

      // Notify user of successful renewal
      const user = await prisma.user.findUnique({ where: { id: original.userId }, select: { pushToken: true } });
      if (user?.pushToken) {
        const totalStr = original.total.toLocaleString('fr-FR');
        await sendPushNotification(
          user.pushToken,
          '🥐 Renouvellement quotidien',
          `Votre commande a été renouvelée et ${totalStr} FCFA débités. Code : ${pickupCode}`,
          { type: 'RECURRENCE_RENEWED', orderId: newOrderId },
        );
      }

      console.log(`[RECURRENCE] Commande récurrente créée pour user ${original.userId} → ${pickupCode}`);
    }
  } catch (e) {
    console.error('[RECURRENCE] Erreur:', e);
  }
};

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  await seedData();
  setInterval(processRecurringOrders, 60 * 60 * 1000); // every hour
  console.log(`✅ Serveur Limpa démarré sur http://localhost:${PORT}`);
});
