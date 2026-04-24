# Limpa - PRÃ‰SENTATION ET PLAN D'AFFAIRES (Dossier Partenaires)

**Date** : Mars 2026
**Secteur** : FoodTech / FinTech Logistique

Ce document prÃ©sente l'architecture commerciale, les flux mÃ©tiers complets et l'architecture logicielle de la plateforme **"Limpa"**. Il s'adresse aux partenaires (OpÃ©rateurs TÃ©lÃ©coms, Investisseurs, FranchisÃ©s) souhaitant comprendre le fonctionnement en production de l'Ã©cosystÃ¨me.

---

## 1. VISION ET PROBLÃˆME RÃ‰SOLU

### 1.1 Le Constat (Le ProblÃ¨me)
Dans les marchÃ©s fortement dynamiques, les boulangeries et commerces de commoditÃ© souffrent d'un goulot d'Ã©tranglement sÃ©vÃ¨re lors des heures de pointe (7h00 - 9h00).
- **Pour le client** : La queue, l'attente pour la monnaie, et les manipulations via USSD (Mobile Money) font perdre une dizaine de minutes prÃ©cieuses.
- **Pour le commerÃ§ant** : La congestion de la caisse limite mÃ©caniquement le nombre de ventes Ã  l'heure (Plafond de verre), tout en gÃ©nÃ©rant du stress ou des vols par inattention.
- **Pour les professionnels (B2B)** : Impossible de programmer finement la rÃ©cupÃ©ration du pain pour la restauration sans passer un coup de tÃ©lÃ©phone incertain.

### 1.2 La Solution "Limpa"
Une plateforme holistique ("UberEats" x "Starbucks App") permettant la commande **frictionless, digitalisÃ©e et prÃ©payÃ©e** disponible 24h/24 et 7j/7. Que vous soyez un cadre pressÃ© le matin, ou un restaurateur la nuit, la plateforme gÃ¨re la commande, encaisse l'argent en amont, et organise la logistique (Retrait sur place ou Livraison) de maniÃ¨re Ã  ce que le produit soit rÃ©cupÃ©rÃ© en **3 secondes chronos**.

### 1.3 Le ModÃ¨le "Ghost Kitchen" (L'Innovation ClÃ© ðŸ”‘)
Contrairement Ã  une Marketplace classique qui force le consommateur Ã  *choisir une enseigne*, "Limpa" fonctionne selon un modÃ¨le **Ghost Kitchen** :

> Le client ouvre **une seule et unique application** avec une marque forte et homogÃ¨ne. Il commande ses croissants. En coulisses, notre **Moteur de Logistique GÃ©ospatiale** identifie automatiquement le fournil partenaire le plus proche de son adresse de livraison et lui assigne la commande silencieusement.

Le client ne voit jamais "Bakery A" ou "Bakery B". Il voit uniquement **"Limpa"**. Ce modÃ¨le protÃ¨ge la marque, supprime la friction de choix pour l'utilisateur, et permet une **franchisation invisible Ã  grande Ã©chelle** sur l'ensemble du territoire.

---

## 2. MODÃˆLE FINANCIER : LE "FLOAT ACCOUNT" (PORTEFEUILLE VIRTUEL)

Le cÅ“ur de notre innovation est le couplage FinTech.

1. **Le Code Marchand Global** : La start-up signe des partenariats API avec les opÃ©rateurs de rÃ©seaux (Ex: Airtel / Moov). "Limpa" obtient un numÃ©ro de compte marchand unique et aggrÃ©gÃ©.
2. **Le PrÃ©paiement par Cagnotte (Wallet)** : 
   - Le client n'utilise pas Airtel Money tous les matins pour acheter un pain Ã  150 FCFA (C'est chronophage). 
   - Il recharge son Portefeuille Virtuel "Limpa" de 5000 ou 10000 FCFA d'un seul coup le Lundi. L'argent physique atterrit instantanÃ©ment sur le compte bancaire de notre plateforme.
3. **BÃ©nÃ©fices B2B (ModÃ¨le Ã‰conomique)** :
   - TrÃ©sorerie SÃ©curisÃ©e et Positive.
   - Les achats quotidiens dans l'application se font par dÃ©bit informatique invisible en millisecondes.
   - FidÃ©lisation par points offerte par l'Application.

## 3. LE FONCTIONNEMENT DE A Ã€ Z (L'EXPÃ‰RIENCE UTILISATEUR COMPLÃˆTE)

L'Ã©cosystÃ¨me "Limpa" a Ã©tÃ© mÃ©ticuleusement conÃ§u pour fluidifier chaque Ã©tape de la logistique commerciale. Voici le dÃ©roulement exact d'une transaction, de l'inscription jusqu'Ã  la consommation :

**Ã‰tape 1 : Le Rechargement (Frictionless Cash-In)**
L'utilisateur tÃ©lÃ©charge l'application (B2C) ou l'interface Pro (B2B). Pour Ã©viter les latences de l'USSD Ã  chaque achat, il recharge son "Portefeuille Virtuel" (Float Account) via Airtel ou Moov, crÃ©ditant directement le compte de l'entreprise.

