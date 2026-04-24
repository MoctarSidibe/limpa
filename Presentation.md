# Documentation ComplÃ¨te & Vision : "Limpa" ðŸ¥–ðŸ¥

Ce document compile de A Ã  Z la vision, l'architecture mÃ©tier et le flux complet de l'Ã©cosystÃ¨me "Limpa" : de l'application cliente Ã  la tablette de la boulangerie, jusqu'aux livreurs.

---

## 1. Vision et ProblÃ¨me RÃ©solu (MÃ©tier)
Le problÃ¨me principal rÃ©solu par la plateforme est la digitalisation des processus logistiques en boulangerie, conÃ§ue pour un fonctionnement **24/7**.
- **Cible B2C (Particuliers)** : Ã‰viter l'attente lors des heures de pointe (7h-8h) pour acheter du pain ou des viennoiseries.
- **Cible B2B (Professionnels & CommerÃ§ants)** : Permettre aux restaurants et revendeurs de programmer et sÃ©curiser leurs achats de pain Ã  n'importe quelle heure du jour ou de la nuit avec des rÃ©currences prÃ©cises.

**ModÃ¨le Ã‰conomique (Le "Float Account")** :
GrÃ¢ce Ã  un agrÃ©ment avec les opÃ©rateurs (Airtel / Moov), l'application "Limpa" utilise un **Code Marchand**. Lorsqu'un client (ou restaurant) recharge son portefeuille, l'argent est directement transfÃ©rÃ© sur le compte marchand de l'entreprise. Ainsi, l'achat quotidien est *Frictionless*, la trÃ©sorerie de l'entreprise est sÃ©curisÃ©e d'avance, et de multiples offres de fidÃ©lisation peuvent Ãªtre proposÃ©es de maniÃ¨re fluide.

## 2. L'Architecture Technique Constuite
L'Ã©cosystÃ¨me "Pro" B2B/B2C dÃ©veloppÃ© repose sur du code robuste et **hors-ligne-first** :

### 2.1 Backend & Base de donnÃ©es
- Serveur Node.js (Express.js + TypeScript).
- **PostgreSQL** gÃ©rÃ© via **Prisma ORM**.
- Outils B2B : GÃ©nÃ©rateur natif de ticket **PDF (pdfkit)** avec intÃ©gration d'un **QR Code Dynamique**.

### 2.2 Frontend Client & Livreur (Mobile App)
- **React Native (Expo Router)**. Design "Glassmorphism" aux tons Blanc et CÃ©rÃ©ale/Or.
- Interface Clients : Achat intuitif depuis leur *Portefeuille virtuel*.
- Interface Livreur : RÃ´le `COURIER` donnant accÃ¨s Ã  une Map GPS (Google/Apple) en plein Ã©cran avec les Pins des clients Ã  livrer et de leurs commandes.
- IntÃ©gration Native : `datetimepicker` pour l'horodatage exact.

### 2.3 Dashboard Admin (Web Tablette / PWA)
- Portail en **React.js + Vite** configurÃ© avec `TailwindCSS` et `vite-plugin-pwa` pour s'installer comme application iPad/PC.
- Technologie **Offline-First** (`idb-keyval` / IndexedDB). Limpa peut continuer Ã  flasher les QR Codes et saisir des codes de retrait mÃªme si la Box Internet de la boutique grille. Les validations s'empilent dans une "Outbox" (File d'envoi locale) et partent silencieusement sur PostgreSQL au retour d'Internet.

---

## 3. ModÃ¨les MÃ©tier ClÃ©s (Prisma Schema)
- `VirtualCard` : Le portefeuille numÃ©rique (*Solde FCFA* et *Points FidÃ©litÃ©*).
- `Order` : Contient l'intelligence logistique : `DeliveryType`, `Recurrence` (Daily/Weekly), `pickupCode` (Code PIN Fallback), `latitude`/`longitude` (Pour les livreurs).
- `User` > `Role` : DÃ©finit si l'utilisateur est un `CLIENT`, `BAKER` ou `COURIER`.

