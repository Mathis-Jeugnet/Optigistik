#!/bin/bash

OSM_FILE="ors/files/france-latest.osm.pbf"

if [ ! -f "$OSM_FILE" ]; then
  echo "Téléchargement des données OSM France (~3.5 Go)..."
  curl -L -o "$OSM_FILE" https://download.geofabrik.de/europe/france-latest.osm.pbf
  echo "Téléchargement terminé."
else
  echo "Données OSM France déjà présentes, pas de téléchargement."
fi

docker compose up --build
