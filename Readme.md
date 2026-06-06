# Optigistik


## 📂 Structure du projet

Ce dépôt fonctionne comme un monorepo contenant les deux applications :

- **`/site_vitrine`** : Application Next.js pour la présentation publique.
- **`/logiciel`** : Application Next.js pour la plateforme logicielle/métier.

## 🚀 Lancement rapide (Mode Démo / Production)

Le projet est conteneurisé avec **Docker** pour garantir un environnement stable et valider la compétence d'optimisation et de déploiement.

### Prérequis
- Docker Desktop installé et lancé.

### Instructions
À la racine du projet, lancez la commande suivante pour construire et démarrer les deux applications simultanément :

```bash
docker-compose up --build
```

Une fois le build terminé, les applications sont accessibles via :

Site Vitrine : http://localhost:3000

Logiciel : http://localhost:3001

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

⚙️ Stack Technique
Framework : Next.js 16 (App Router)

Langage : TypeScript

Styles : Tailwind CSS

Architecture : Docker & Docker Compose