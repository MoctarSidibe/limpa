import { Router, Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { randomUUID } from 'crypto';
import { requireAuth } from './auth.controller';
import { prisma } from './prisma';
import { sendPushNotification } from './push';

const router = Router();

// Haversine formula — distance GPS en km
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// ── Gabon-compliant rounding: smallest coin = 25 FCFA ─────────────
function roundToUnit(value: number, unit: number): number {
  if (unit <= 1) return Math.round(value);
  return Math.round(value / unit) * unit;
}

// ── Dynamic platform settings (cached per request) ─────────────────
async function getSettings() {
  const s = await prisma.platformSettings.findFirst();
  return s ?? { feePerKm: 300, roundingUnit: 25, minFee: 0 };
}

// --- GET /api/order/bakeries?lat=X&lng=Y ---
router.get('/bakeries', async (req: Request, res: Response): Promise<void> => {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : null;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : null;

    const [bakeries, settings] = await Promise.all([
      prisma.bakery.findMany({ where: { active: true } }),
      getSettings(),
    ]);

    if (!lat || !lng) {
      res.json({
        bakeries: bakeries.map(b => ({ ...b, distance: null, extraFee: 0, isNearest: false })),
        nearestId: null,
        settings: { feePerKm: settings.feePerKm, roundingUnit: settings.roundingUnit },
      });
      return;
    }

    const withDistances = bakeries.map(b => ({
      ...b,
      distance: calculateDistance(lat, lng, b.latitude, b.longitude),
    }));

    const minDistance = Math.min(...withDistances.map(b => b.distance));
    const nearestId = withDistances.find(b => b.distance === minDistance)!.id;

    const result = withDistances
      .map(b => {
        const rawFee = Math.max(0, b.distance - minDistance) * settings.feePerKm;
        const extraFee = rawFee === 0 ? 0 : Math.max(
          settings.minFee,
          roundToUnit(rawFee, settings.roundingUnit),
        );
        return {
          ...b,
          distance: parseFloat(b.distance.toFixed(2)),
          extraFee,
          isNearest: b.id === nearestId,
        };
      })
      .sort((a, b) => a.distance - b.distance);

    res.json({ bakeries: result, nearestId, settings: { feePerKm: settings.feePerKm, roundingUnit: settings.roundingUnit } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de la récupération des boulangeries.' });
  }
});

// --- POST /api/order/validate-coupon ---
router.post('/validate-coupon', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, subtotal } = req.body;
    if (!code) { res.status(400).json({ error: 'Code requis.' }); return; }

    const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase().trim() } });
    if (!coupon || !coupon.active) {
      res.status(400).json({ error: 'Code promo invalide ou expiré.' });
      return;
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      res.status(400).json({ error: 'Ce code promo a atteint sa limite d\'utilisation.' });
      return;
    }

    const discount = coupon.discountType === 'PERCENTAGE'
      ? parseFloat(((subtotal ?? 0) * coupon.discountValue / 100).toFixed(2))
      : coupon.discountValue;

    res.json({ valid: true, discount, discountType: coupon.discountType, discountValue: coupon.discountValue });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de la validation du coupon.' });
  }
});

