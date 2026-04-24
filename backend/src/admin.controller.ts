import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from './prisma';
import { Role } from '@prisma/client';
import { sendPushNotification } from './push';

const router = Router();
export const courierRouter = Router();

const hashPin = (pin: string) => crypto.createHash('sha256').update(pin).digest('hex');

// ══════════════════════════════════════════════════════════════════
// ADMIN ROUTES  (mounted at /api/admin)
// ══════════════════════════════════════════════════════════════════

// ---- Pending orders for a bakery ----
router.get('/orders/pending', async (req: Request, res: Response) => {
  try {
    const bakeryId = Array.isArray(req.query.bakeryId) ? req.query.bakeryId[0] : req.query.bakeryId;
    const where: any = { status: { in: ['PENDING', 'CONFIRMED', 'READY', 'PICKED_UP'] } };
    if (bakeryId) where.bakeryId = bakeryId;

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, phoneNumber: true } },
        items: { include: { product: { select: { name: true, price: true } } } },
        bakery: { select: { name: true } },
        courier: { select: { id: true, name: true, phoneNumber: true } },
      },
    });

    const formatted = orders.map((o: any) => ({
      id: o.id,
      pickupCode: o.pickupCode,
      total: o.total,
      status: o.status,
      deliveryType: o.deliveryType,
      recurrence: o.recurrence,
      scheduledFor: o.scheduledFor,
      address: o.address,
      extraFee: o.extraFee,
      customerName: o.recipientName || o.user.name,
      customerPhone: o.recipientPhone || o.user.phoneNumber,
      bakeryName: o.bakery?.name ?? null,
      bakeryId: o.bakeryId,
      courierId: o.courierId,
      courierName: o.courier?.name ?? null,
      items: o.items.map((i: any) => ({ name: i.product.name, quantity: i.quantity, price: i.product.price })),
      createdAt: o.createdAt,
      nudgedAt: o.nudgedAt ?? null,
    }));

    res.json({ orders: formatted });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de la récupération des commandes.' });
  }
});

// ---- All orders with filters ----
router.get('/orders', async (req: Request, res: Response) => {
  try {
    const { status, bakeryId, date, search } = req.query as Record<string, string | undefined>;
    const where: any = {};

    if (status) where.status = status;
    if (bakeryId) where.bakeryId = bakeryId;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.createdAt = { gte: start, lte: end };
    }
    if (search) {
      where.OR = [
        { pickupCode: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { recipientName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { name: true, phoneNumber: true } },
        items: { include: { product: { select: { name: true, price: true } } } },
        bakery: { select: { name: true } },
        courier: { select: { id: true, name: true, phoneNumber: true } },
      },
    });

    const formatted = orders.map((o: any) => ({
      id: o.id,
      pickupCode: o.pickupCode,
      total: o.total,
      status: o.status,
      deliveryType: o.deliveryType,
      recurrence: o.recurrence,
      scheduledFor: o.scheduledFor,
      address: o.address,
      extraFee: o.extraFee,
      customerName: o.recipientName || o.user.name,
      customerPhone: o.recipientPhone || o.user.phoneNumber,
      bakeryName: o.bakery?.name ?? null,
      bakeryId: o.bakeryId,
      courierId: o.courierId,
      courierName: o.courier?.name ?? null,
      items: o.items.map((i: any) => ({ name: i.product.name, quantity: i.quantity, price: i.product.price })),
      createdAt: o.createdAt,
    }));

    res.json({ orders: formatted });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de la récupération des commandes.' });
  }
});

// ---- Assign courier to a delivery order ----
router.put('/orders/:id/assign-courier', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { courierId } = req.body;

    if (!courierId) {
      res.status(400).json({ error: 'courierId requis.' });
      return;
    }

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) { res.status(404).json({ error: 'Commande introuvable.' }); return; }
    if (!order.deliveryType.includes('DELIVERY')) {
      res.status(400).json({ error: 'Cette commande n\'est pas une livraison.' });
      return;
    }

    const courier = await prisma.user.findUnique({ where: { id: courierId } });
    if (!courier || !['COURIER', 'LIVREUR'].includes(courier.role)) {
      res.status(400).json({ error: 'Livreur introuvable ou rôle invalide.' });
      return;
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { courierId } as any,
    });

    // Notify courier via push
    if (courier.pushToken) {
      sendPushNotification(courier.pushToken, 'Nouvelle livraison assignée', `Commande #${updated.pickupCode} vous a été assignée.`);
    }

    console.log(`[ADMIN] Commande ${updated.pickupCode} assignée au livreur ${courier.name}`);
    res.json({ message: 'Livreur assigné.', orderId: id, courierId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de l\'assignation.' });
  }
});

