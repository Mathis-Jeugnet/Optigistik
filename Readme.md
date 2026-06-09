# Optigistik


## 📂 Structure du projet

Ce dépôt fonctionne comme un monorepo contenant les applications suivantes :

- **`/site_vitrine`** : Application Next.js pour la présentation publique.
- **`/logiciel`** : Application Next.js pour la plateforme logicielle/métier.
- **`/application`** : Application mobile pour les chauffeurs (React Native & Expo).
- **`/solveur`** : API Python (FastAPI) pour l'intelligence artificielle et la reconnaissance vocale.
- **`/ors`** : Moteur de routage OpenRouteService.

## 🚀 Lancement rapide (Mode Démo / Production)

Le projet est conteneurisé avec **Docker** pour garantir un environnement stable et valider la compétence d'optimisation et de déploiement.

### Prérequis
- Docker Desktop installé et lancé.

### Instructions
À la racine du projet, lancez la commande suivante pour construire et démarrer toutes les applications simultanément :

```bash
docker-compose up --build
```

Une fois le build terminé, les services sont accessibles via :

- **Site Vitrine** : http://localhost:3000
- **Logiciel** : http://localhost:3001
- **Application Chauffeur** : Metro Bundler sur http://localhost:8081 (le QR Code s'affiche dans votre terminal au démarrage)

> [!TIP]
> Pour tester l'application chauffeur sur votre téléphone, téléchargez l'application **Expo Go** (iOS ou Android) et scannez simplement le QR Code affiché dans votre terminal lors du lancement !

### 🎤 Mode Présentation (Contrôle Vocal)
Pour la soutenance, l'application intègre une détection vocale passive innovante :
1. Sur la carte de l'application mobile, appuyez sur le bouton **"🪄 Mode Présentation"**.
2. Posez le téléphone, vous n'avez plus besoin de toucher l'écran.
3. Dites distinctement **"Signaler un incident"**.
4. Le bouton changera d'état (*"À votre écoute..."*).
5. Énoncez alors la nature du problème (ex: **"Il y a un accident"**, ou *"danger"*, *"route barrée"*).
6. La pop-up d'incident surgira instantanément pour notifier le logisticien !

### 🧹 Nettoyage du Cache (En cas de problème)
Si votre compilation Docker échoue avec une erreur du type `no space left on device` ou si vous souhaitez forcer une réinstallation propre des dépendances, nettoyez le cache de Docker avec cette commande :

```bash
docker system prune -f
```

---

## 🛠️ Guide de Développement
Pour travailler sur le code avec le rechargement automatique (Hot Reload), n'utilisez pas Docker. Lancez chaque projet individuellement.

### Prérequis
- Node.js (v20 recommandé)
- npm
- Python 3.10+ (pour le solveur)

### 1. Lancer le Site Vitrine
Ouvrez un terminal dans le dossier `site_vitrine` :
```bash
cd site_vitrine
npm install
npm run dev
```
Accessible sur : localhost:3000

### 2. Lancer le Logiciel
Ouvrez un second terminal dans le dossier `logiciel` :
```bash
cd logiciel
npm install
npm run dev
```
Accessible sur : localhost:3001

### 3. Lancer l'Application Chauffeur
Ouvrez un troisième terminal dans le dossier `application` :
```bash
cd application
npm install
npx expo start --tunnel
```
Flashez le QR Code avec votre téléphone (nécessite l'application **Expo Go**).

### 4. Lancer le Solveur IA
Ouvrez un quatrième terminal dans le dossier `solveur` :
```bash
cd solveur
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## ⚙️ Stack Technique
- **Frameworks** : Next.js 16 (App Router), React Native & Expo, FastAPI (Python)
- **Langages** : TypeScript, Python
- **Styles** : Tailwind CSS, React Native StyleSheet
- **Architecture** : Docker & Docker Compose, Tunnels Locaux (Localtunnel)