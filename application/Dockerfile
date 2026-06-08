FROM node:20-alpine

WORKDIR /app

# On copie d'abord les fichiers de dépendances pour profiter du cache Docker
COPY package*.json ./

# On installe les dépendances (expo, react, react-native, etc.)
RUN npm install --legacy-peer-deps

# On copie le reste des fichiers du projet
COPY . .

# On installe le tunnel ngrok pour Expo
RUN npm install -g @expo/ngrok

# On expose le port par défaut d'Expo
EXPOSE 8081

# On lance le script de démarrage personnalisé qui attend ORS et affiche les liens
CMD ["node", "start.js"]