// ---- Platform settings ----
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const s = await prisma.platformSettings.findFirst();
    res.json({ settings: s ?? { feePerKm: 300, roundingUnit: 25, minFee: 0, alertPendingMinutes: 15, alertConfirmedMinutes: 45, alertPickedUpMinutes: 90 } });
  } catch (e) {
    res.status(500).json({ error: 'Erreur paramètres.' });
  }
});

router.put('/settings', async (req: Request, res: Response) => {
  try {
    const { feePerKm, roundingUnit, minFee, alertPendingMinutes, alertConfirmedMinutes, alertPickedUpMinutes, pointsEarnRate, pointsRedeemRate } = req.body;
    const data: any = {};
    if (feePerKm !== undefined)              data.feePerKm = parseFloat(feePerKm);
    if (roundingUnit !== undefined)          data.roundingUnit = parseInt(roundingUnit);
    if (minFee !== undefined)                data.minFee = parseInt(minFee);
    if (alertPendingMinutes !== undefined)   data.alertPendingMinutes = parseInt(alertPendingMinutes);
    if (alertConfirmedMinutes !== undefined) data.alertConfirmedMinutes = parseInt(alertConfirmedMinutes);
    if (alertPickedUpMinutes !== undefined)  data.alertPickedUpMinutes = parseInt(alertPickedUpMinutes);
    if (pointsEarnRate !== undefined)        data.pointsEarnRate = parseInt(pointsEarnRate);
    if (pointsRedeemRate !== undefined)      data.pointsRedeemRate = parseInt(pointsRedeemRate);
    if ((req as any).userId) data.updatedBy = (req as any).userId;

    const existing = await prisma.platformSettings.findFirst();
    const settings = existing
      ? await prisma.platformSettings.update({ where: { id: existing.id }, data })
      : await prisma.platformSettings.create({ data: { feePerKm: 300, roundingUnit: 25, minFee: 0, alertPendingMinutes: 15, alertConfirmedMinutes: 45, alertPickedUpMinutes: 90, pointsEarnRate: 1, pointsRedeemRate: 10, ...data } });

    res.json({ settings });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur mise à jour paramètres.' });
  }
});

