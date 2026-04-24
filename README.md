# Le Boulanger - Plateforme Next-Gen B2B/B2C

Bienvenue sur le projet "Le Boulanger", l'écosystème commercial 24/7 qui résout la problématique des files d'attentes et de la logistique en boulangerie pour les particuliers et les professionnels (restaurants, commerçants).

L'application agit comme un "UberEats x Starbucks", reposant sur un prépaiement Wallet très pensé pour les marchés où le Mobile Money domine. À la signature d'un accord ou API avec **Airtel / Moov**, un 'Code Marchand' d'agrégation "Le Boulanger" est alloué. Les fonds rechargés par le client B2C ou le restaurateur B2B vont directement sur ce Float Account de l'établissement, sécurisant la trésorerie et la consommation programmée du pain.

---

## ⚙️ Architecture du Projet

Cet écosystème est divisé en **3 dossiers distincts** (Monorepo-style) :

1. `/backend` : Node.js (Express), Prisma (PostgreSQL). Génération des factures PDF, QR codes, et validations monétaires.
2. `/mobile` : Frontend React Native (Expo Router) pour les clients (Panier, Carte GPS) et le Livreur.
3. `/dashboard` : Frontend React PWA (Vite + Tailwind) pour l'Admin, équipé avec IndexedDB (idb-keyval) pour fonctionner 100% hors-ligne au cas de pannes internet à la boulangerie !

---

## 🚀 Comment Démarrer (Environnement de Développement)

Afin d'ouvrir et tester la puissance de la pile, il convient de lancer trois services en parallèle.

### 1. Démarrer le Serveur et la BDD (Node.js)
Assurez-vous d'avoir configuré le fichier `.env` avec la connexion PostgreSQL. Puis depuis le dossier `backend` :
```bash
cd backend
npx ts-node src/index.ts
```
*(L'API tournera sur http://localhost:3000)*

### 2. Démarrer le Dashboard de la Caisse (PWA iPad)
Ce système se lance indépendamment depuis le dossier `dashboard`.
```bash
cd dashboard
npm run dev
```
*(Le portail boulanger tournera sur http://localhost:5173 - Vous pouvez tester la déconnexion internet (Offline Mode) directement dans ce navigateur !)*

### 3. Démarrer l'App Mobile Client/Livreur (Expo)
Ce projet Expo contient la Map GPS et la Vue Panier. Depuis le dossier `mobile` :
```bash
cd mobile
npx expo start
```
*(Ouvrez Expo Go sur votre Mobile ou le simulateur iOS/Android pour parcourir la Marketplace).*

---

## 🔑 Concepts Métiers Majeurs Implémentés
- **Virtual Float Account** : Moins on sollicite l'USSD chaque matin, mieux c'est. Les utilisateurs chargent 5000 FCFA et payent dans la seconde, sans latence. Les points de fidélité se gagnent automatiquement au rechargement.
- **Facturation Digitale "Ticket" & Scan Sans Faille** : À chaque achat, "Le Boulanger" génère côté serveur un PDF `pdfkit` avec un QR Code. 
- **PIN Offline Résilient** : Pour se prémunir d'une chute de batterie smartphone ou de réseau chez le client, chaque commande génère un code court secret ("A-9492"). Si le client n'a plus de batterie, il dicte sa propre clé et le Livreur valide la transaction manuellement.
- **Récurrence** : Le client peut commander un pain `Tous les jours`. L'enregistrement en base `DAILY` permet aux processus métiers de recréer cette commande la nuit en fond.
- **Positionnement Géographique** : En choisissant Livraison, le client désigne lui-même `Latitude/Longitude` via Google Maps intégrée. Le Livreur en disposera.

Documentation des "Scénarios complets" dans le système interne (Artifacts).
