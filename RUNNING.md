# Le Boulanger — Guide de lancement & Tests

> App de commande de pains/pâtisseries (Gabon, FCFA)  
> Stack : Backend Express + Prisma + PostgreSQL | Mobile Expo RN | Dashboard React PWA

---

## Prérequis

| Outil | Version minimale |
|-------|-----------------|
| Node.js | 18+ |
| PostgreSQL | 14+ (en cours d'exécution sur port 5432) |
| Expo Go (téléphone) | Dernière version — [iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent) |
| npm | 9+ |

---

## 1. Backend (API Node.js)

```bash
cd "le boulanger/backend"
npx ts-node src/index.ts
```

**Au premier démarrage**, le serveur crée automatiquement :
- 3 boulangeries à Libreville (Gabon)
- 8 produits (Croissant 700F, Baguette 500F, Pain Campagne 1500F…)

**Ports & URLs :**
- API : `http://localhost:3000`
- Health check : `http://localhost:3000/api/products`

**Variables d'environnement** (déjà dans `/backend/.env`) :
```
DATABASE_URL="postgresql://postgres:eliteback@localhost:5432/leboulanger?schema=public"
PORT=3000
```

> Si la base de données n'existe pas encore :
> ```bash
> createdb leboulanger
> cd "le boulanger/backend"
> npx prisma db push
> ```

---

## 2. Mobile (Expo React Native)

### Démarrage
```bash
cd "le boulanger/mobile"
npx expo start
```

Appuyer sur :
- `a` → Android Emulator
- `i` → iOS Simulator  
- Scanner le QR code → Expo Go sur téléphone physique

### Configuration réseau (téléphone physique uniquement)

Le fichier `mobile/constants/api.ts` contient l'IP de la machine :

```ts
const LAN_IP = '192.168.1.67';   // ← Changer si votre IP change
```

**Vérifier votre IP :**
```bash
# Windows
ipconfig | findstr "IPv4"

# Mac/Linux
ifconfig | grep "inet "
```

> Le téléphone physique et l'ordinateur doivent être sur le **même réseau Wi-Fi**.  
> Émulateur Android → `10.0.2.2:3000` (automatique)  
> Simulateur iOS → `localhost:3000` (automatique)

---

## 3. Dashboard Boulangerie (PWA React)

```bash
cd "le boulanger/dashboard"
npm run dev
```

Ouvrir : `http://localhost:5173`

> Le dashboard affiche les commandes CONFIRMÉES en attente.  
> Il fonctionne aussi **hors-ligne** (IndexedDB) — les validations sont synchronisées au retour du réseau.

---

## Ordre de lancement

```
1. PostgreSQL      →  en cours d'exécution
2. Backend         →  npx ts-node src/index.ts    (port 3000)
3. Mobile          →  npx expo start               (QR code / émulateur)
4. Dashboard       →  npm run dev                  (port 5173)
```

---

## Scénarios de test

### Scénario 1 — Inscription & Connexion
1. Ouvrir l'app mobile → écran de connexion
2. Appuyer **"Créer un compte"**
3. Remplir : Nom, Numéro Airtel/Moov (+24177…), PIN 4 chiffres
4. Compte créé → redirigé vers l'accueil ✓
5. Fermer et rouvrir l'app → **toujours connecté** (AsyncStorage) ✓

---

### Scénario 2 — Parcourir les produits
1. Onglet **Accueil** → liste des produits chargée depuis l'API ✓
2. Tirer vers le bas → pull-to-refresh ✓
3. Appuyer **"+"** sur un produit → alerte "Ajouté au panier" ✓

---

### Scénario 3 — Recharger le portefeuille
1. Onglet **Portefeuille**
2. Sélectionner un montant (1 000 / 2 000 / 5 000 / 10 000 / 20 000 FCFA)
3. Appuyer **Airtel Money** ou **Moov Money**
4. Attendre 3 secondes (simulation USSD) ✓
5. Solde mis à jour + points fidélité affichés ✓

---

### Scénario 4 — Commander (flux complet)
1. Onglet **Panier** (après avoir ajouté des produits)
2. Déplacer le repère sur la carte → boulangerie la plus proche assignée automatiquement ✓
3. **Optionnel :** Appuyer "Changer" → choisir une autre boulangerie → surcharge en FCFA affichée ✓
4. Choisir mode : **En Boutique** ou **Livraison**
5. Choisir timing : **Dès que possible** ou **Programmer** (sélecteur date/heure)
6. Choisir abonnement : **Juste une fois** ou **Tous les jours**
7. Vérifier le total en **FCFA** en bas ✓
8. Appuyer **"Débiter mon Portefeuille"**
9. Écran de succès :
   - Code de retrait affiché (ex: `A7F2-42`) ✓
   - Boulangerie assignée ✓
   - Surcharge si boulangerie choisie ✓
   - Bouton PDF/QR Code ✓

---

### Scénario 5 — Historique des commandes
1. Onglet **Commandes** (icône reçu)
2. Liste des commandes avec : statut, boulangerie, articles, total ✓
3. Tirer vers le bas pour rafraîchir ✓

---

### Scénario 6 — Dashboard boulangerie
1. Ouvrir `http://localhost:5173`
2. La commande passée à l'étape 4 apparaît ✓
3. Taper le **code de retrait** dans le champ → appuyer **OK**
4. Commande disparaît de la file ✓ + marquée `DELIVERED` en base ✓
5. Cliquer "Valider ce sachet" directement sur la carte → même effet ✓

**Test hors-ligne :**
1. Couper le Wi-Fi / arrêter le backend
2. Le dashboard passe en **"Mode Secours"** (badge rouge) ✓
3. Valider une commande → stockée dans l'IndexedDB (outbox) ✓
4. Remettre le réseau → synchronisation automatique ✓

---

### Scénario 7 — Livreur (compte COURIER)
> Créer un compte avec `role: COURIER` directement en base ou via Prisma Studio

1. Se connecter avec un compte COURIER
2. Seul l'onglet **"Mes Livraisons"** est visible ✓
3. Les commandes DELIVERY en attente apparaissent sur la carte (Libreville) ✓
4. Appuyer le bouton **✓** sur une livraison → confirmation → marquée livrée ✓

---

## API — Endpoints disponibles

| Méthode | URL | Auth | Description |
|---------|-----|------|-------------|
| POST | `/api/auth/register` | — | Créer un compte |
| POST | `/api/auth/login` | — | Connexion → retourne JWT |
| GET | `/api/products` | — | Liste des produits |
| GET | `/api/order/bakeries?lat=X&lng=Y` | — | Boulangeries + distances |
| POST | `/api/order/checkout` | ✓ JWT | Passer une commande |
| POST | `/api/order/:id/deliver` | — | Marquer livrée |
| GET | `/api/order/:id/invoice` | — | Télécharger le PDF |
| POST | `/api/payment/recharge-wallet` | ✓ JWT | Recharger le portefeuille |
| GET | `/api/user/:id/wallet` | ✓ JWT | Solde & points |
| GET | `/api/user/:id/orders` | ✓ JWT | Historique commandes |
| GET | `/api/admin/orders/pending` | — | File d'attente dashboard |
| GET | `/api/courier/deliveries` | — | Livraisons en cours |
| POST | `/api/courier/:id/complete` | — | Livraison complétée |

---

## Prisma Studio (optionnel — visualiser la base)

```bash
cd "le boulanger/backend"
npx prisma studio
```

Ouvrir : `http://localhost:5555`  
→ Voir/modifier Users, Orders, Products, Bakeries en temps réel.

---

## Problèmes courants

| Problème | Solution |
|----------|----------|
| `Cannot connect to database` | Vérifier que PostgreSQL tourne sur le port 5432 |
| `Solde insuffisant` | Recharger le portefeuille avant de commander |
| `Token invalide` | Se déconnecter et se reconnecter |
| Mobile ne contacte pas le backend | Vérifier l'IP dans `mobile/constants/api.ts` |
| Dashboard vide | S'assurer que le backend tourne sur le port 3000 |
| Carte ne charge pas (mobile) | Accepter les permissions de localisation |

---

## Structure du projet

```
le boulanger/
├── backend/          Express + Prisma + PostgreSQL
│   ├── src/
│   │   ├── index.ts              Serveur + routes + seeding
│   │   ├── prisma.ts             Instance Prisma partagée
│   │   ├── auth.controller.ts    JWT + register/login
│   │   ├── order.controller.ts   Commandes + bakeries + PDF
│   │   └── payment.controller.ts Rechargement (simulé)
│   └── prisma/schema.prisma      Modèles DB
│
├── mobile/           Expo React Native (iOS + Android)
│   ├── app/
│   │   ├── _layout.tsx           Root + AuthGuard
│   │   ├── login.tsx / register.tsx
│   │   ├── success.tsx           Confirmation commande
│   │   └── (tabs)/
│   │       ├── index.tsx         Accueil — produits
│   │       ├── wallet.tsx        Portefeuille
│   │       ├── cart.tsx          Panier + boulangerie
│   │       ├── explore.tsx       Historique commandes
│   │       └── courier.tsx       Espace livreur
│   ├── context/
│   │   ├── AuthContext.tsx       Session + AsyncStorage
│   │   └── CartContext.tsx       Panier + AsyncStorage
│   └── constants/
│       ├── api.ts                BASE_URL centralisé
│       └── theme.ts              Couleurs
│
└── dashboard/        React PWA — Terminal boulangerie
    └── src/App.tsx   Scanner QR + file d'attente + offline sync
```