// ---- Order alerts (multi-type) ----
router.get('/order-alerts', async (req: Request, res: Response) => {
  try {
    const s = await prisma.platformSettings.findFirst();
    const pendingMin   = s?.alertPendingMinutes   ?? 15;
    const confirmedMin = s?.alertConfirmedMinutes ?? 45;
    const pickedUpMin  = s?.alertPickedUpMinutes  ?? 90;
    const noLivreurMin = 5; // fixed: delivery with no courier after 5 min

    const now = Date.now();
    const include = { user: { select: { name: true } }, bakery: { select: { name: true } } };

    const [pendingOrders, confirmedOrders, noLivreurOrders, pickedUpOrders] = await Promise.all([
      prisma.order.findMany({
        where: { status: 'PENDING', createdAt: { lte: new Date(now - pendingMin * 60000) } },
        orderBy: { createdAt: 'asc' }, include,
      }),
      prisma.order.findMany({
        where: { status: 'CONFIRMED', createdAt: { lte: new Date(now - confirmedMin * 60000) } },
        orderBy: { createdAt: 'asc' }, include,
      }),
      prisma.order.findMany({
        where: { status: 'CONFIRMED', deliveryType: { in: ['DELIVERY', 'DELIVERY_SCHEDULED'] }, courierId: null, createdAt: { lte: new Date(now - noLivreurMin * 60000) } },
        orderBy: { createdAt: 'asc' }, include,
      }),
      prisma.order.findMany({
        where: { status: 'PICKED_UP', createdAt: { lte: new Date(now - pickedUpMin * 60000) } },
        orderBy: { createdAt: 'asc' }, include,
      }),
    ]);

    const toAlert = (o: any) => ({
      id: o.id, pickupCode: o.pickupCode, total: o.total,
      address: o.address ?? 'Non précisée',
      customerName: o.user?.name ?? 'Client',
      bakeryName: o.bakery?.name ?? null,
      createdAt: o.createdAt,
      waitingMinutes: Math.round((now - new Date(o.createdAt).getTime()) / 60000),
    });

    res.json({
      pendingAlerts:   pendingOrders.map(toAlert),
      confirmedAlerts: confirmedOrders.map(toAlert),
      noLivreurAlerts: noLivreurOrders.map(toAlert),
      pickedUpAlerts:  pickedUpOrders.map(toAlert),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur alertes commandes.' });
  }
});

// ---- Notify relevant party for an alert ----
// alertType: PENDING | CONFIRMED → push to bakers of the bakery
//            PICKED_UP           → push to the assigned courier
//            NO_LIVREUR          → (no one to push; returns 204)
router.post('/orders/:id/notify', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const alertType: string = req.body.alertType ?? '';

    const order = await prisma.order.findUnique({
      where: { id },
      include: { courier: { select: { pushToken: true, name: true } } },
    });
    if (!order) { res.status(404).json({ error: 'Commande introuvable.' }); return; }

    // Always stamp nudgedAt so baker's app can show an in-app alert on next poll
    await prisma.order.update({ where: { id }, data: { nudgedAt: new Date() } as any });

    if (alertType === 'PICKED_UP') {
      const courier = (order as any).courier;
      if (courier?.pushToken) {
        await sendPushNotification(
          courier.pushToken,
          '⚠️ Livraison en retard',
          `La commande #${order.pickupCode} n'a toujours pas été livrée. Merci de finaliser la livraison.`,
          { type: 'ALERT_PICKED_UP', orderId: id },
        );
      }
      res.json({ sent: true, target: 'courier' });
      return;
    }

    if (alertType === 'PENDING' || alertType === 'CONFIRMED') {
      if (!order.bakeryId) { res.json({ sent: false, reason: 'Pas de boulangerie assignée.' }); return; }
      const bakers = await prisma.user.findMany({
        where: { bakeryId: order.bakeryId, role: { in: ['BAKER', 'BOULANGER'] as any }, pushToken: { not: null } },
        select: { pushToken: true, name: true },
      });
      const title = alertType === 'PENDING' ? '⏰ Commande en attente' : '⏰ Commande non préparée';
      const body  = alertType === 'PENDING'
        ? `La commande #${order.pickupCode} attend votre confirmation depuis plus de ${Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000)} min.`
        : `La commande #${order.pickupCode} est confirmée mais non préparée depuis plus de ${Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000)} min.`;
      await Promise.all(bakers.map(b => sendPushNotification(b.pushToken, title, body, { type: `ALERT_${alertType}`, orderId: id })));
      res.json({ sent: true, target: 'bakers', count: bakers.length });
      return;
    }

    // NO_LIVREUR — no push target yet
    res.json({ sent: false, reason: 'Aucune cible push pour ce type.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de l\'envoi de la notification.' });
  }
});

// ---- Delivery alerts — kept for backward compat ----
router.get('/delivery-alerts', async (req: Request, res: Response) => {
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const orders = await prisma.order.findMany({
      where: { status: 'CONFIRMED', deliveryType: { in: ['DELIVERY', 'DELIVERY_SCHEDULED'] }, courierId: null, createdAt: { lte: fiveMinAgo } },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { name: true } }, bakery: { select: { name: true } } },
    });
    const alerts = orders.map(o => ({
      id: o.id, pickupCode: o.pickupCode, total: o.total,
      address: o.address ?? 'Non précisée',
      customerName: o.user.name ?? 'Client', bakeryName: o.bakery?.name ?? null,
      createdAt: o.createdAt,
      waitingMinutes: Math.round((Date.now() - new Date(o.createdAt).getTime()) / 60000),
    }));
    res.json({ alerts });
  } catch (e) {
    res.status(500).json({ error: 'Erreur alertes livraison.' });
  }
});

