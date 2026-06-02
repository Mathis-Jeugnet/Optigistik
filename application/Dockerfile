FROM node:20-alpine

WORKDIR /app

# On copie d'abord les fichiers de dépendances pour profiter du cache Docker
COPY package*.json ./

# On installe les dépendances (expo, react, react-native, etc.)
RUN npm install

# On copie le reste des fichiers du projet
COPY . .

# On expose le port par défaut d'Expo
EXPOSE 8081

# On lance le serveur Expo
CMD ["npx", "expo", "start"]
