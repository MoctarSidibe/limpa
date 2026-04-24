# Limpa — Guide de test complet

## Table des matières

1. [Prérequis & démarrage](#1-prérequis--démarrage)
2. [Initialisation de la base de données](#2-initialisation-de-la-base-de-données)
3. [Créer les comptes de test](#3-créer-les-comptes-de-test)
4. [Tests — Application mobile (CLIENT)](#4-tests--application-mobile-client)
5. [Tests — Application mobile (BOULANGER)](#5-tests--application-mobile-boulanger)
6. [Tests — Application mobile (LIVREUR)](#6-tests--application-mobile-livreur)
7. [Tests — Dashboard Boulanger (PWA)](#7-tests--dashboard-boulanger-pwa)
8. [Tests — Dashboard Admin (PWA)](#8-tests--dashboard-admin-pwa)
9. [Tests — Backend (API directe)](#9-tests--backend-api-directe)
10. [Scénarios de bout en bout](#10-scénarios-de-bout-en-bout)
11. [Checklist de régression](#11-checklist-de-régression)

---

## 1. Prérequis & démarrage

### Services à démarrer (dans cet ordre)

```bash
# 1. Base de données PostgreSQL — doit tourner avant le backend

# 2. Backend
cd backend
npm run dev          # écoute sur http://localhost:3000

# 3. Dashboard Boulanger (PWA)
cd dashboard
npm run dev          # http://localhost:5173

# 4. Dashboard Admin (PWA)
cd admin-dashboard
npm run dev          # http://localhost:5174

# 5. Application mobile
cd mobile
npx expo start       # scanner le QR avec Expo Go
```

> Raccourci Windows : double-cliquer **START_ALL.bat** à la racine du projet.

### Variables d'environnement requises

| Fichier | Variable | Valeur attendue |
|---|---|---|
| `backend/.env` | `DATABASE_URL` | `postgresql://user:password@localhost:5432/limpa` |
| `backend/.env` | `JWT_SECRET` | n'importe quelle chaîne secrète |
| `admin-dashboard/.env` | `VITE_API_BASE` | `http://localhost:3000` |

---

## 2. Initialisation de la base de données

```bash
cd backend
npx prisma db push      # applique le schéma (dont la nouvelle colonne bakeryId sur Product)
npx prisma generate     # régénère le client TypeScript — OBLIGATOIRE après tout db push
npx prisma studio       # (optionnel) interface visuelle sur http://localhost:5555
```

> **Important :** `prisma generate` est requis à chaque changement de schéma. Sans ça, le backend compile avec les anciens types et peut crasher sur les nouveaux champs.

Au premier démarrage du backend, le seed s'exécute automatiquement :
- **3 boulangeries** (Libreville Centre, Akanda, Le Cocotier)
- **8 produits plateforme** avec catégories (pain, viennoiserie, pâtisserie) — `bakeryId = null`

Vérifier dans les logs du backend :
```
[SEED] 3 boulangeries créées.   ← premier démarrage
[SEED] 8 produits créés.

# ou, si des boulangeries existent déjà :
[SEED] Coordonnées boulangeries mises à jour.
[SEED] 8 produits créés.
```

> **Auto-correction des coordonnées :** Le seed met à jour les adresses et coordonnées des 3 boulangeries à chaque redémarrage du backend. Cela corrige tout conflit de distance issu d'un seed précédent sans avoir à réinitialiser la base.

| Boulangerie | Adresse | Coordonnées | Distance depuis GPS par défaut |
|---|---|---|---|
| La Mie Câline - Libreville Centre | Boulevard Triomphal Omar Bongo, Centre-Ville | 0.4180 / 9.4680 | ~0.2 km → **aucune surcharge** |
| Pâtisserie Le Cocotier | Rue des Cocotiers, Quartier Louis | 0.4500 / 9.4200 | ~6.5 km → **+~1 900 FCFA** |
| La Mie Câline - Akanda | Route d'Angondjé, Carrefour Akanda | 0.5052 / 9.4893 | ~10 km → **+~2 900 FCFA** |

---

## 3. Créer les comptes de test

### Créer un compte ADMIN initial (une seule fois)

```bash
cd backend
node -e "
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const pin = crypto.createHash('sha256').update('1234').digest('hex');
prisma.user.create({ data: { phoneNumber: '000000000', name: 'Admin', pin, role: 'ADMIN', virtualCard: { create: { balance: 0, points: 0 } } } })
  .then(u => { console.log('Admin créé:', u.id); return prisma.\$disconnect(); })
  .finally(() => pool.end());
"
```

> Identifiants admin : téléphone `000000000`, PIN `1234`

### Via l'Admin Dashboard (`http://localhost:5174`)

Une fois connecté en admin, créer les comptes suivants via **Personnel → Nouveau personnel** :

| Rôle | Téléphone | PIN | Boulangerie |
|---|---|---|---|
| BAKER | `077111111` | `1111` | La Mie Câline - Libreville Centre |
| LIVREUR | `077222222` | `2222` | — |

### Compte CLIENT (via l'app mobile)

- Se créer un compte depuis l'écran d'inscription
- Téléphone : `077333333` · PIN : `3333`

---

## 4. Tests — Application mobile (CLIENT)

> **Comment naviguer :** L'app s'ouvre sur le splash, puis redirige vers **Connexion**. Après connexion d'un CLIENT, 3 onglets sont visibles en bas : 🏠 Accueil · 🛒 Panier · 💰 Portefeuille. Un 4e onglet 📦 Commandes est accessible depuis Portefeuille.

### 4.1 Inscription / Connexion

> **Écran :** Écran de lancement → Connexion (`/login`) · Inscription (`/register`)

| # | Action | Résultat attendu |
|---|---|---|
| 1 | Ouvrir l'app — attendre le splash (3 s) puis redirection auto vers **Connexion** | Écran de connexion visible avec logo Limpa animé |
| 2 | Appuyer "Créer un compte" → remplir nom, téléphone, PIN 4 chiffres, confirmer PIN | Compte créé, redirigé vers l'onglet **Accueil** |
| 3 | Se déconnecter (via Portefeuille → icône déconnexion), puis se reconnecter | Connexion réussie, solde = 0 F |
| 4 | Sur l'écran **Connexion**, essayer un mauvais PIN | Alerte "Connexion échouée" |

### 4.2 Catalogue produits (plateforme)

> **Écran :** Onglet **Accueil** 🏠 (premier onglet en bas à gauche)

| # | Action | Résultat attendu |
|---|---|---|
| 5 | Ouvrir l'onglet **Accueil** | 8 produits plateforme chargés depuis le backend |
| 6 | Appuyer sur un filtre de catégorie (Pain, Viennoiseries, Pâtisseries) | Produits de la liste filtrés selon la catégorie |
| 7 | Appuyer "Tout" | Tous les 8 produits visibles |
| 8 | Tirer vers le bas (pull-to-refresh) | Spinner visible, liste rechargée |

### 4.3 Spécialités maison (apparaissent après géolocalisation)

> **Écran :** Onglet **Accueil** 🏠 — section horizontale au-dessus des produits normaux
>
> **Prérequis :** Le boulanger `077111111` doit avoir créé au moins une spécialité sur le **Dashboard Boulanger** (`http://localhost:5173`) → onglet "✨ Mes Spécialités" avant ce test.

| # | Action | Résultat attendu |
|---|---|---|
| 9 | Ouvrir (ou tirer pour rafraîchir) l'onglet **Accueil** — autoriser la géolocalisation si demandé | Pas de blocage, l'app continue de charger |
| 10 | Attendre 2–4 secondes sur l'onglet **Accueil** | Section "✨ Spécialités — La Mie Câline…" apparaît en scroll horizontal au-dessus des produits normaux |
| 11 | Faire défiler horizontalement la section ✨ | Cartes compactes (148 px) avec image, nom, prix et bouton "Ajouter" |
| 12 | Sélectionner un filtre de catégorie (ex : Viennoiseries) sur l'onglet **Accueil** | Seules les spécialités de cette catégorie restent visibles dans la section ✨ |
| 13 | Appuyer "Ajouter" sur une spécialité | Badge numérique orange sur la carte, alerte "🛒 Ajouté !" |
| 14 | Désactiver la localisation dans les réglages système puis tirer pour rafraîchir | Section ✨ absente — uniquement les produits plateforme visibles (dégradation gracieuse) |

### 4.4 Panier — commande avec produit plateforme

> **Écran :** Onglet **Accueil** 🏠 pour ajouter → Onglet **Panier** 🛒 pour valider

| # | Action | Résultat attendu |
|---|---|---|
| 15 | Sur l'onglet **Accueil**, ajouter 2 croissants et 1 baguette | Compteur du badge panier mis à jour |
| 16 | Passer à l'onglet **Panier** | Articles listés avec sous-total correct |
| 17 | Dans l'onglet **Panier**, sélectionner "En boutique" | Pas de champ adresse requis |
| 18 | Vérifier le sélecteur de boulangerie dans l'onglet **Panier** | Bouton "Changer" visible — l'utilisateur peut choisir librement |
| 19 | Appuyer "Valider la commande" sans avoir rechargé le portefeuille | Alerte "Solde insuffisant" |

### 4.4b Carte — marqueurs multi-boulangeries

> **Écran :** Onglet **Panier** 🛒 → section "Position / Livraison", carte OpenStreetMap
>
> **Prérequis :** Panier avec articles de 2 boulangeries distinctes (spécialités) en mode **En boutique**.

| # | Action | Résultat attendu |
|---|---|---|
| 19b | Panier avec 1 seul type d'article (plateforme ou 1 spécialité) — regarder la carte | Carte hauteur **220 px**, un seul marqueur 📍 (position utilisateur), zoom 15 |
| 19c | Panier avec articles de **2 boulangeries** en mode **En boutique** | Carte hauteur **300 px**, marqueur 📍 utilisateur + cercles numérotés **①②** pour chaque boulangerie |
| 19d | Boulangerie la plus proche | Cercle **vert** (①) — boulangerie sans surcharge |
| 19e | Boulangerie(s) plus éloignée(s) | Cercle(s) **orange** (②③…) — boulangeries avec surcharge |
| 19f | Appuyer sur un cercle boulangerie | Popup avec nom de la boulangerie et mention "✓ La plus proche" si applicable |
| 19g | Passer en mode **Livraison** avec le même panier multi-boulangeries | Cercles boulangeries disparaissent — seul le marqueur 🏠 adresse de livraison reste |
| 19h | Carte s'est chargée avec GPS — déplacer la carte | Marqueur 📍 suit le centre de la carte, postMessage envoyé au backend |

### 4.5 Panier — commande avec spécialité maison (mono et multi-boulangerie)

> **Écran :** Onglet **Accueil** 🏠 pour ajouter la spécialité → Onglet **Panier** 🛒 pour vérifier

| # | Action | Résultat attendu |
|---|---|---|
| 20 | Sur l'onglet **Accueil**, ajouter une spécialité maison (bakeryId non null) | Badge du panier mis à jour |
| 21 | Passer à l'onglet **Panier** | Article spécialité visible normalement dans la liste |
| 22 | Dans l'onglet **Panier**, regarder la ligne boulangerie | Mention **"✨ Auto"** — boulangerie verrouillée automatiquement selon la spécialité |
| 23 | Retourner sur l'onglet **Accueil**, ajouter une spécialité d'une **autre** boulangerie, revenir au **Panier** | Ligne boulangerie affiche **"N boulangeries · Affectation automatique"** — pas de blocage |
| 24 | Avec solde suffisant, valider dans l'onglet **Panier** avec articles de 2 boulangeries différentes | **N commandes distinctes** créées (une par boulangerie), écran de succès liste chaque code retrait avec la boulangerie correspondante |
| 25 | Sur l'écran de succès après commande multi-boulangerie | Blocs "Commande 1/N", "Commande 2/N"… avec boulangerie, code retrait, et bouton PDF par commande |

### 4.5b Panneau multi-boulangeries — distinction visuelle spécialité / plateforme

> **Écran :** Onglet **Panier** 🛒 → panneau orange **"N points de retrait"** (affiché automatiquement quand `totalPickups > 1`)
>
> **Prérequis :** Panier mixte — au moins une spécialité (bakeryId non null) **et** au moins un produit plateforme (bakeryId null).

| # | Action | Résultat attendu |
|---|---|---|
| 25b | Panneau "N points de retrait" visible sous la section boulangerie | En-tête orange avec icône branche, sous-titre "préparée par N boulangeries distinctes" |
| 25c | Ligne correspondant à la **spécialité** | Fond **violet pâle** (`#FDF4FF`), bordure violette, icône ✨, badge **"✦ SPÉCIALISÉ"** en violet |
| 25d | Ligne correspondant aux articles **plateforme** | Fond **bleu pâle** (`#F0F9FF`), bordure bleue, icône 🏪, badge **"● PARTENAIRE"** en bleu |
| 25e | Prix de chaque article dans la ligne spécialité | Montant affiché en **violet** (#7C3AED) aligné à droite |
| 25f | Prix de chaque article dans la ligne plateforme | Montant affiché en **bleu** (#2563EB) aligné à droite |
| 25g | Bulle d'info en bas du panneau — mode **En boutique** | "Vous recevrez N codes de retrait distincts…" (icône 🎟) |
| 25h | Bulle d'info en bas du panneau — mode **Livraison** | "Un livreur passera récupérer chaque commande…" (icône 🚲) |

### 4.6 Recharge du portefeuille

> **Écran :** Onglet **Portefeuille** 💰 → bouton "Recharger"

| # | Action | Résultat attendu |
|---|---|---|
| 25 | Passer à l'onglet **Portefeuille**, appuyer "Recharger" | Options Airtel Money et Moov Money affichées |
| 26 | Entrer 5 000 F, choisir Airtel Money, confirmer | Spinner ~2,5 s puis succès (85 % de chances) ou échec simulé |
| 27 | En cas de succès : revenir à l'onglet **Portefeuille** | Solde = 5 000 F, points gagnés affichés |
| 28 | Sur l'onglet **Portefeuille**, consulter l'onglet "Historique" | Ligne "Rechargement via AIRTEL MONEY" visible |

### 4.7 Commande avec géolocalisation

> **Écran :** Onglet **Panier** 🛒 (articles déjà ajoutés depuis l'onglet **Accueil**)

| # | Action | Résultat attendu |
|---|---|---|
| 29 | Dans l'onglet **Panier**, autoriser la géolocalisation si demandé | Boulangeries listées avec distance en km |
| 30 | Dans l'onglet **Panier**, sélectionner la boulangerie la plus proche | Frais de service = 0 F |
| 31 | Changer pour une boulangerie plus éloignée | Frais de service calculés (300 FCFA/km au-delà de la plus proche) |
| 32 | Valider la commande | Écran de succès avec code retrait (ex : `ABC-456`) |
| 33 | Revenir à l'onglet **Portefeuille** → onglet "Commandes" | Nouvelle commande avec statut "En attente" |

### 4.8 Code promo

> **Écran :** Admin Dashboard (`http://localhost:5174`) pour créer le coupon → Onglet **Panier** 🛒 pour l'appliquer → Onglet **Portefeuille** pour vérifier

| # | Action | Résultat attendu |
|---|---|---|
| 34 | Sur le **Dashboard Admin** → onglet "Codes Promo", créer `TEST20` (20 %, illimité) | Coupon visible dans la liste |
| 35 | Sur le mobile, onglet **Panier**, entrer `TEST20` et appuyer "Appliquer" | Réduction affichée en vert, total recalculé |
| 36 | Dans l'onglet **Panier**, entrer un code invalide (`FAUX`) | Message d'erreur rouge sous le champ |
| 37 | Dans l'onglet **Panier**, appuyer "Retirer" sur le coupon appliqué | Réduction annulée, total original restauré |
| 38 | Dans l'onglet **Panier**, valider avec `TEST20` actif | Total final = sous-total + frais − réduction |
| 39 | Sur l'onglet **Portefeuille** → "Commandes", ouvrir le modal de la commande | Ligne "Code promo (TEST20)" avec montant en vert |

### 4.9 Régalez un proche (cadeau)

> **Écran :** Onglet **Panier** 🛒 → section **"Régalez un proche"** (juste après "Mode de réception", avant la carte) · Onglet **Portefeuille** → "Commandes" pour vérifier

| # | Action | Résultat attendu |
|---|---|---|
| 40 | Dans l'onglet **Panier**, repérer la section "Régalez un proche" | Section visible **entre** "Mode de réception" et la carte — icône ❤️, texte "C'est un cadeau ?" |
| 41 | Appuyer sur le toggle iOS à droite | Toggle passe au **rose/pink** (#EC4899), fond de la section devient rose pâle (#FFF5F7), titre change en "Pour quelqu'un de spécial ❤️" |
| 42 | Remplir le champ "Prénom & nom du proche" | Titre de la section se met à jour dynamiquement : "Pour [Prénom] ❤️" |
| 43 | Vérifier le sous-texte contextuel en mode **En boutique** | "Votre proche récupèrera la commande à la boulangerie avec son code." |
| 44 | Passer en mode **Livraison** avec le toggle actif | Sous-texte change : "La commande sera livrée à l'adresse indiquée sur la carte ci-dessus." |
| 45 | Vérifier que l'indice de la carte change aussi | Ligne 1 : "🎁 Adresse du proche · [nom rue ou Glissez la carte]" / Ligne 2 : "Un livreur déposera cette commande ici pour votre proche." |
| 46 | Désactiver le toggle | Fond redevient neutre, champs Nom/Téléphone masqués, titre revient à "C'est un cadeau ?" |
| 47 | Tenter de valider sans remplir Nom ou Téléphone (toggle actif) | Alerte "Veuillez remplir le nom et le numéro de téléphone de la personne…" |
| 48 | Remplir les champs et valider | Commande créée, redirection vers l'écran de succès |
| 49 | Sur l'onglet **Portefeuille** → "Commandes", ouvrir le modal | Bandeau orange "Commande cadeau pour : [Nom] ([Téléphone])" visible |

### 4.10 Retrait planifié

> **Écran :** Onglet **Panier** 🛒 → section "Quand ?"

| # | Action | Résultat attendu |
|---|---|---|
| 43 | Dans l'onglet **Panier**, sélectionner "Programmer" | Sélecteur de date/heure apparaît |
| 44 | Choisir une date future et valider | Commande créée avec `scheduledFor` renseigné, visible dans l'historique |

### 4.11 Commande récurrente ("Tous les jours")

> **Écran :** Onglet **Panier** 🛒 → section "Fréquence" · Onglet **Portefeuille** → onglet "Commandes"

| # | Action | Résultat attendu |
|---|---|---|
| 45 | Dans l'onglet **Panier**, regarder la section "Fréquence" | Deux pills uniquement : **"Une fois"** et **"Tous les jours"** (pas de "Hebdo") |
| 46 | Sélectionner **"Tous les jours"** | Pill orange activée ; boîte amber s'affiche en dessous avec icône 🔁 |
| 47 | Lire la boîte amber | Texte : "Renouvellement automatique — votre commande sera renouvelée chaque jour… débité de votre portefeuille. Gérez ou annulez depuis **Portefeuille → Commandes**." |
| 48 | Vérifier le récapitulatif en bas de l'écran | Libellé de la ligne total devient **"Total / jour"** au lieu de "Total à payer" |
| 49 | Valider avec solde suffisant | Commande créée, `recurrence = DAILY`, `nextRecurrenceAt` = maintenant + 24 h (vérifier via `npx prisma studio`) |
| 50 | Aller sur l'onglet **Portefeuille** → onglet **"Commandes"** | Badge **"🔁 Quotidien"** visible sur la commande récurrente |
| 51 | Lire la ligne date sous le badge | "Prochain renouvellement : [date + heure]" affichée en orange |
| 52 | Appuyer **"Annuler l'abonnement"** (bouton rouge pâle) | Dialog de confirmation "Annuler l'abonnement ?" apparaît |
| 53 | Confirmer l'annulation | Appel `DELETE /api/order/:id/recurrence` — badge "🔁 Quotidien" et date de renouvellement disparaissent de la carte |
| 54 | (Simulation cron) Via `npx prisma studio`, mettre `nextRecurrenceAt` à une date passée puis redémarrer le backend | Nouvelle commande identique créée automatiquement, push reçu : "🥐 Renouvellement quotidien — Votre commande a été renouvelée…" |
| 55 | (Simulation solde insuffisant) Mettre le solde à 0 via `npx prisma studio` avant le cron | Push reçu : "⚠️ Renouvellement impossible — Solde insuffisant…" — aucune commande créée |

### 4.12 Points fidélité

> **Écran :** Onglet **Portefeuille** 💰 → onglet "Points"

| # | Action | Résultat attendu |
|---|---|---|
| 56 | Sur l'onglet **Portefeuille**, recharger 10 000 F | 100 points crédités (1 point / 100 F) |
| 57 | Sur l'onglet **Portefeuille**, passer à l'onglet "Points" | Solde points visible, taux "1 point = 10 FCFA" affiché |
| 58 | Dans l'onglet "Points", entrer 100 et appuyer "Convertir" | 1 000 FCFA ajoutés au solde, 100 points déduits |
| 59 | Essayer de convertir avec moins de 100 points | Message "Minimum 100 points requis" |

### 4.13 Onglet Portefeuille — 4 segments

> **Écran :** Onglet **Portefeuille** 💰 — barre de segments sous la carte virtuelle

| # | Action | Résultat attendu |
|---|---|---|
| 60 | Regarder la barre de segments | 4 onglets : **Recharger · Points · Historique · Commandes** |
| 61 | Appuyer **"Historique"** | Toutes les transactions (recharges et débits commandes) en ordre antichronologique |
| 62 | Appuyer **"Commandes"** | Chargement des commandes depuis `GET /api/user/:userId/orders` — spinner visible |
| 63 | Liste des commandes chargée | Cartes avec : nom boulangerie, badge statut coloré, date, items résumés, total |
| 64 | Commande avec `recurrence = DAILY` et `nextRecurrenceAt` non null | Badge **"🔁 Quotidien"** orange en haut de la carte + date de prochain renouvellement |
| 65 | Commande simple (non récurrente) | Pas de badge 🔁, pas de bouton annulation |
| 66 | Appuyer "Annuler l'abonnement" sur une commande récurrente | Dialog "Annuler l'abonnement ?" avec bouton destructif rouge |
| 67 | Confirmer → `DELETE /api/order/:id/recurrence` répond 200 | Badge 🔁 et ligne date disparaissent, alerte "Abonnement annulé" affichée |
| 68 | Retourner sur l'onglet **"Commandes"** après annulation | Commande toujours visible mais sans badge récurrent |

### 4.14 À propos

> **Écran :** Onglet **Portefeuille** 💰 → icône ℹ️ en haut à droite

| # | Action | Résultat attendu |
|---|---|---|
| 55 | Sur l'onglet **Portefeuille**, appuyer l'icône "À propos" (ℹ️) | Écran avec version de l'app, fonctionnalités, email support |

---

## 5. Tests — Application mobile (BOULANGER)

> **Comment naviguer :** Se connecter avec `077111111` / `1111`. Un seul onglet est visible : **Terminal Boulanger** 🍞. Le bouton de déconnexion (↪) se trouve en haut à droite du header.
>
> **Écran :** Onglet **Terminal Boulanger** (unique onglet du rôle BAKER)
>
> **Flux complet :** PENDING → CONFIRMED → READY → DELIVERED (retrait) ou → PICKED_UP → DELIVERED (livraison)

### KPI Strip & affichage

| # | Action | Résultat attendu |
|---|---|---|
| 56 | Connexion avec `077111111` / `1111` | Onglet **Terminal Boulanger** uniquement visible, aucun autre onglet |
| 57 | Regarder la bande KPI en haut de l'écran | 4 compteurs : **Nouvelles** (ambre) · **En prépa** (bleu) · **Prêtes** (vert) · **En route** (violet) |
| 58 | Barre verte "CA aujourd'hui" sous les KPIs | Chiffre d'affaires du jour en FCFA affiché + compteur de synchro "Sync dans Xs" |

### Flux commande RETRAIT (pickup)

| # | Action | Résultat attendu |
|---|---|---|
| 59 | Une commande PENDING arrive (passée depuis le compte CLIENT) | Bandeau ambre "X nouvelle(s) commande(s)" + carte **NOUVELLE** bordure ambre en tête de liste |
| 60 | Appuyer **"Accepter la commande"** (bouton ambre) | Statut passe à CONFIRMED, carte passe en bleu, client reçoit push "En cours de préparation" |
| 61 | Commande en CONFIRMED — regarder le bouton | Bouton vert **"Commande prête"** visible (ou "Prête — Libérer pour livreur" si livraison) |
| 62 | Appuyer **"Commande prête"** | Statut passe à READY, carte passe en vert, client reçoit push "Prête à récupérer" |
| 63 | Commande READY retrait — regarder les options | Bouton dégradé **"Remettre au client"** sur la carte + FAB **"Saisir le Code Client"** en bas |
| 64 | Appuyer le FAB **"Saisir le Code Client"** | Modal s'ouvre avec champ code client (ex : `ABC-123`) |
| 65 | Saisir le bon code retrait → appuyer "Remettre au client ✓" | Commande disparaît de la liste (DELIVERED), solde client déduit |
| 66 | Saisir un code invalide ou d'une commande pas encore READY | Alerte "Code introuvable — assurez-vous que la commande est marquée Prête" |

### Flux commande LIVRAISON (delivery)

| # | Action | Résultat attendu |
|---|---|---|
| 67 | Commande livraison CONFIRMED → appuyer **"Prête — Libérer pour livreur"** | Statut READY, livreurs peuvent maintenant voir et accepter la commande |
| 68 | Commande READY livraison, aucun livreur encore | Badge gris **"En attente d'un livreur…"** sur la carte (pas de bouton d'action) |
| 69 | Un livreur accepte la commande depuis son app | Badge de la carte passe à **"🛵 Livreur en route"**, nom du livreur affiché en bleu |
| 70 | Livreur arrivé à la boulangerie — appuyer **"Confirmer remise au livreur"** (bouton bleu) | Dialog de confirmation apparaît |
| 71 | Confirmer dans le dialog | Statut passe à PICKED_UP, carte passe en violet, livreur notifié (push) |
| 72 | Carte PICKED_UP | Badge violet **"🚀 EN LIVRAISON · [Nom livreur]"**, aucun bouton d'action supplémentaire |

### Général

| # | Action | Résultat attendu |
|---|---|---|
| 73 | Tirer vers le bas dans la liste | Rafraîchissement des commandes |
| 74 | Couper le réseau, valider un retrait client | Validation enregistrée hors-ligne, bandeau jaune "X validation(s) hors-ligne en attente" |
| 75 | Rétablir le réseau | Synchronisation automatique au redémarrage, bandeau disparaît |
| 76 | Appuyer ↪ en haut à droite du header → confirmer | Déconnexion et retour à l'écran **Connexion** |

---

## 6. Tests — Application mobile (LIVREUR)

> **Comment naviguer :** Se connecter avec `077222222` / `2222`. Un seul onglet est visible : **Espace Livreur** 🛵. Le bouton de déconnexion (↪) se trouve en haut à droite du header.
>
> **Écran :** Onglet **Espace Livreur** (unique onglet du rôle COURIER)
>
> **Important :** Le livreur ne voit les commandes que lorsqu'elles sont à l'état **READY** (le boulanger a cliqué "Prête — Libérer pour livreur"). Le livreur ne peut compléter la livraison qu'après que le boulanger a confirmé la remise physique (→ PICKED_UP).

| # | Action | Résultat attendu |
|---|---|---|
| 77 | Connexion avec `077222222` / `2222` | Onglet **Espace Livreur** uniquement visible, aucun autre onglet |
| 78 | Carte OSM en haut de l'écran | Carte chargée, marqueur 🚴 sur la position du livreur |
| 79 | GPS du livreur actif | Position envoyée au backend toutes les 30 s (vérifier logs backend : `PUT /api/courier/location`) |
| 80 | Sous-onglet **"Disponibles"** | Commandes `READY` sans livreur assigné visibles avec adresse, total et adresse boulangerie |
| 81 | Sous-titre de l'onglet | "X disponible(s) · Y en cours" (Y = mes READY + PICKED_UP) |
| 82 | Appuyer le bouton 👋 sur une livraison disponible → confirmer | Livraison déplacée dans "Mes livraisons" avec badge ambre **"À RÉCUPÉRER"** — statut reste READY |
| 83 | Sous-onglet **"Mes livraisons"** — carte avec badge "À RÉCUPÉRER" | Icône horloge, adresse de la boulangerie visible — se rendre à la boulangerie |
| 84 | Tenter d'appuyer ✓ "Livraison effectuée" sur une commande **À RÉCUPÉRER** (statut READY) | Alerte bloquante : "La boulangerie doit d'abord confirmer la remise physique" |
| 85 | Le boulanger confirme la remise physique (clique "Confirmer remise au livreur") | Carte passe au badge vert **"EN LIVRAISON"**, bouton vert "Livraison effectuée" activé |
| 86 | Appuyer ✓ **"Livraison effectuée"** → confirmer | Statut DELIVERED, client notifié (push), livraison retirée de "Mes livraisons" |
| 87 | Appuyer ↪ en haut à droite du header → confirmer | Déconnexion et retour à l'écran **Connexion** |

---

## 7. Tests — Dashboard Boulanger (PWA)

> **URL :** `http://localhost:5173` · Connexion avec `077111111` / `1111`

### 7.1 Commandes en cours et historique

> **Écran :** Onglet **"📋 Commandes en cours"** (affiché par défaut à la connexion)
>
> **Flux complet PWA :** PENDING → CONFIRMED → READY → DELIVERED (retrait) ou → PICKED_UP (attente livreur) → DELIVERED

| # | Action | Résultat attendu |
|---|---|---|
| 88 | Connexion sur `http://localhost:5173` | Dashboard chargé, filtré sur la boulangerie du boulanger connecté |
| 89 | Onglet **Commandes en cours** — commandes PENDING | Cartes avec fond ambre et badge **PENDING**, bouton **"Accepter la commande"** |
| 90 | Cliquer **"Accepter la commande"** | Statut passe à CONFIRMED, fond de la carte change, badge **CONFIRMED** visible |
| 91 | Commandes CONFIRMED — regarder les boutons | Pour retrait : bouton **"Commande prête"** · Pour livraison : bouton **"Prête — Libérer pour livreur"** |
| 92 | Cliquer **"Commande prête"** (retrait) | Statut passe à READY, client notifié push "Prête à récupérer" |
| 93 | Commande READY retrait — valider avec le bon code | Entrer le code retrait du client → commande DELIVERED, retirée des en cours |
| 94 | Entrer un mauvais code retrait | Erreur "Code incorrect" affichée |
| 95 | Cliquer **"Prête — Libérer pour livreur"** (livraison) | Statut READY, badge **PRÊTE** vert, commande visible pour les livreurs |
| 96 | Commande READY livraison, pas encore de livreur | Bouton gris **"⏳ En attente d'un livreur…"** — aucune action disponible |
| 97 | Un livreur accepte la commande | Bouton bleu **"Confirmer remise au livreur"** apparaît, nom du livreur affiché |
| 98 | Cliquer **"Confirmer remise au livreur"** | Dialog de confirmation → valider → statut PICKED_UP, badge **EN LIVRAISON**, livreur notifié |
| 99 | Commande PICKED_UP | Mention **"🚀 En livraison par [Nom livreur]"** — aucun bouton d'action |
| 100 | Cliquer l'onglet **"📜 Historique"** | Commandes livrées aujourd'hui listées |
| 101 | Laisser le dashboard ouvert 30 s sans action | Nouvelles commandes apparaissent automatiquement (polling 30 s) |

### 7.2 Mes Spécialités Maison

> **Écran :** Onglet **"✨ Mes Spécialités"** (3e onglet dans la barre de navigation)

| # | Action | Résultat attendu |
|---|---|---|
| 78 | Cliquer l'onglet **"✨ Mes Spécialités"** | Panneau vide avec message "Aucune spécialité pour l'instant." |
| 79 | Cliquer "+ Ajouter une spécialité" | **Modal centré** avec titre "✨ Nouvelle spécialité", fond flouté, bouton ✕ |
| 80 | Dans le **modal**, cliquer la zone photo 📷 | Sélecteur de fichier natif s'ouvre |
| 81 | Choisir `croissant.png` (racine du projet) | Prévisualisation instantanée dans le modal, upload en arrière-plan |
| 82 | Dans le **modal**, remplir Nom="Brioche Maison", Prix=1500, Catégorie=Viennoiserie | Champs Nom+Prix côte à côte, catégorie sélectionnée |
| 83 | Cliquer "✨ Créer la spécialité" | Modal se ferme, carte apparaît avec badge **🟢 Actif** et photo réelle |
| 84 | Créer une 2e spécialité sans photo (catégorie=Pâtisserie) | Icône 📷 en placeholder sur la carte |
| 85 | Cliquer "✏️ Modifier" sur la première carte | Modal pré-rempli avec photo existante visible |
| 86 | Dans le **modal**, changer le prix à 1800 et sauvegarder | Carte mise à jour avec le nouveau prix |
| 87 | Cliquer "🗑" sur une carte | Confirmation navigateur, puis carte supprimée de la grille |
| 88 | Cliquer "+ Ajouter" et tenter de sauvegarder sans nom | Alerte "Nom et prix requis." |
| 89 | Tenter de créer avec prix = 0 ou négatif | Alerte "Prix invalide." |
| 90 | Se connecter avec un boulanger d'une **autre** boulangerie | Ne voit PAS les spécialités du premier boulanger |

---

## 8. Tests — Dashboard Admin (PWA)

> **URL :** `http://localhost:5174` · Connexion avec `000000000` / `1234`

### 8.1 Vue d'ensemble

> **Écran :** Onglet **"Vue d'ensemble"** (affiché par défaut à la connexion)

| # | Action | Résultat attendu |
|---|---|---|
| 91 | Connexion sur `http://localhost:5174` | Onglet **Vue d'ensemble** chargé avec KPIs |
| 92 | Section "Activité du jour" | 3 cartes : CA du jour · Commandes du jour · En attente |
| 93 | Section "Équipe & Réseau" | 4 cartes : Clients (+X aujourd'hui) · Boulangeries · Boulangers · Livreurs actifs (actifs/total) |
| 94 | Tableau "Commandes récentes" | 5 dernières commandes toutes statuts confondus |
| 95 | Tableau "Top Produits" | Classement par volume vendu aujourd'hui |
| 96 | Bandeau rouge en haut (si livraison sans livreur > 5 min) | "X livraison(s) sans livreur depuis plus de 5 min" avec codes commande |

### 8.2 Gestion des commandes

> **Écran :** Onglet **"Commandes"** dans la barre de navigation gauche

| # | Action | Résultat attendu |
|---|---|---|
| 97 | Cliquer l'onglet **"Commandes"** | Toutes les commandes avec filtres en haut |
| 98 | Filtrer par statut "PENDING" | Uniquement commandes en attente |
| 99 | Filtrer par date d'aujourd'hui | Commandes du jour uniquement |
| 100 | Rechercher par code retrait | Commande trouvée instantanément |
| 101 | Cliquer l'icône 👁 d'une commande | Modal détails : articles, client, total, frais, statut, code retrait |
| 102 | Commande DELIVERY sans livreur | Icône camion 🚚 visible → cliquer pour ouvrir l'assignation |
| 103 | Sélectionner un livreur et confirmer | Livreur notifié (push), `courierId` enregistré |

### 8.3 Catalogue produits

> **Écran :** Onglet **"Produits"** dans la barre de navigation gauche

| # | Action | Résultat attendu |
|---|---|---|
| 104 | Cliquer l'onglet **"Produits"** | Résumé "X produit(s) plateforme · Y spécialité(s)" visible en haut |
| 105 | Tableau des produits | Colonne **Illustration** : photo réelle ou emoji legacy. Colonne **Type** : badge "🌐 Plateforme" ou "🏪 [NomBoulangerie]" |
| 106 | Lignes de type spécialité | Bouton ✏️ **absent** (modération seulement), bouton 🗑 présent |
| 107 | Cliquer "🌐 Nouveau produit plateforme" | **Modal centré** avec zone photo 📷, champs Nom+Prix, Catégorie, Description |
| 108 | Dans le **modal**, cliquer la zone photo → choisir `croissant.png` | Prévisualisation 180 px dans le modal, upload automatique |
| 109 | Choisir un fichier > 50 Mo | Alerte "Image trop lourde (max 50 Mo)." — upload bloqué |
| 110 | Choisir un fichier PDF | Alerte "Format non valide. Choisissez une image." |
| 111 | Créer le produit | Tableau mis à jour, miniature réelle dans la colonne Illustration |
| 112 | Cliquer ✏️ sur un produit plateforme | Modal pré-rempli avec photo existante |
| 113 | Modifier la photo et sauvegarder | Nouvelle miniature visible dans le tableau |
| 114 | Supprimer un produit sans commande | Suppression confirmée, retiré du tableau |
| 115 | Supprimer un produit référencé dans des commandes | Erreur "référencé dans X commande(s)" |

### 8.4 Boulangeries (nœuds logistiques)

> **Écran :** Onglet **"Boulangeries"** dans la barre de navigation gauche

| # | Action | Résultat attendu |
|---|---|---|
| 116 | Cliquer l'onglet **"Boulangeries"** | 3 boulangeries seedées visibles avec adresse et coordonnées |
| 117 | Cliquer "Nouveau nœud" | Formulaire avec nom, adresse, latitude, longitude |
| 118 | Créer un nœud à Owendo (lat : 0.2882, lng : 9.5090) | Visible dans la liste et utilisable dans l'app mobile |

### 8.5 Gestion du personnel

> **Écran :** Onglet **"Personnel"** dans la barre de navigation gauche

| # | Action | Résultat attendu |
|---|---|---|
| 119 | Cliquer l'onglet **"Personnel"** | Liste boulangers + livreurs + admins avec rôle et statut |
| 120 | Filtrer par rôle "Livreur" | Uniquement les livreurs affichés |
| 121 | Cliquer "Nouveau personnel" → remplir pour un Boulanger | Formulaire avec sélection de boulangerie obligatoire |
| 122 | Créer le boulanger | Compte créé, visible dans la liste avec badge "Actif" |
| 123 | Créer un livreur | Compte créé sans boulangerie assignée |
| 124 | Cliquer le toggle pour désactiver un compte | Badge "Inactif", connexion refusée sur le mobile |
| 125 | Réactiver le compte | Badge "Actif", connexion acceptée |

### 8.6 Suivi des livraisons

> **Écran :** Onglet **"Livraisons"** dans la barre de navigation gauche

| # | Action | Résultat attendu |
|---|---|---|
| 126 | Cliquer l'onglet **"Livraisons"** | Carte Leaflet avec KPIs au-dessus (Sans livreur / En cours / Livrées) |
| 127 | Marqueur 📦 rouge sur la carte | Position de destination d'une commande CONFIRMED en livraison |
| 128 | Marqueur 🚴 bleu sur la carte | Position GPS en direct du livreur (mise à jour toutes les 30 s) |
| 129 | Cliquer un marqueur | Popup avec code commande ou nom du livreur |
| 130 | Ligne en rouge dans le tableau sous la carte | Livraison CONFIRMED sans `courierId` depuis > 5 min |
| 131 | Cliquer "Assigner" sur une ligne rouge | Modal de sélection du livreur disponible |

### 8.7 Codes promo

> **Écran :** Onglet **"Codes Promo"** dans la barre de navigation gauche

| # | Action | Résultat attendu |
|---|---|---|
| 132 | Cliquer l'onglet **"Codes Promo"** | Liste vide au départ |
| 133 | Cliquer "Créer un coupon" | Modal avec champs Code, Type (%), Valeur, Max utilisations |
| 134 | Créer `BIENVENUE10` (10 %, illimité) | Coupon visible avec statut "Actif" |
| 135 | Créer `REMISE500` (FIXE 500 FCFA, max 50) | Coupon visible avec colonne "Max" = 50 |
| 136 | Créer un code en minuscules (`test`) | Code stocké et affiché en majuscules (`TEST`) |
| 137 | Créer un code déjà existant | Erreur "Ce code promo existe déjà" |
| 138 | Cliquer le toggle de `BIENVENUE10` pour le désactiver | Badge "Inactif", coupon rejeté dans l'app mobile |
| 139 | Réactiver le coupon | Badge "Actif", coupon accepté à nouveau |
| 140 | Cliquer 🗑 sur `REMISE500` | Coupon retiré de la liste |
| 141 | Utiliser `BIENVENUE10` depuis l'app mobile (onglet **Panier**) | Colonne "Utilisations" passe de 0 à 1 dans cet onglet |

### 8.8 Gestion des clients

> **Écran :** Onglet **"Clients"** dans la barre de navigation gauche

| # | Action | Résultat attendu |
|---|---|---|
| 142 | Cliquer l'onglet **"Clients"** | Tableau avec tous les comptes CLIENT : nom, téléphone, solde, points, commandes, total dépensé |
| 143 | Utiliser le champ de recherche | Filtrage en temps réel par nom ou téléphone |
| 144 | Cliquer 👁 sur un client | Modal détail avec solde wallet, points fidélité et historique |

---

## 9. Tests — Backend (API directe)

Utiliser **curl**, **Postman** ou **Thunder Client**. Remplacer `TOKEN` par un JWT valide.

### Obtenir un JWT

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"000000000","pin":"1234"}'
```

### Endpoints publics

```bash
# Produits plateforme uniquement (pas de spécialités)
curl http://localhost:3000/api/products

# Produits plateforme + spécialités d'une boulangerie
curl "http://localhost:3000/api/products?bakeryId=BAKERY_ID"

# Boulangeries avec distances
curl "http://localhost:3000/api/order/bakeries?lat=0.3925&lng=9.4537"
```

### Endpoints baker (nécessite rôle BAKER ou BOULANGER)

```bash
# Lister ses spécialités
curl http://localhost:3000/api/baker/products \
  -H "Authorization: Bearer BAKER_TOKEN"

# Créer une spécialité
curl -X POST http://localhost:3000/api/baker/products \
  -H "Authorization: Bearer BAKER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Brioche Maison","price":1500,"description":"Brioche dorée au beurre","category":"viennoiserie","image":"croissant"}'

# Modifier une spécialité
curl -X PUT http://localhost:3000/api/baker/products/PRODUCT_ID \
  -H "Authorization: Bearer BAKER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"price":1800}'

# Supprimer une spécialité
curl -X DELETE http://localhost:3000/api/baker/products/PRODUCT_ID \
  -H "Authorization: Bearer BAKER_TOKEN"

# Vérifier qu'un CLIENT ne peut pas accéder aux endpoints baker
curl http://localhost:3000/api/baker/products \
  -H "Authorization: Bearer CLIENT_TOKEN"
# → 403 "Accès réservé aux boulangers."
```

### Endpoints client authentifiés

```bash
# Portefeuille
curl http://localhost:3000/api/user/USER_ID/wallet \
  -H "Authorization: Bearer TOKEN"

# Historique activité
curl http://localhost:3000/api/user/USER_ID/activity \
  -H "Authorization: Bearer TOKEN"

# Historique commandes
curl http://localhost:3000/api/user/USER_ID/orders \
  -H "Authorization: Bearer TOKEN"

# Valider un coupon
curl -X POST http://localhost:3000/api/order/validate-coupon \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"BIENVENUE10","subtotal":2500}'

# Checkout avec spécialité (preferredBakeryId forcé)
curl -X POST http://localhost:3000/api/order/checkout \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID","items":[{"id":"SPECIALTY_ID","quantity":1}],"total":1500,"deliveryType":"PICKUP","recurrence":"NONE","preferredBakeryId":"BAKERY_ID","latitude":0.4180,"longitude":9.4680}'

# Checkout commande quotidienne
curl -X POST http://localhost:3000/api/order/checkout \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID","items":[{"id":"PRODUCT_ID","quantity":1}],"total":700,"deliveryType":"PICKUP","recurrence":"DAILY","latitude":0.4180,"longitude":9.4680}'
# → nextRecurrenceAt = maintenant + 24 h dans la réponse

# Annuler l'abonnement récurrent d'une commande (propriétaire uniquement)
curl -X DELETE http://localhost:3000/api/order/ORDER_ID/recurrence \
  -H "Authorization: Bearer TOKEN"
# → { "success": true }  — recurrence = NONE, nextRecurrenceAt = null

# Tentative d'annulation par un autre utilisateur
curl -X DELETE http://localhost:3000/api/order/ORDER_ID/recurrence \
  -H "Authorization: Bearer OTHER_TOKEN"
# → 403 "Accès refusé."

# Boulangeries avec distances (coordonnées Libreville Centre)
curl "http://localhost:3000/api/order/bakeries?lat=0.4180&lng=9.4680"
# → La Mie Câline Centre ~0.2 km (extraFee=0), Le Cocotier ~6.5 km, Akanda ~10 km
```

### Upload d'image (nécessite un token valide, tout rôle)

```bash
# Upload une image — retourne { url: "/uploads/xxx.png" }
curl -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer TOKEN" \
  -F "image=@croissant.png"

# L'image est ensuite accessible en GET statique :
curl http://localhost:3000/uploads/xxx.png --output test.png

# Sans token → 401
curl -X POST http://localhost:3000/api/upload -F "image=@croissant.png"

# Fichier non-image (ex: .txt) → 400 "Seules les images sont acceptées."
```

> Les images uploadées sont stockées dans `backend/uploads/` sur le serveur. Ce dossier est créé automatiquement au premier upload.

### Stats admin (nécessite rôle ADMIN)

```bash
curl http://localhost:3000/api/admin/stats \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## 10. Scénarios de bout en bout

### Scénario A — Commande pickup simple (produit plateforme)

| Qui | Où | Action |
|---|---|---|
| Client | Mobile → onglet **Portefeuille** | Recharger 5 000 F (Airtel Money) |
| Client | Mobile → onglet **Accueil** | Ajouter 2 croissants (1 400 F) au panier |
| Client | Mobile → onglet **Panier** | Valider en retrait immédiat → écran succès avec code `XYZ-123` |
| Boulanger | Mobile → onglet **Terminal** ou PWA `5173` → **Commandes** | Commande PENDING visible → appuyer **"Accepter la commande"** |
| Client | Mobile → onglet **Portefeuille** → "Commandes" | Statut passe à "En préparation", push reçu |
| Boulanger | Mobile → onglet **Terminal** ou PWA `5173` → **Commandes** | Appuyer **"Commande prête"** → statut READY |
| Client | Mobile → onglet **Portefeuille** → "Commandes" | Statut "Prête", push "Venez récupérer" reçu |
| Boulanger | Mobile → FAB **"Saisir le Code Client"** | Saisir `XYZ-123` → DELIVERED |
| Client | Mobile → onglet **Portefeuille** → "Commandes" | Statut "Livrée", solde = 3 600 F |

### Scénario B — Livraison avec livreur (flux complet 5 états)

| Qui | Où | Action |
|---|---|---|
| Client | Mobile → onglet **Panier** | Commander avec `deliveryType=DELIVERY`, entrer adresse et position GPS |
| Client | Mobile → écran succès | Code retrait + adresse boulangerie affichés |
| Boulanger | Mobile → onglet **Terminal** ou PWA `5173` | Commande PENDING → **"Accepter la commande"** → CONFIRMED |
| Boulanger | Mobile → onglet **Terminal** ou PWA `5173` | **"Prête — Libérer pour livreur"** → READY, client notifié |
| Livreur | Mobile → onglet **Espace Livreur** → **"Disponibles"** | Commande READY visible avec adresse boulangerie et total → appuyer 👋 **Accepter** |
| Livreur | Mobile → onglet **Espace Livreur** → **"Mes livraisons"** | Badge ambre **"À RÉCUPÉRER"** — se rendre à la boulangerie |
| Boulanger | Mobile → onglet **Terminal** ou PWA `5173` | Nom du livreur affiché → appuyer **"Confirmer remise au livreur"** → PICKED_UP |
| Livreur | Mobile → onglet **Espace Livreur** → **"Mes livraisons"** | Badge vert **"EN LIVRAISON"** actif → appuyer ✓ **"Livraison effectuée"** → DELIVERED |
| Client | Mobile → notification push | Push "Commande livrée 🎉" reçu |

### Scénario C — Coupon + cadeau

| Qui | Où | Action |
|---|---|---|
| Admin | Dashboard Admin `5174` → onglet **Codes Promo** | Créer `CADEAU15` (15 %) |
| Client A | Mobile → onglet **Panier** | Activer "Commande cadeau", entrer nom/téléphone de Client B |
| Client A | Mobile → onglet **Panier** | Appliquer `CADEAU15` → total = sous-total × 0,85 |
| Client A | Mobile → onglet **Portefeuille** → "Commandes" | Modal : bandeau cadeau + ligne réduction verte |
| Admin | Dashboard Admin `5174` → onglet **Codes Promo** | Colonne "Utilisations" de `CADEAU15` = 1 |

### Scénario D — Abonnement quotidien (création, renouvellement, push, annulation)

| Qui | Où | Action |
|---|---|---|
| Client | Mobile → onglet **Panier** → section "Fréquence" | Sélectionner **"Tous les jours"** — boîte amber de confirmation visible |
| Client | Mobile → onglet **Panier** | Valider (solde suffisant) — `recurrence = DAILY`, `nextRecurrenceAt` = +24 h |
| Client | Mobile → notification push | Push **"🥐 Renouvellement quotidien"** reçu au moment de la création |
| — | `npx prisma studio` | Vérifier `nextRecurrenceAt` = maintenant + 24 h, `recurrence = DAILY` |
| Admin | `npx prisma studio` | Mettre `nextRecurrenceAt` à une date passée pour simuler l'échéance |
| — | Redémarrer le backend (ou attendre la prochaine heure) | Cron détecte l'échéance → crée nouvelle commande, débite le portefeuille |
| Client | Mobile → notification push | Push **"🥐 Renouvellement quotidien — Votre commande a été renouvelée… Code : XYZ-123"** reçu |
| — | `npx prisma studio` | Nouvelle commande visible, ancienne `nextRecurrenceAt` = null, nouvelle = +24 h |
| — | Mettre le solde à 0 via studio, remettre `nextRecurrenceAt` à passé, redémarrer | Cron détecte solde insuffisant — **aucune commande créée** |
| Client | Mobile → notification push | Push **"⚠️ Renouvellement impossible — Solde insuffisant…"** reçu |
| Client | Mobile → onglet **Portefeuille** → "Commandes" | Commande récurrente avec badge **"🔁 Quotidien"** et date renouvellement |
| Client | Mobile → onglet **Portefeuille** → "Commandes" → "Annuler l'abonnement" | Dialog de confirmation → confirmer → badge disparaît, `recurrence = NONE` |

### Scénario F — Commande multi-boulangeries

| Qui | Où | Action |
|---|---|---|
| Admin | Dashboard Admin `5174` → **Personnel** | S'assurer que 2 boulangers existent, chacun assigné à une boulangerie différente |
| Boulanger 1 | Dashboard Boulanger `5173` → **✨ Mes Spécialités** | Créer "Brioche Dorée" 1 200 F pour "La Mie Câline Centre" |
| Boulanger 2 | Dashboard Boulanger `5173` (autre session) → **✨ Mes Spécialités** | Créer "Croissant Feuilleté" 800 F pour "La Mie Câline Akanda" |
| Client | Mobile → onglet **Accueil** | Ajouter "Brioche Dorée" (boulangerie 1) au panier |
| Client | Mobile → onglet **Accueil** | Ajouter "Croissant Feuilleté" (boulangerie 2) au panier |
| Client | Mobile → onglet **Panier** | Ligne boulangerie affiche **"2 boulangeries · Affectation automatique"** |
| Client | Mobile → onglet **Panier** | Frais de service = somme des extraFee de chaque boulangerie selon la distance |
| Client | Mobile → onglet **Panier** → Valider | Écran succès avec **2 blocs** "Commande 1/2" et "Commande 2/2", un code retrait par boulangerie |
| Boulanger 1 | Mobile → onglet **Terminal** | Voit uniquement sa commande avec le code retrait de "Brioche Dorée" |
| Boulanger 2 | Mobile → onglet **Terminal** | Voit uniquement sa commande avec le code retrait de "Croissant Feuilleté" |
| Admin | Dashboard Admin `5174` → **Commandes** | 2 commandes distinctes avec même `groupOrderId`, total = sous-totaux respectifs |

### Scénario E — Spécialités maison

| Qui | Où | Action |
|---|---|---|
| Admin | Dashboard Admin `5174` → onglet **Personnel** | Créer baker `077111111` assigné à "La Mie Câline Centre" |
| Boulanger | Dashboard Boulanger `5173` → onglet **✨ Mes Spécialités** | Créer "Brioche Dorée" 1 200 F (viennoiserie) et "Tarte Basque" 2 500 F (patisserie) |
| Client | Mobile → onglet **Accueil** | Accorder la géolocalisation, attendre 2–4 s |
| Client | Mobile → onglet **Accueil** | Section "✨ Spécialités" visible avec 2 produits en scroll horizontal |
| Client | Mobile → onglet **Accueil** | Filtrer "Viennoiseries" → seule "Brioche Dorée" reste dans ✨ |
| Client | Mobile → onglet **Accueil** → onglet **Panier** | Ajouter "Brioche Dorée" → badge "✨ Auto" sur la ligne boulangerie |
| Client | Mobile → onglet **Portefeuille** + onglet **Panier** | Recharger 5 000 F, valider la commande |
| Boulanger | Mobile → onglet **Terminal** ou PWA `5173` | Voir la commande assignée à "La Mie Câline Centre" → DELIVERED |
| Admin | `npx prisma studio` ou Dashboard `5174` → **Commandes** | Vérifier que `bakeryId` de la commande = ID de "La Mie Câline Centre" |

---

## 11. Checklist de régression

Cocher chaque point avant une mise en production.

### Backend

- [ ] `npx prisma db push` exécuté après tout changement de schéma
- [ ] `npx prisma generate` exécuté après `db push`
- [ ] Variables `.env` présentes (`DATABASE_URL`, `JWT_SECRET`)
- [ ] Logs de démarrage propres (pas d'erreur Prisma)
- [ ] Seed exécuté — logs : `[SEED] 3 boulangeries créées.` (premier) ou `[SEED] Coordonnées boulangeries mises à jour.` (suivants)
- [ ] `GET /api/order/bakeries?lat=0.4180&lng=9.4680` → Libreville Centre ~0.2 km (extraFee=0), Le Cocotier ~6.5 km, Akanda ~10 km
- [ ] `GET /api/products` répond 200 avec produits `bakeryId = null`
- [ ] `GET /api/products?bakeryId=X` répond 200 avec produits globaux + spécialités de X
- [ ] `GET /api/baker/products` avec token CLIENT → 403
- [ ] `GET /api/baker/products` avec token BAKER → 200 (liste ses spécialités)
- [ ] `POST /api/baker/products` crée un produit avec `bakeryId` du boulanger connecté
- [ ] `POST /api/baker/products` d'un baker non assigné à une boulangerie → 403
- [ ] `PUT/DELETE /api/baker/products/:id` d'un boulanger sur la spécialité d'un **autre** boulanger → 403
- [ ] `POST /api/upload` avec token valide + image → 200 `{ url: "/uploads/xxx.jpg" }`
- [ ] `POST /api/upload` sans token → 401
- [ ] `POST /api/upload` avec fichier non-image → 400
- [ ] `GET /uploads/xxx.jpg` (statique) retourne l'image uploadée
- [ ] Dossier `backend/uploads/` créé automatiquement si absent
- [ ] `POST /api/order/checkout` refuse si solde insuffisant
- [ ] `POST /api/order/checkout` avec `recurrence: "DAILY"` → `nextRecurrenceAt` = +24 h dans la réponse
- [ ] `DELETE /api/order/:id/recurrence` (propriétaire) → 200 `{ success: true }`, recurrence = NONE
- [ ] `DELETE /api/order/:id/recurrence` (autre utilisateur) → 403
- [ ] Cron `processRecurringOrders` : commande créée + push "🥐 Renouvellement quotidien" si solde suffisant
- [ ] Cron `processRecurringOrders` : aucune commande + push "⚠️ Renouvellement impossible" si solde insuffisant
- [ ] `POST /api/auth/login` refuse les mauvais PINs (401)
- [ ] `GET /api/admin/stats` nécessite un token admin

### Mobile

- [ ] Inscription + connexion client fonctionnels
- [ ] Recharge Airtel Money / Moov Money (taux succès ~85 %)
- [ ] Onglet **Accueil** : section "✨ Spécialités" visible si géolocalisation accordée ET spécialités existantes dans une boulangerie proche
- [ ] Onglet **Accueil** : section "✨ Spécialités" absente si géolocalisation refusée (pas de crash)
- [ ] Onglet **Accueil** : filtres de catégorie filtrent aussi les spécialités
- [ ] Onglet **Panier** : section "Régalez un proche" positionnée **entre** "Mode de réception" et la carte
- [ ] Onglet **Panier** : toggle "Régalez un proche" — fond rose + titre dynamique avec prénom du destinataire
- [ ] Onglet **Panier** : sous-texte cadeau change selon mode livraison/retrait
- [ ] Onglet **Panier** : indice de la carte change quand cadeau + livraison actifs ("🎁 Adresse du proche")
- [ ] Onglet **Panier** : section "Fréquence" — pills **"Une fois"** et **"Tous les jours"** uniquement (pas de "Hebdo")
- [ ] Onglet **Panier** : sélection "Tous les jours" → boîte amber explicative + libellé total "Total / jour"
- [ ] Onglet **Panier** : carte mono-boulangerie → hauteur 220 px, un seul marqueur 📍
- [ ] Onglet **Panier** : carte multi-boulangeries (mode En boutique) → hauteur **300 px**, marqueurs numérotés ①② colorés
- [ ] Onglet **Panier** : marqueur boulangerie verte = nearest (pas de surcharge), orange = avec surcharge
- [ ] Onglet **Panier** : tap sur marqueur boulangerie → popup avec nom + badge "✓ La plus proche" si applicable
- [ ] Onglet **Panier** : carte multi-boulangeries + Livraison → cercles boulangeries masqués
- [ ] Onglet **Panier** : carte se recharge automatiquement quand les boulangeries sont récupérées (key change)
- [ ] Onglet **Panier** : spécialité ajoutée → bakeryId stocké dans CartItem
- [ ] Onglet **Panier** : badge "✨ Auto" visible quand un article a un bakeryId
- [ ] Onglet **Panier** : spécialités de 2 boulangeries différentes → "N boulangeries · Affectation automatique" (pas de blocage)
- [ ] Onglet **Panier** : panneau "N points de retrait" — ligne spécialité en **violet** (✦ SPÉCIALISÉ), ligne plateforme en **bleu** (● PARTENAIRE)
- [ ] Onglet **Panier** : commande multi-boulangeries → N sous-commandes créées, écran succès liste N blocs
- [ ] Onglet **Panier** : géolocalisation demandée et utilisée pour le calcul des frais
- [ ] Onglet **Panier** : frais multi-boulangeries = somme des extraFee par boulangerie
- [ ] Onglet **Panier** : coupon appliqué → réparti proportionnellement entre les sous-commandes
- [ ] Onglet **Portefeuille** : 4 segments visibles — Recharger · Points · Historique · **Commandes**
- [ ] Onglet **Portefeuille** → "Commandes" : chargement depuis `GET /api/user/:userId/orders`
- [ ] Onglet **Portefeuille** → "Commandes" : badge "🔁 Quotidien" + date renouvellement sur commandes récurrentes
- [ ] Onglet **Portefeuille** → "Commandes" : bouton "Annuler l'abonnement" → dialog → `DELETE /api/order/:id/recurrence` → badge disparu
- [ ] Onglet **Portefeuille** → "Points" : conversion points → solde (min 100 points)
- [ ] Rôle BOULANGER : onglet **Terminal Boulanger** uniquement visible + bouton déconnexion ↪
- [ ] Rôle BOULANGER : KPI strip affiche Nouvelles / En prépa / Prêtes / En route
- [ ] Rôle BOULANGER : flux PENDING → CONFIRMED → READY → DELIVERED (retrait) fonctionne
- [ ] Rôle BOULANGER : flux livraison CONFIRMED → READY → PICKED_UP → (livreur) DELIVERED fonctionne
- [ ] Rôle BOULANGER : FAB "Saisir le Code Client" valide uniquement les commandes READY non-livraison
- [ ] Rôle BOULANGER : validation hors-ligne enregistrée dans outbox, synchronisée au retour réseau
- [ ] Rôle LIVREUR : onglet **Espace Livreur** uniquement visible + bouton déconnexion ↪
- [ ] Rôle LIVREUR : ne voit que les commandes READY (pas CONFIRMED ni PENDING)
- [ ] Rôle LIVREUR : après acceptation → badge "À RÉCUPÉRER", bouton ✓ bloqué tant que PICKED_UP non reçu
- [ ] Rôle LIVREUR : après confirmation boulanger (PICKED_UP) → badge "EN LIVRAISON", bouton ✓ actif
- [ ] Onglet **Espace Livreur** : GPS envoyé toutes les 30 s (vérifier logs backend)

### Dashboard Boulanger (`http://localhost:5173`)

- [ ] Connexion avec compte BAKER/BOULANGER uniquement
- [ ] Onglet **Commandes en cours** : PENDING en ambre avec "Accepter la commande"
- [ ] Confirmation PENDING → CONFIRMED : push client "En cours de préparation"
- [ ] Commande CONFIRMED : bouton "Commande prête" (retrait) ou "Prête — Libérer pour livreur" (livraison)
- [ ] Commande READY retrait : champ code + bouton "Valider la remise" → DELIVERED
- [ ] Commande READY livraison sans livreur : mention "⏳ En attente d'un livreur…"
- [ ] Commande READY livraison avec livreur : bouton bleu "Confirmer remise au livreur"
- [ ] Confirmation handoff → PICKED_UP : badge "🚀 En livraison par [Nom livreur]"
- [ ] Onglet **✨ Mes Spécialités** visible et chargé
- [ ] **Modal** "Nouvelle spécialité" : centré, fond flouté, bouton ✕ ferme
- [ ] Upload photo dans le **modal** → prévisualisation immédiate + URL sauvegardée
- [ ] Badge "🟢 Actif — visible aux clients à proximité" sur chaque carte spécialité
- [ ] Photo uploadée visible en miniature sur la carte (52×52)
- [ ] Description longue tronquée à 2 lignes dans la carte (pas de débordement)
- [ ] Création d'une spécialité → visible dans la grille
- [ ] Modification d'une spécialité → prix/nom/photo mis à jour
- [ ] Suppression d'une spécialité → retirée de la grille
- [ ] Les spécialités créées apparaissent dans l'app mobile (section ✨) avec la vraie photo

### Dashboard Admin (`http://localhost:5174`)

- [ ] Connexion refusée pour les non-admins
- [ ] Onglet **Vue d'ensemble** : section "Activité du jour" (3 KPIs) et "Équipe & Réseau" (4 KPIs) bien alignées
- [ ] KPI "Boulangers" et "Livreurs actifs" affichent des valeurs non nulles
- [ ] Onglet **Produits** : résumé "X plateforme · Y spécialité(s)" affiché
- [ ] Onglet **Produits** : badges type correctement différenciés (🌐 Plateforme / 🏪 Boulangerie)
- [ ] Onglet **Produits** : produits avec photo uploadée → miniature réelle dans la colonne Illustration
- [ ] Onglet **Produits** : produits legacy (clé emoji) → emoji affiché dans la colonne Illustration
- [ ] **Modal** "Nouveau produit" : centré, upload photo, champs Nom+Prix côte à côte
- [ ] Upload photo dans le **modal** → prévisualisation 180 px, URL sauvegardée
- [ ] Onglet **Produits** : bouton ✏️ absent sur les lignes spécialités (modération lecture seule)
- [ ] Onglet **Produits** : bouton 🗑 présent sur toutes les lignes (admin peut supprimer)
- [ ] Onglet **Livraisons** : carte Leaflet charge (nécessite internet pour les tuiles OSM)
- [ ] Onglet **Codes Promo** : création coupon → visible immédiatement
- [ ] Onglet **Codes Promo** : toggle inactif → rejeté dans l'app mobile (onglet **Panier**)
- [ ] Onglet **Personnel** : création boulanger/livreur → compte utilisable immédiatement
- [ ] Onglet **Personnel** : désactivation d'un compte → connexion refusée
- [ ] Onglet **Clients** : tableau visible avec solde, points, commandes par client

---

*Dernière mise à jour : 24 avril 2026 — v2 : cartes multi-boulangeries, distinction spécialité/plateforme, Régalez un proche, Fréquence "Tous les jours", abonnement quotidien (push + annulation), onglet Commandes dans Portefeuille, seed auto-correction coordonnées Libreville.*