// ---- Dashboard stats ----
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const bakeryId = req.query.bakeryId as string | undefined;
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);

    const where: any = { createdAt: { gte: startOfDay } };
    if (bakeryId) where.bakeryId = bakeryId;

    const [ordersToday, pending, revenue, topRaw, totalCustomers, totalBakeries, newCustomersToday, totalBakers, totalCouriers, activeCouriers] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.count({ where: { ...where, status: { in: ['PENDING', 'CONFIRMED'] } } }),
      prisma.order.aggregate({ where: { ...where, status: { in: ['CONFIRMED', 'DELIVERED'] } }, _sum: { total: true } }),
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: { createdAt: { gte: startOfDay }, ...(bakeryId ? { bakeryId } : {}) } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 3,
      }),
      prisma.user.count({ where: { role: Role.CLIENT } }),
      prisma.bakery.count(),
      prisma.user.count({ where: { role: Role.CLIENT, createdAt: { gte: startOfDay } } }),
      prisma.user.count({ where: { role: { in: [Role.BAKER, Role.BOULANGER] } } }),
      prisma.user.count({ where: { role: { in: [Role.COURIER, Role.LIVREUR] } } }),
      prisma.user.count({ where: { role: { in: [Role.COURIER, Role.LIVREUR] }, active: true } }),
    ]);

    const topProductIds = topRaw.map(r => r.productId);
    const topProducts = await prisma.product.findMany({ where: { id: { in: topProductIds } }, select: { id: true, name: true } });
    const topWithQty = topRaw.map(r => ({
      name: topProducts.find(p => p.id === r.productId)?.name ?? 'Inconnu',
      quantity: r._sum.quantity ?? 0,
    }));

    res.json({ ordersToday, pending, revenueToday: revenue._sum.total ?? 0, topProducts: topWithQty, totalCustomers, totalBakeries, newCustomersToday, totalBakers, totalCouriers, activeCouriers });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur stats.' });
  }
});

// ---- Create bakery ----
router.post('/bakeries', async (req: Request, res: Response) => {
  try {
    const { name, address, latitude, longitude } = req.body;
    if (!name || latitude == null || longitude == null) {
      res.status(400).json({ error: 'Champs requis : name, latitude, longitude.' });
      return;
    }
    const bakery = await prisma.bakery.create({
      data: { name, address: address || null, latitude, longitude, active: true },
    });
    console.log(`[ADMIN] Nœud logistique créé: ${bakery.name}`);
    res.status(201).json({ message: 'Nœud logistique créé avec succès.', bakery });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de la création du nœud logistique.' });
  }
});