---

## 4. Les 5 Grands ScÃ©narios MÃ©tier (Flows)

### ScÃ©nario A : Le Rechargement "Portefeuille" (RÃ©tention Globale)
L'utilisateur a un **Float Account** (Virtual Card) lui Ã©vitant d'entrer et patienter via les fenÃªtres USSD Airtel/Moov tous les matins.
1. Il ajoute 5000 FCFA depuis son menu "Portefeuille". (1 Point fidÃ©litÃ© offert tous les 100 FCFA).
2. Son solde s'incremente. Il peut consommer librement. L'argent a dÃ©jÃ  Ã©tÃ© sÃ©curisÃ© cÃ´tÃ© boulangerie.

### ScÃ©nario B : Commande Click & Collect et Logistique AvancÃ©e
1. ArrivÃ© au Panier, le client sÃ©lectionne *OÃ¹ ?* et *Quand ?*.
2. Si *Livraison* : Une **Carte Map IntÃ©grÃ©e** s'affiche et il place le curseur (Pin Rouge) prÃ©cisÃ©ment sur son bÃ¢timent.
3. Si *Programmation* : Une roulette native apparaÃ®t et il sÃ©lectionne le jour et la minute exacte.
4. Au paiement, le serveur valide et puise instantanÃ©ment les FCFA. Le serveur gÃ©nÃ¨re un ticket de secours et un Ã©norme **CODE de Retrait (ex: `A-192`)**.

### ScÃ©nario C : L'Action *Offline* (Application Dashboard Boulanger)
1. C'est l'heure de pointe. Plus d'internet. Le client montre son code "A-192".
2. Limpa (sur l'iPad Dashboard) voit en rouge "RESEAU COUPÃ‰", mais la liste des pains est lÃ . Il tape `A-192`. L'App dit : *Commande 2 Pains trouvÃ©e. Valider ?*
3. Limpa appuie. L'application stocke l'action. Le client repart en 3 secondes avec son pain. Le rÃ©seau revient peu aprÃ¨s et l'action est enregistrÃ©e au niveau principal du serveur.

### ScÃ©nario D : L'Action "Livreur" ðŸ›µ
1. Le livreur allume son application en `Role = COURIER`. 
2. Une fois connectÃ©, il voit l'onglet spÃ©cial ðŸ›µ. En naviguant dessus, la **Map de la ville** s'affiche.
3. Chaque livraison en attente est un marqueur Rouge. Il appuie dessus : il voit *"Nom du client - Ã‰tage - Code PIN du sac"*. 
4. Ã€ l'adresse du client, le livreur demande : *"Veuillez me fournir votre code PIN secret"*. (ScÃ©nario de RÃ©silience extrÃªme : mÃªme si le tÃ©lÃ©phone du client s'est Ã©teint en chemin, s'il a le code `A-192` en tÃªte il le donne, le livreur valide et l'App ferme la commande).

### ScÃ©nario E : La FonctionnalitÃ© d'Abonnement "Daily" ðŸ”„
1. Ã€ l'achat, le client a cochÃ© "Abonnement > Tous les jours". La DB note l'ordre en `Recurrence = DAILY`.
2. L'argent est pris aujourd'hui pour 1 pain. 
3. (Objectif Futur : le backend exÃ©cute un `CRON JOB` Node.js Ã  4 heures du matin qui dÃ©tectera ce client, vÃ©rifiera ses FCFA, paiera un pain et remettra la commande secrÃ¨tement dans la file d'attente du boulangerie).

---

## 5. Prochaines Ã‰tapes Techniques "Scale - Go to Market"
1. Connecter vÃ©ritablement l'API Airtel Money ou Moov Payments *via Webhooks*.
2. CrÃ©er l'interface native de Connexion / Inscription (Login Auth) pour gÃ©rer la sÃ©paration automatique des `Roles` (Rediriger les clients B2C vers `/home` et les livreurs vers `/(tabs)/courier`).
3. (Optionnel) Script Cron pour gÃ©rer la rÃ©currence automatique des achats la nuit.