**Ã‰tape 2 : Le Catalogue & La Programmation**
L'utilisateur accÃ¨de au catalogue complet de la boulangerie (pains, viennoiseries pÃ¢tisseries). Il sÃ©lectionne ses articles puis configure sa logistique :
- **OÃ¹ ?** (Retrait au comptoir ou Livraison via gÃ©olocalisation sur Carte Interactive).
- **Quand ?** (ImmÃ©diat, ou programmÃ© Ã  la minute prÃ¨s via la roulette temporelle native).

**Ã‰tape 3 : Le Checkout et la SÃ©curisation de Commande**
En un seul clic, le solde du portefeuille est dÃ©bitÃ© sans quitter l'application. Le systÃ¨me gÃ©nÃ¨re instantanÃ©ment **Un Ticket de Caisse DigiltalisÃ© (PDF)** incluant un QR Code ainsi d'un  **Code PIN SÃ©curisÃ©** de secours (Ex: `A-192`).

**Ã‰tape 4 : Le Routage Automatique par GÃ©olocalisation ("Ghost Kitchen")**
DÃ¨s le paiement validÃ©, notre **Moteur Haversine** (algorithme gÃ©ospatial) entre en action. Il calcule en temps rÃ©el la distance GPS entre les coordonnÃ©es du client et l'ensemble des fournils partenaires enregistrÃ©s dans la base de donnÃ©es. La commande est **automatiquement attribuÃ©e au fournil le plus proche** â€” sans intervention humaine, sans que le client ne le sache.

*Exemple concret au Gabon :* Un hÃ´tel Ã  Akanda passe une commande Ã  6h pour 30 baguettes. Le moteur identifie que le Hub "Akanda" est Ã  1.2 km et le Hub "Libreville-Centre" est Ã  14 km. La commande part **uniquement** sur la tablette d'Akanda. Limpa de Libreville ne voit rien. ZÃ©ro coordination humaine requise.

**Ã‰tape 5 : La PrÃ©paration en Flux Tendu (CÃ´tÃ© Fournil)**
DÃ¨s la milliseconde du routage, la commande apparaÃ®t sur le tableau de bord (Kanban) **du seul fournil dÃ©signÃ©**. Limpa voit le sac Ã  prÃ©parer, la date de livraison, et le type de commande (Retrait / Livraison Ã  domicile).

**Ã‰tape 6 : La Remise (Retrait ou Livraison)**
- *Cas du Retrait Magasin :* Le client arrive Ã  l'heure prÃ©vue, coupe la file, l'Ã©cran de la caisse scanne son Smartphone (QR Code) ou le caissier tape manuellement son PIN si le tÃ©lÃ©phone du client s'est Ã©teint. 
- *Cas de la Livraison :* Le coursier utilise son module mÃ©tier GPS (RÃ´le Livreur), se rend au domicile, et finalise la livraison en validant formellement le Code PIN dictÃ© par le client.

**Ã‰tape 6 : La ClÃ´ture et la FidÃ©lisation**
Une fois la transaction validÃ©e par le scanner, les mÃ©triques commerciales du Back-Office se mettent Ã  jour et le client gÃ©nÃ¨re des points sur son portefeuille fidÃ©litÃ©. Le cycle est terminÃ© en seulement 3 secondes passÃ©es au point de retrait physique.

---

## 4. LES RÃ”LES ET PARCOURS EN PRODUCTION (REAL LIFE FLOWS)

Notre systÃ¨me s'adapte Ã  3 types d'utilisateurs distincts. Chacun possÃ¨de un parcours millimÃ©trÃ© en situation rÃ©elle :

### RÃ´le 1 : Le Client (Particulier B2C ou Professionnel B2B)
**L'Interface** : L'Application Mobile (iOS / Android).
* **B2C (Matin & Programmation)** : Le particulier ne se limite pas aux achats immÃ©diats. Il a accÃ¨s Ã  **tout le catalogue de pains et de pÃ¢tisseries**. Il peut commander sa baguette Ã  l'instant T, ou programmer, via la roulette temporelle de l'application, l'heure exacte de ramassage de ses croissants pour le lendemain.
* **B2B (24/7)** : Un gÃ©rant de restaurant ouvre l'App Ã  23h, commande 50 baguettes, sÃ©lectionne une livraison pour le "Lendemain 6h00" via le *Calendrier PrÃ©cis* embarquÃ©, et positionne son "Marqueur GPS" interactif sur l'immeuble du restaurant. Il active la **RÃ©currence Quotidienne** (Abonnement `DAILY`). L'App prÃ©lÃ¨vera son Wallet automatiquement chaque nuit sans aucune action humaine requise pendant un mois.