// ---- Register baker ----
router.post('/register-baker', async (req: Request, res: Response) => {
  try {
    const { name, phone, pin, bakeryId } = req.body;
    if (!phone || !pin || !bakeryId) {
      res.status(400).json({ error: 'Champs requis : phone, pin, bakeryId.' });
      return;
    }
    const bakery = await prisma.bakery.findUnique({ where: { id: bakeryId } });
    if (!bakery) { res.status(404).json({ error: 'Boulangerie introuvable.' }); return; }

    const existing = await prisma.user.findUnique({ where: { phoneNumber: phone } });
    if (existing) { res.status(409).json({ error: 'Ce numéro est déjà associé à un compte.' }); return; }

    const user = await prisma.user.create({
      data: {
        phoneNumber: phone,
        name: name || 'Boulanger',
        pin: hashPin(pin),
        role: 'BAKER',
        bakeryId,
        virtualCard: { create: { balance: 0, points: 0 } },
      },
    });
    console.log(`[ADMIN] Boulanger créé: ${user.name} → ${bakery.name}`);
    res.status(201).json({ message: `Boulanger ${user.name} créé pour ${bakery.name}.`, userId: user.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de la création du boulanger.' });
  }
});

// ---- Register courier ----
router.post('/register-courier', async (req: Request, res: Response) => {
  try {
    const { name, phone, pin } = req.body;
    if (!phone || !pin) {
      res.status(400).json({ error: 'Champs requis : phone, pin.' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { phoneNumber: phone } });
    if (existing) { res.status(409).json({ error: 'Ce numéro est déjà associé à un compte.' }); return; }

    const user = await prisma.user.create({
      data: {
        phoneNumber: phone,
        name: name || 'Livreur',
        pin: hashPin(pin),
        role: 'COURIER',
        virtualCard: { create: { balance: 0, points: 0 } },
      },
    });
    console.log(`[ADMIN] Livreur créé: ${user.name}`);
    res.status(201).json({ message: `Livreur ${user.name} créé.`, userId: user.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de la création du livreur.' });
  }
});

// ---- List staff ----
router.get('/staff', async (req: Request, res: Response) => {
  try {
    const roleFilter = req.query.role as string | undefined;
    const where: any = { role: { in: ['BAKER', 'COURIER', 'ADMIN', 'BOULANGER', 'LIVREUR'] } };
    if (roleFilter) where.role = roleFilter;

    const staff = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { bakery: { select: { name: true } } },
    });

    res.json({
      staff: staff.map((u: any) => ({
        id: u.id,
        name: u.name,
        phoneNumber: u.phoneNumber,
        role: u.role,
        active: u.active,
        bakeryId: u.bakeryId,
        bakeryName: u.bakery?.name ?? null,
        createdAt: u.createdAt,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de la récupération du personnel.' });
  }
});

// ---- Toggle staff active ----
router.put('/staff/:id/toggle', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = await prisma.user.findUnique({ where: { id } }) as any;
    if (!user) { res.status(404).json({ error: 'Utilisateur introuvable.' }); return; }

    const updated = await prisma.user.update({
      where: { id },
      data: { active: !user.active } as any,
    }) as any;

    console.log(`[ADMIN] ${updated.name} → ${updated.active ? 'activé' : 'désactivé'}`);
    res.json({ message: `${updated.name} ${updated.active ? 'activé' : 'désactivé'}.`, user: { id: updated.id, active: updated.active } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de la mise à jour.' });
  }
});

// ---- Confirm order (PENDING → CONFIRMED) ----
router.put('/orders/:id/confirm', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) { res.status(404).json({ error: 'Commande introuvable.' }); return; }
    if (order.status !== 'PENDING') {
      res.status(400).json({ error: 'Seules les commandes PENDING peuvent être confirmées.' });
      return;
    }
    const updated = await prisma.order.update({
      where: { id },
      data: { status: 'CONFIRMED' },
      include: { user: { select: { pushToken: true, name: true } } },
    });
    if (updated.user?.pushToken) {
      sendPushNotification(
        updated.user.pushToken,
        'Commande confirmée !',
        `Votre commande #${updated.pickupCode} est en cours de préparation.`
      );
    }
    console.log(`[BAKER] Commande ${updated.pickupCode} confirmée → EN PRÉPARATION`);
    res.json({ message: 'Commande confirmée.', order: updated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de la confirmation.' });
  }
});

// ---- Mark order READY (CONFIRMED → READY) ----
router.put('/orders/:id/ready', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) { res.status(404).json({ error: 'Commande introuvable.' }); return; }
    if (order.status !== 'CONFIRMED') {
      res.status(400).json({ error: 'Seules les commandes CONFIRMED peuvent être marquées prêtes.' });
      return;
    }
    const updated = await prisma.order.update({
      where: { id },
      data: { status: 'READY' },
      include: { user: { select: { pushToken: true } } },
    });
    if (updated.user?.pushToken) {
      const isDelivery = updated.deliveryType.includes('DELIVERY');
      sendPushNotification(
        updated.user.pushToken,
        'Commande prête ! 🥐',
        isDelivery
          ? `Votre commande #${updated.pickupCode} est prête. Un livreur va bientôt la récupérer.`
          : `Votre commande #${updated.pickupCode} est prête ! Vous pouvez venir la récupérer.`
      );
    }
    console.log(`[BAKER] Commande ${updated.pickupCode} → READY`);
    res.json({ message: 'Commande marquée prête.', order: updated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors du passage en READY.' });
  }
});

// ---- Confirm handoff to courier (READY → PICKED_UP) — baker action ----
router.put('/orders/:id/handoff', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const order = await prisma.order.findUnique({ where: { id }, include: { courier: { select: { pushToken: true, name: true } } } });
    if (!order) { res.status(404).json({ error: 'Commande introuvable.' }); return; }
    if (order.status !== 'READY') {
      res.status(400).json({ error: 'La commande doit être READY pour confirmer la remise.' });
      return;
    }
    if (!order.courierId) {
      res.status(400).json({ error: 'Aucun livreur n\'a encore accepté cette commande.' });
      return;
    }
    const updated = await prisma.order.update({
      where: { id },
      data: { status: 'PICKED_UP' },
    });
    if ((order as any).courier?.pushToken) {
      sendPushNotification(
        (order as any).courier.pushToken,
        'Commande remise ! 🛵',
        `La boulangerie vous a remis la commande #${updated.pickupCode}. Bonne livraison !`
      );
    }
    console.log(`[BAKER] Commande ${updated.pickupCode} → PICKED_UP (remise livreur confirmée)`);
    res.json({ message: 'Remise au livreur confirmée.', order: updated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de la confirmation de remise.' });
  }
});

// ---- Courier live locations ----
router.get('/courier-locations', async (req: Request, res: Response) => {
  try {
    const couriers = await prisma.user.findMany({
      where: {
        role: { in: [Role.COURIER, Role.LIVREUR] },
        active: true,
        courierLat: { not: null },
        courierLng: { not: null },
      },
      select: { id: true, name: true, courierLat: true, courierLng: true, courierLocationAt: true },
    });
    res.json({ couriers });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur positions livreurs.' });
  }
});

// ---- List all products (platform + all bakery specialties) ----
router.get('/products', async (req: Request, res: Response) => {
  try {
    const products = await (prisma.product as any).findMany({
      orderBy: [{ bakeryId: 'asc' }, { name: 'asc' }],
      include: { bakery: { select: { id: true, name: true } } },
    });
    const enriched = products.map((p: any) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      description: p.description,
      image: p.image,
      category: p.category,
      bakeryId: p.bakeryId ?? null,
      bakeryName: p.bakery?.name ?? null,
    }));
    res.json({ products: enriched });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de la récupération des produits.' });
  }
});

// ---- Create product (platform only — bakeryId stays null) ----
router.post('/products', async (req: Request, res: Response) => {
  try {
    const { name, price, description, image, category } = req.body;
    if (!name || price == null) {
      res.status(400).json({ error: 'Champs requis : name, price.' });
      return;
    }
    const product = await prisma.product.create({
      data: {
        name,
        price: parseFloat(price),
        description: description || null,
        image: image || null,
        category: category || null,
      },
    });
    console.log(`[ADMIN] Produit créé: ${product.name}`);
    res.status(201).json({ message: 'Produit créé.', product });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de la création du produit.' });
  }
});

// ---- Update product ----
router.put('/products/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, price, description, image, category } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (price !== undefined) data.price = parseFloat(price);
    if (description !== undefined) data.description = description;
    if (image !== undefined) data.image = image;
    if (category !== undefined) data.category = category;

    const product = await prisma.product.update({ where: { id }, data });
    console.log(`[ADMIN] Produit modifié: ${product.name}`);
    res.json({ message: 'Produit mis à jour.', product });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du produit.' });
  }
});

// ---- Delete product ----
router.delete('/products/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const refs = await prisma.orderItem.count({ where: { productId: id } });
    if (refs > 0) {
      res.status(409).json({ error: `Ce produit est référencé dans ${refs} commande(s). Suppression impossible.` });
      return;
    }

    await prisma.product.delete({ where: { id } });
    console.log(`[ADMIN] Produit supprimé: ${id}`);
    res.json({ message: 'Produit supprimé.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de la suppression du produit.' });
  }
});