// --- POST /api/order/checkout ---
router.post('/checkout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      userId, items, total, deliveryType, scheduledFor,
      recurrence, address, latitude, longitude, preferredBakeryId,
      recipientName, recipientPhone, couponCode
    } = req.body;

    const card = await prisma.virtualCard.findUnique({ where: { userId } });
    if (!card) {
      res.status(404).json({ error: "Portefeuille non trouvé. Rechargez votre carte d'abord." });
      return;
    }

    // --- Load bakeries + platform settings ---
    const [allBakeries, settings] = await Promise.all([
      prisma.bakery.findMany({ where: { active: true } }),
      getSettings(),
    ]);
    let nearestBakeryId: string | null = null;
    let minDistance = 0;
    if (latitude && longitude && allBakeries.length > 0) {
      let nearest = allBakeries[0];
      let minDist = calculateDistance(latitude, longitude, nearest.latitude, nearest.longitude);
      for (let i = 1; i < allBakeries.length; i++) {
        const d = calculateDistance(latitude, longitude, allBakeries[i].latitude, allBakeries[i].longitude);
        if (d < minDist) { minDist = d; nearest = allBakeries[i]; }
      }
      nearestBakeryId = nearest.id;
      minDistance = minDist;
    }

    // fallback for platform items (no bakeryId on the product)
    const fallbackBakeryId: string | null = preferredBakeryId ?? nearestBakeryId;

    // --- Group items by target bakery ---
    // specialty items  → their own bakeryId
    // platform items   → fallbackBakeryId (preferred or nearest)
    const groupMap = new Map<string, { bakery: any; items: any[]; subtotal: number }>();
    for (const item of (items ?? [])) {
      const targetId: string | null = item.bakeryId || fallbackBakeryId;
      if (!targetId) continue;
      const bakery = allBakeries.find(b => b.id === targetId);
      if (!bakery) continue;
      if (!groupMap.has(targetId)) groupMap.set(targetId, { bakery, items: [], subtotal: 0 });
      const g = groupMap.get(targetId)!;
      g.items.push(item);
      g.subtotal += (item.priceValue || 0) * (item.quantity || 1);
    }

    // last-resort fallback when item list empty or all products unknown
    if (groupMap.size === 0 && fallbackBakeryId) {
      const bakery = allBakeries.find(b => b.id === fallbackBakeryId);
      if (bakery) groupMap.set(fallbackBakeryId, { bakery, items: items ?? [], subtotal: total ?? 0 });
    }

    if (groupMap.size === 0) {
      res.status(400).json({ error: 'Aucune boulangerie active disponible.' });
      return;
    }

    // --- Compute per-bakery extra fee (rounded to Gabonese coin unit) ---
    const groups = [...groupMap.entries()].map(([bakeryId, g]) => {
      let fee = 0;
      if (latitude && longitude) {
        const dist = calculateDistance(latitude, longitude, g.bakery.latitude, g.bakery.longitude);
        const rawFee = Math.max(0, dist - minDistance) * settings.feePerKm;
        fee = rawFee === 0 ? 0 : Math.max(settings.minFee, roundToUnit(rawFee, settings.roundingUnit));
      }
      return { bakeryId, bakery: g.bakery, items: g.items, subtotal: g.subtotal, extraFee: fee,
               userChoseBakery: bakeryId !== nearestBakeryId };
    });

    const totalSubtotal = groups.reduce((s, g) => s + g.subtotal, 0);
    const totalExtraFee  = groups.reduce((s, g) => s + g.extraFee,  0);

    // --- Coupon ---
    let discount = 0;
    let validatedCouponCode: string | null = null;
    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase().trim() } });
      if (coupon && coupon.active && (coupon.maxUses === null || coupon.usedCount < coupon.maxUses)) {
        discount = coupon.discountType === 'PERCENTAGE'
          ? parseFloat((totalSubtotal * coupon.discountValue / 100).toFixed(2))
          : coupon.discountValue;
        validatedCouponCode = coupon.code;
      }
    }
    discount = Math.min(discount, totalSubtotal); // clamp: discount never exceeds goods total

    const grandTotal = parseFloat((totalSubtotal + totalExtraFee - discount).toFixed(2));
    if (card.balance < grandTotal) {
      res.status(400).json({ error: 'Solde insuffisant. Veuillez recharger votre portefeuille.' });
      return;
    }

    // --- Generate shared group ID + one pickup code per sub-order ---
    const groupOrderId = randomUUID();
    const generatePickupCode = () =>
      Math.random().toString(36).substring(2, 5).toUpperCase() + '-' + String(Math.floor(Math.random() * 900) + 100);
    const pickupCodes: string[] = [];
    for (let i = 0; i < groups.length; i++) {
      let code = generatePickupCode();
      for (let attempt = 0; attempt < 4; attempt++) {
        const existing = await prisma.order.findUnique({ where: { pickupCode: code } });
        if (!existing) break;
        code = generatePickupCode();
      }
      pickupCodes.push(code);
    }

    // --- Distribute discount proportionally by subtotal weight ---
    const discountPerGroup: number[] = [];
    let discountRemaining = discount;
    for (let i = 0; i < groups.length; i++) {
      if (i === groups.length - 1) {
        discountPerGroup.push(parseFloat(Math.max(0, discountRemaining).toFixed(2)));
      } else {
        const share = parseFloat((discount * groups[i].subtotal / (totalSubtotal || 1)).toFixed(2));
        discountPerGroup.push(share);
        discountRemaining -= share;
      }
    }

    const rec = recurrence || 'NONE';
    const nextRecurrenceAt = rec === 'DAILY'
      ? new Date(Date.now() + 24 * 60 * 60 * 1000)
      : rec === 'WEEKLY' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null;

    // --- Transaction: create all sub-orders + deduct wallet ---
    const result = await prisma.$transaction(async (tx) => {
      const createdOrders: { order: any; bakery: any; pickupCode: string; extraFee: number }[] = [];

      for (let i = 0; i < groups.length; i++) {
        const g          = groups[i];
        const code       = pickupCodes[i];
        const subDiscount = discountPerGroup[i];
        const subTotal   = roundToUnit(Math.max(0, g.subtotal + g.extraFee - subDiscount), settings.roundingUnit);

        const order = await tx.order.create({
          data: {
            userId,
            bakeryId: g.bakeryId,
            total: subTotal,
            status: 'PENDING',
            deliveryType: deliveryType || 'PICKUP',
            recurrence: rec,
            scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
            address: address || null,
            pickupCode: code,
            latitude: latitude || null,
            longitude: longitude || null,
            extraFee: g.extraFee,
            userChoseBakery: g.userChoseBakery,
            recipientName: recipientName || null,
            recipientPhone: recipientPhone || null,
            discount: subDiscount,
            couponCode: subDiscount > 0 ? validatedCouponCode : null,
            nextRecurrenceAt,
            groupOrderId,
          },
        });

        if (g.items.length > 0) {
          const productIds = g.items.map((it: any) => it.id);
          const existing  = await tx.product.findMany({ where: { id: { in: productIds } }, select: { id: true } });
          const validIds  = new Set(existing.map(p => p.id));
          const orderItems = g.items
            .filter((it: any) => validIds.has(it.id))
            .map((it: any) => ({ orderId: order.id, productId: it.id, quantity: it.quantity }));
          if (orderItems.length > 0) await tx.orderItem.createMany({ data: orderItems });
        }

        createdOrders.push({ order, bakery: g.bakery, pickupCode: code, extraFee: g.extraFee });
      }

      const updatedCard = await tx.virtualCard.update({
        where: { id: card.id },
        data: { balance: card.balance - grandTotal },
      });

      if (validatedCouponCode) {
        await tx.coupon.update({ where: { code: validatedCouponCode }, data: { usedCount: { increment: 1 } } });
      }

      return { createdOrders, updatedCard };
    });

    res.json({
      message: `${groups.length > 1 ? groups.length + ' commandes validées' : 'Commande validée'} avec succès ! 🥐`,
      newBalance: result.updatedCard.balance,
      groupOrderId,
      orders: result.createdOrders.map(o => ({
        orderId:      o.order.id,
        pickupCode:   o.pickupCode,
        extraFee:     o.extraFee,
        bakeryName:   o.bakery?.name    ?? null,
        bakeryAddress: o.bakery?.address ?? null,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors du paiement.' });
  }
});

// --- POST /api/order/:id/deliver — marquer comme livrée (dashboard + courier) ---
router.post('/:orderId/deliver', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const orderId = req.params.orderId as string;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) { res.status(404).json({ error: 'Commande introuvable.' }); return; }
    if (order.status === 'DELIVERED') { res.json({ message: 'Déjà livrée.', order }); return; }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'DELIVERED' },
      include: { bakery: true, user: { select: { name: true, phoneNumber: true, pushToken: true } } },
    });

    // Award loyalty points on delivery
    const settings = await prisma.platformSettings.findFirst();
    const earnRate = settings?.pointsEarnRate ?? 1;
    const pointsEarned = Math.floor((order.total / 100) * earnRate);
    if (pointsEarned > 0) {
      await prisma.virtualCard.updateMany({
        where: { userId: order.userId },
        data: { points: { increment: pointsEarned } },
      });
    }

    if (updated.user?.pushToken) {
      await sendPushNotification(
        updated.user.pushToken,
        'Commande Récupérée 🥐',
        `Votre commande ${updated.pickupCode} a été livrée. ${pointsEarned > 0 ? `+${pointsEarned} points fidélité ! ` : ''}Bonne dégustation !`
      );
    }

    console.log(`[LIVRAISON] Commande ${updated.pickupCode} marquée LIVRÉE ✓ (+${pointsEarned} pts)`);
    res.json({ message: 'Commande marquée comme livrée ! ✓', order: updated, pointsEarned });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de la validation de la livraison.' });
  }
});