### RÃ´le 2 : Limpa / La Caisse
**L'Interface** : Le "Dashboard B2B" (EntiÃ¨rement Responsive : PC, Tablette iPad, ou mÃªme Smartphone de secours en cas de panne matÃ©rielle).
* Ce systÃ¨me n'est pas une simple page Web. C'est une **Progressive Web App (PWA)** pensÃ©e pour les flux tendus qui s'adapte Ã  tous les Ã©crans du point de vente.
* Le profil "Boulanger" ne voit pas le menu pour acheter, il voit une "File d'attente / Tableau de Bord" des baguettes Ã  prÃ©parer. 
* L'interface gÃ¨re **une double mÃ©thode de distribution pour s'adapter Ã  toutes les situations (Smart Scan & PIN)**. DÃ¨s qu'un client approche, l'application peut scanner le code QR du client via la douchette ou la camÃ©ra. Ã€ dÃ©faut, le commerÃ§ant utilise le clavier pour taper le code PIN sÃ©curisÃ© (ex: A-192). Le systÃ¨me bipe et valide la livraison.

### RÃ´le 3 : Le Livreur (Logistique Interne ou Flotte)
**L'Interface** : L'Application Mobile en mode "RÃ´le Livreur".
* Lorsqu'un livreur se connecte, l'application se mÃ©tamorphose en un outil de guidage GPS.
* Une grande **Carte Interactive** couvre l'Ã©cran, avec des "Pins" sur la position exacte entrÃ©e par les clients. 
* Le livreur roule vers le Pin. En arrivant, il peut ouvrir la fiche client et exiger le "Code PIN de SÃ©curitÃ©" du sac aux mains du client, validant ainsi comptablement le transfert.

---

## 4. CAS EXTRÃŠMES ET RÃ‰SILIENCE EN PRODUCTION (EDGE CASES)

Pour qu'un projet B2B soit fiable, il doit prÃ©voir les dÃ©sastres techniques (Pannes RÃ©seau, Bugs). "Limpa" est conÃ§u autour de la **Redondance Offline** :

### ScÃ©nario Rouge : La Boulangerie perd Internet (Wifi ou 4G cassÃ©)
* Si le cÃ¢ble Ethernet est arrachÃ© Ã  7h30 du matin. Dans un commerce classique (McDonald's, SupermarchÃ©), les terminaux de paiement tombent en carafe. Impossible de savoir qui a payÃ©. Panique.
* **Notre SystÃ¨me ("Offline-First")** : La tablette du Dashboard Boulanger stocke nativement le code source et la file d'attente en *MÃ©moire Locale (IndexedDB)* toutes les millisecondes. 
* L'Ã©cran affiche poliment un badge `MODE SECOURS HORS-LIGNE`. Limpa continue de scanner les codes des clients ou de taper leur numÃ©ro ! L'application certifie qu'ils ont payÃ© (puisqu'ils ont Ã©tÃ© enregistrÃ©s localement 10 minutes avant la coupure). Les actions sont mises dans une "BoÃ®te d'envoi", et fussionneront avec le serveur maÃ®tre lors de la reconnexion Internet en silence. ZÃ©ro vente perdue.

### ScÃ©nario Orange : Le client n'a plus de batterie (TÃ©lÃ©phone mort)
* Le client a prÃ©-payÃ© chez lui, mais en arrivant au comptoir, son smartphone s'Ã©teint. Il ne peut plus montrer son QR Code. 
* **Notre SystÃ¨me ("Fallback PIN")** : Chaque facture validÃ©e est accompagnÃ©e d'un Code de Retrait trÃ¨s court (Ex: `X-893`). Le client l'a mÃ©morisÃ©. Il arrive au guichet, dicte ce code, le vendeur le tape sur son iPad, et la commande lui est authentifiÃ©e et remise en toute sÃ©curitÃ©.

---

## 5. ARCHITECTURE TECHNIQUE & DE SÃ‰CURITÃ‰

| Composant | Technologie | RÃ´le |
|---|---|---|
| Serveur API | Node.js / Express / TypeScript | Paiement, Routage, Logistique |
| Base de donnÃ©es | PostgreSQL + Prisma ORM | IntÃ©gritÃ© financiÃ¨re & commandes |
| App Mobile | React Native (Expo) | Clients B2C, Livreurs GPS |
| Dashboard Caisse | React + Vite (PWA) | Boulanger, Mode Offline |
| Moteur GÃ©ospatial | Algorithme Haversine (serveur) | Routage Ghost Kitchen |
| Authentification | PIN hashÃ© SHA-256 + RÃ´les DB | CLIENT / LIVREUR / BAKER |
| Paiement | Airtel Money / Moov (Code Marchand) | Float Account Marchand |
| Ticket & TraÃ§abilitÃ© | PDFKit + QR Code dynamique | Signature digitale commande |
| RÃ©silience Offline | IndexedDB (idb-keyval) + Outbox | ZÃ©ro vente perdue sans Internet |

### ScalabilitÃ© & Franchise
L'architecture "Ghost Kitchen" est conÃ§ue pour absorber des dizaines de fournils partenaires sans modification du code applicatif. Chaque nouveau partenaire est simplement enregistrÃ© dans la base de donnÃ©es avec ses coordonnÃ©es GPS â€” le moteur de routage l'intÃ¨gre instantanÃ©ment dans son calcul. Le rÃ©seau peut passer de 2 Ã  200 points de cuisson sans recoder une seule ligne.