// ════════════════════════════════════════════════════════════════
// COUPON ROUTES
// ════════════════════════════════════════════════════════════════

// ---- List coupons ----
router.get('/coupons', async (req: Request, res: Response) => {
  try {
    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ coupons });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur récupération coupons.' });
  }
});

// ---- Create coupon ----
router.post('/coupons', async (req: Request, res: Response) => {
  try {
    const { code, discountType, discountValue, maxUses } = req.body;
    if (!code || !discountType || discountValue == null) {
      res.status(400).json({ error: 'Champs requis : code, discountType, discountValue.' });
      return;
    }
    if (!['PERCENTAGE', 'FIXED'].includes(discountType)) {
      res.status(400).json({ error: 'discountType doit être PERCENTAGE ou FIXED.' });
      return;
    }
    const coupon = await prisma.coupon.create({
      data: {
        code: code.toUpperCase().trim(),
        discountType,
        discountValue: parseFloat(discountValue),
        maxUses: maxUses ? parseInt(maxUses) : null,
        active: true,
      },
    });
    console.log(`[ADMIN] Coupon créé: ${coupon.code} (${coupon.discountType} ${coupon.discountValue})`);
    res.status(201).json({ message: 'Coupon créé.', coupon });
  } catch (e: any) {
    if (e.code === 'P2002') {
      res.status(409).json({ error: 'Ce code promo existe déjà.' });
      return;
    }
    console.error(e);
    res.status(500).json({ error: 'Erreur création coupon.' });
  }
});

