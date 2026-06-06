# Optigistik


## 📂 Structure du projet

Ce dépôt fonctionne comme un monorepo contenant les applications suivantes :

- **`/site_vitrine`** : Application Next.js pour la présentation publique.
- **`/logiciel`** : Application Next.js pour la plateforme logicielle/métier.
- **`/application`** : Application mobile pour les chauffeurs (React Native & Expo).

## 🚀 Lancement rapide (Mode Démo / Production)

Le projet est conteneurisé avec **Docker** pour garantir un environnement stable et valider la compétence d'optimisation et de déploiement.

### Prérequis
- Docker Desktop installé et lancé.

### Instructions
À la racine du projet, lancez la commande suivante pour construire et démarrer les deux applications simultanément :

```bash
docker-compose up --build
```

Une fois le build terminé, les services sont accessibles via :

- **Site Vitrine** : http://localhost:3000
- **Logiciel** : http://localhost:3001
- **Application Chauffeur** : Metro Bundler sur http://localhost:8081 (le QR Code s'affiche dans votre terminal au démarrage)

> [!TIP]
> Pour tester l'application chauffeur sur votre téléphone, téléchargez l'application **Expo Go** (iOS ou Android) et scannez simplement le QR Code affiché dans votre terminal lors du lancement !

Note : Cette méthode simule un environnement de production. Le "Hot Reload" (mise à jour en direct du code) n'est pas actif dans ce mode.

🛠️ Guide de Développement
Pour travailler sur le code avec le rechargement automatique (Hot Reload), n'utilisez pas Docker. Lancez chaque projet individuellement.

Prérequis
Node.js (v20 recommandé)

npm

1. Lancer le Site Vitrine
Ouvrez un terminal dans le dossier site_vitrine :

```Bash

cd site_vitrine
npm install
npm run dev
Accessible sur : localhost:3000

```

2. Lancer le Logiciel
Ouvrez un second terminal dans le dossier logiciel :

```Bash

cd logiciel
npm install
npm run dev
Accessible sur : localhost:3001
```

3. Lancer l'Application Chauffeur
Ouvrez un troisième terminal dans le dossier application :

```Bash

cd application
npm install
npx expo start --tunnel
```
Flashez le QR Code avec votre téléphone (nécessite l'application **Expo Go**).

⚙️ Stack Technique
Frameworks : Next.js 16 (App Router), React Native & Expo

Langage : TypeScript

Styles : Tailwind CSS

Architecture : Docker & Docker Compose