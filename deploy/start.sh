#!/usr/bin/env sh
# Lance tout le projet (PostgreSQL, API, worker, application web, Mailpit) et attend qu'il soit prÃªt.
# Usage : ./deploy/start.sh        (relancez-le aprÃ¨s un git pull pour reconstruire)
set -e
cd "$(dirname "$0")"

COMPOSE="docker compose"
[ -f .env ] && set -a && . ./.env && set +a

echo "Construction et dÃ©marrage des conteneurs (la premiÃ¨re fois : quelques minutes)â€¦"
$COMPOSE up -d --build

WEB_URL=${WEB_URL:-http://localhost:5173}
API_URL=${API_URL:-http://localhost:8000}
MAILPIT_PORT=${MAILPIT_PORT:-8025}

printf "Attente de l'API"
i=0
until curl -sf "$API_URL/up" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 120 ]; then
    echo
    echo "L'API ne rÃ©pond pas. Derniers messages :"
    $COMPOSE logs --tail=40 api
    exit 1
  fi
  printf "."
  sleep 2
done
echo " OK"

cat <<EOF

Marketplace B2B est prêt
  Application web : $WEB_URL
  API             : $API_URL
  E-mails (test)  : http://localhost:$MAILPIT_PORT

  Comptes de dÃ©monstration (mot de passe : password)
    admin@marketplace.test
    buyer1@marketplace.test â€¦ buyer5@marketplace.test
    supplier1@marketplace.test â€¦ supplier8@marketplace.test

  Journaux : docker compose -f deploy/docker-compose.yml logs -f api worker
  ArrÃªter  : ./deploy/stop.sh
EOF