// ---- Toggle coupon active ----
router.put('/coupons/:id/toggle', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const coupon = await prisma.coupon.findUnique({ where: { id } });
    if (!coupon) { res.status(404).json({ error: 'Coupon introuvable.' }); return; }
    const updated = await prisma.coupon.update({ where: { id }, data: { active: !coupon.active } });
    res.json({ message: `Coupon ${updated.active ? 'activé' : 'désactivé'}.`, coupon: updated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur mise à jour coupon.' });
  }
});

// ---- Delete coupon ----
router.delete('/coupons/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.coupon.delete({ where: { id } });
    console.log(`[ADMIN] Coupon supprimé: ${id}`);
    res.json({ message: 'Coupon supprimé.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur suppression coupon.' });
  }
});

// ══════════════════════════════════════════════════════════════════
// COURIER ROUTES  (mounted at /api/courier)
// ══════════════════════════════════════════════════════════════════

// ---- Get deliveries ----
// No courierId = all unassigned delivery orders (for Uber-style accept)
// With courierId = courier's accepted deliveries
courierRouter.get('/deliveries', async (req: Request, res: Response) => {
  try {
    const courierId = req.query.courierId as string | undefined;

    const where: any = {
      deliveryType: { in: ['DELIVERY', 'DELIVERY_SCHEDULED'] },
      latitude: { not: null },
      longitude: { not: null },
    };

    if (courierId) {
      // Courier's accepted orders: READY (claimed, going to bakery) + PICKED_UP (en route to customer)
      where.courierId = courierId;
      where.status = { in: ['READY', 'PICKED_UP'] };
    } else {
      // Available pool: READY orders with no courier yet
      where.courierId = null;
      where.status = 'READY';
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { name: true, phoneNumber: true } },
        bakery: { select: { name: true } },
      },
    });

    const deliveries = orders.map((o: any) => ({
      id: o.id,
      pickupCode: o.pickupCode,
      status: o.status,
      customerName: o.recipientName || o.user.name || 'Client',
      customerPhone: o.recipientPhone || o.user.phoneNumber,
      address: o.address ?? 'Adresse non précisée',
      latitude: o.latitude,
      longitude: o.longitude,
      bakeryName: o.bakery?.name ?? null,
      bakeryAddress: o.bakery?.address ?? null,
      scheduledFor: o.scheduledFor,
      total: o.total,
      courierId: o.courierId,
    }));

    res.json({ deliveries });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de la récupération des livraisons.' });
  }
});

// ---- Update courier live location ----
courierRouter.put('/location', async (req: Request, res: Response) => {
  try {
    const { courierId, lat, lng } = req.body;
    if (!courierId || lat == null || lng == null) {
      res.status(400).json({ error: 'courierId, lat et lng requis.' });
      return;
    }
    await prisma.user.update({
      where: { id: courierId },
      data: { courierLat: lat, courierLng: lng, courierLocationAt: new Date() } as any,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur mise à jour position.' });
  }
});

// ---- Accept delivery (first-come-first-served; courier claims READY order) ----
courierRouter.post('/:orderId/accept', async (req: Request, res: Response) => {
  try {
    const orderId = req.params.orderId as string;
    const { courierId } = req.body;

    if (!courierId) { res.status(400).json({ error: 'courierId requis.' }); return; }

    const order = await prisma.order.findUnique({ where: { id: orderId } }) as any;
    if (!order) { res.status(404).json({ error: 'Commande introuvable.' }); return; }
    if (order.status !== 'READY') {
      res.status(400).json({ error: 'Cette commande n\'est pas prête à être prise en charge.' });
      return;
    }
    if (order.courierId) {
      res.status(409).json({ error: 'Cette livraison a déjà été acceptée par un autre livreur.' });
      return;
    }
    if (!order.deliveryType.includes('DELIVERY')) {
      res.status(400).json({ error: 'Cette commande n\'est pas une livraison.' });
      return;
    }

    // Assign courier — status stays READY until baker confirms physical handoff
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { courierId } as any,
    });

    console.log(`[LIVREUR] Livraison ${updated.pickupCode} acceptée par ${courierId} — en route vers boulangerie`);
    res.json({ message: 'Livraison acceptée ! Rendez-vous à la boulangerie.', orderId: updated.id, pickupCode: updated.pickupCode });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de l\'acceptation.' });
  }
});

