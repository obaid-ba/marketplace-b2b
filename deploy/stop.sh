#!/usr/bin/env sh
# Arrête le projet. Les données (base, fichiers envoyés) sont conservées.
# ./deploy/stop.sh --reset  efface aussi la base : les données de démo seront recréées au prochain démarrage.
set -e
cd "$(dirname "$0")"

if [ "$1" = "--reset" ]; then
  docker compose down -v
  echo "✓ Projet arrêté, base de données et fichiers effacés."
else
  docker compose down
  echo "✓ Projet arrêté (données conservées). Relancer : ./deploy/start.sh"
fi