// --- GET /api/order/:orderId/invoice — génération PDF ---
router.get('/:orderId/invoice', async (req: Request, res: Response): Promise<void> => {
  try {
    const orderId = req.params.orderId as string;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        bakery: true,
        items: { include: { product: true } },
      },
    });

    if (!order) { res.status(404).json({ error: 'Commande introuvable.' }); return; }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Facture_${order.id}.pdf`);

    const doc = new PDFDocument({ size: [280, 680], margins: { top: 30, bottom: 30, left: 15, right: 15 } });
    doc.pipe(res);

    doc.fontSize(20).font('Helvetica-Bold').text('LIMPA', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('Boulangerie & Viennoiseries', { align: 'center' });
    doc.moveDown(1);

    if (order.bakery) {
      doc.fontSize(11).font('Helvetica-Bold').text(order.bakery.name, { align: 'center' });
      if (order.bakery.address) doc.fontSize(9).font('Helvetica').text(order.bakery.address, { align: 'center' });
      doc.moveDown(0.5);
    }

    doc.fontSize(10).font('Helvetica').text(`Commande : ${order.id.split('-')[0].toUpperCase()}`, { align: 'center' });
    doc.text(`Date : ${new Date(order.createdAt).toLocaleString('fr-FR')}`, { align: 'center' });
    doc.text(`Type : ${order.deliveryType}`, { align: 'center' });
    doc.moveDown(1);
    doc.text('------------------------------------------', { align: 'center' });
    doc.moveDown(0.5);

    // Articles
    if (order.items.length > 0) {
      order.items.forEach(item => {
        doc.fontSize(10).font('Helvetica').text(
          `${item.product.name} x${item.quantity}  —  ${(item.product.price * item.quantity).toFixed(2)} FCFA`,
          { align: 'left' }
        );
      });
      doc.moveDown(0.5);
      doc.text('------------------------------------------', { align: 'center' });
      doc.moveDown(0.5);
    }

    doc.fontSize(16).font('Helvetica-Bold').text(`CODE RETRAIT : ${order.pickupCode}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica-Bold').text(`TOTAL : ${order.total.toFixed(2)} FCFA`, { align: 'center' });
    if (order.extraFee > 0) {
      doc.fontSize(9).font('Helvetica').text(`(dont ${order.extraFee.toFixed(2)} FCFA surcharge)`, { align: 'center' });
    }
    doc.moveDown(0.5);

    if (order.latitude && order.longitude) {
      doc.fontSize(8).font('Helvetica').text(`GPS livraison: ${order.latitude.toFixed(4)}, ${order.longitude.toFixed(4)}`, { align: 'center' });
      doc.moveDown(0.5);
    }

    doc.text('------------------------------------------', { align: 'center' });
    doc.moveDown(1);

    const qrPayload = JSON.stringify({
      commande: order.id.split('-')[0].toUpperCase(),
      montant: `${order.total.toFixed(2)} FCFA`,
      paye: 'oui',
      date: new Date(order.createdAt).toLocaleDateString('fr-FR'),
    });
    const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 150 });
    const imgBuffer = Buffer.from(qrDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
    doc.image(imgBuffer, 65, doc.y, { width: 150 });

    doc.moveDown(10);
    doc.fontSize(8).text('Présentez ce code au comptoir pour retrait.', { align: 'center' });
    doc.end();
  } catch (err) {
    console.error('Erreur PDF:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Erreur lors de la génération de la facture.' });
  }
});

export default router;
