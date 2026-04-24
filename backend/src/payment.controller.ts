import { Router, Request, Response } from 'express';
import { requireAuth } from './auth.controller';
import { prisma } from './prisma';

const router = Router();

// Simulation Mobile Money (MIMICS HUB2 / CINETPAY API FORMAT)
const simulateHub2Payment = async (phone: string, amount: number, provider: string) => {
  console.log(`[HUB2 API] Initiating ${provider} request for ${phone} - ${amount} FCFA`);
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 2500));
  
  // Real APIs often fail ~15% of the time (insufficient funds, wrong PIN)
  const isSuccess = Math.random() > 0.15; 
  
  if (!isSuccess) {
    return { success: false, status: 'FAILED', message: 'Solde insuffisant ou PIN annulé' };
  }
  
  return { 
    success: true, 
    status: 'SUCCESS', 
    transactionId: `HUB2_${Date.now()}_${Math.floor(Math.random()*1000)}` 
  };
};

// POST /api/payment/recharge-wallet
router.post('/recharge-wallet', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, amount, provider, phone } = req.body;

    if (!userId || !amount || !provider || !phone) {
      res.status(400).json({ error: 'Champs manquants : userId, amount, provider, phone.' });
      return;
    }

    if (amount < 500 || amount > 100000) {
      res.status(400).json({ error: 'Le montant doit être entre 500 et 100 000 FCFA.' });
      return;
    }

    const paymentResponse = await simulateHub2Payment(phone, amount, provider);
    if (!paymentResponse.success) {
      res.status(400).json({ error: `Paiement refusé: ${paymentResponse.message}` });
      return;
    }

    const settings = await prisma.platformSettings.findFirst();
    const earnRate = settings?.pointsEarnRate ?? 1;
    const pointsEarned = Math.floor((amount / 100) * earnRate);

    const result = await prisma.$transaction(async (tx) => {
      let card = await tx.virtualCard.findUnique({ where: { userId } });

      if (!card) {
        card = await tx.virtualCard.create({
          data: { userId, balance: amount, points: pointsEarned },
        });
      } else {
        card = await tx.virtualCard.update({
          where: { id: card.id },
          data: { balance: card.balance + amount, points: card.points + pointsEarned },
        });
      }

      const transaction = await tx.transaction.create({
        data: {
          amount,
          provider,
          status: 'SUCCESS',
          reference: paymentResponse.transactionId,
          userId,
        },
      });

      return { card, transaction, pointsEarned };
    });

    console.log(`[WALLET] Rechargement de ${amount} FCFA pour userId=${userId} via ${provider} ✓`);
    res.json({
      message: `Rechargement de ${amount.toLocaleString('fr-FR')} FCFA réussi ! 🎉`,
      balance: result.card.balance,
      points_gagnes: result.pointsEarned,
      total_points: result.card.points,
    });
  } catch (error) {
    console.error('Erreur rechargement:', error);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

export default router;