// ---- Complete delivery (PICKED_UP → DELIVERED; courier confirms drop-off at customer) ----
courierRouter.post('/:orderId/complete', async (req: Request, res: Response) => {
  try {
    const orderId = req.params.orderId as string;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { select: { pushToken: true } } },
    }) as any;
    if (!order) { res.status(404).json({ error: 'Commande introuvable.' }); return; }
    if (order.status !== 'PICKED_UP') {
      res.status(400).json({ error: 'La boulangerie doit d\'abord confirmer la remise physique.' });
      return;
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'DELIVERED' },
    });

    if (order.user?.pushToken) {
      sendPushNotification(
        order.user.pushToken,
        'Commande livrée ! 🎉',
        `Votre commande #${updated.pickupCode} a été livrée. Bonne dégustation !`
      );
    }

    console.log(`[LIVREUR] Livraison ${updated.pickupCode} complétée → DELIVERED`);
    res.json({ message: 'Livraison complétée !', orderId: updated.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de la complétion de la livraison.' });
  }
});

// ---- List customers ----
router.get('/customers', async (req: Request, res: Response) => {
  const { search } = req.query as any;
  try {
    const where: any = { role: Role.CLIENT };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
      ];
    }
    const customers = await prisma.user.findMany({
      where,
      include: {
        virtualCard: true,
        orders: { select: { id: true, total: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const result = customers.map((c: any) => ({
      id: c.id,
      name: c.name || '—',
      phoneNumber: c.phoneNumber,
      walletBalance: c.virtualCard?.balance ?? 0,
      walletPoints: c.virtualCard?.points ?? 0,
      orderCount: c.orders.length,
      totalSpent: c.orders.reduce((sum: number, o: any) => sum + o.total, 0),
      createdAt: c.createdAt,
    }));
    res.json({ customers: result, total: result.length });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════
// POINTS MANAGEMENT
// ════════════════════════════════════════════════════════════════

// ---- List all clients with their points balance ----
router.get('/points', async (req: Request, res: Response) => {
  try {
    const { search } = req.query as any;
    const where: any = { role: Role.CLIENT };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
      ];
    }
    const users = await prisma.user.findMany({
      where,
      include: { virtualCard: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const settings = await prisma.platformSettings.findFirst();
    res.json({
      users: users.map((u: any) => ({
        id: u.id,
        name: u.name ?? '—',
        phoneNumber: u.phoneNumber,
        points: u.virtualCard?.points ?? 0,
        balance: u.virtualCard?.balance ?? 0,
      })),
      earnRate: settings?.pointsEarnRate ?? 1,
      redeemRate: settings?.pointsRedeemRate ?? 10,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur récupération points.' });
  }
});

// ---- Manually adjust a user's points ----
router.post('/points/:userId/adjust', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const { delta, reason } = req.body;
    if (delta === undefined || delta === 0) {
      res.status(400).json({ error: 'delta requis et non nul.' });
      return;
    }
    const card = await prisma.virtualCard.findUnique({ where: { userId } });
    if (!card) { res.status(404).json({ error: 'Portefeuille introuvable.' }); return; }

    const newPoints = Math.max(0, card.points + delta);
    const updated = await prisma.virtualCard.update({
      where: { id: card.id },
      data: { points: newPoints },
    });

    // Log as a POINTS transaction so it appears in user activity
    if (delta > 0) {
      await prisma.transaction.create({
        data: {
          userId,
          amount: delta,
          provider: 'POINTS' as any,
          status: 'SUCCESS' as any,
          reference: `admin_pts_${userId}_${Date.now()}`,
        },
      });
    }

    console.log(`[ADMIN] Points ajustés pour ${userId}: ${delta > 0 ? '+' : ''}${delta} (raison: ${reason ?? 'admin'})`);
    res.json({ points: updated.points, delta });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur ajustement points.' });
  }
});

export default router;
