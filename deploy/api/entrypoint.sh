#!/bin/sh
# Démarrage de l'API : clé, base de données, données de démo (une seule fois), serveur.
set -e
cd /app

# Clé d'application : générée au premier démarrage puis conservée dans le volume "storage".
if [ -z "$APP_KEY" ]; then
  KEY_FILE=storage/app/.app_key
  [ -f "$KEY_FILE" ] || php -r 'echo "base64:".base64_encode(random_bytes(32));' > "$KEY_FILE"
  export APP_KEY="$(cat "$KEY_FILE")"
fi

# "php artisan serve" ne transmet pas les variables d'environnement aux processus qui
# traitent les requêtes : ils lisent .env. On y recopie donc les réglages de docker-compose.yml.
for VAR in APP_NAME APP_ENV APP_DEBUG APP_URL APP_KEY APP_LOCALE FRONTEND_URL FRONTEND_URLS \
  DB_CONNECTION DB_HOST DB_PORT DB_DATABASE DB_USERNAME DB_PASSWORD \
  SESSION_DRIVER CACHE_STORE QUEUE_CONNECTION LOG_CHANNEL \
  MAIL_MAILER MAIL_HOST MAIL_PORT MAIL_FROM_ADDRESS SEED_DEMO_DATA; do
  eval "VAL=\${$VAR-__unset__}"
  [ "$VAL" = "__unset__" ] && continue
  grep -v "^$VAR=" .env > .env.tmp || true
  printf '%s="%s"\n' "$VAR" "$VAL" >> .env.tmp
  mv .env.tmp .env
done

echo "▶ Attente de la base de données…"
until php -r 'try { new PDO("mysql:host=".getenv("DB_HOST").";port=".getenv("DB_PORT"), getenv("DB_USERNAME"), getenv("DB_PASSWORD")); } catch (Throwable $e) { exit(1); }'; do
  sleep 2
done

echo "▶ Migrations"
php artisan migrate --force

# Données de démo seulement si la base est vide (sinon les e-mails uniques entreraient en conflit).
USERS=$(php artisan tinker --execute='echo \App\Models\User::count();' 2>/dev/null | tail -n 1)
if [ "$USERS" = "0" ]; then
  echo "▶ Données de démonstration"
  php artisan db:seed --force
fi

php artisan storage:link >/dev/null 2>&1 || true
php artisan config:clear >/dev/null

echo "▶ API prête sur ${APP_URL}"
exec php artisan serve --host=0.0.0.0 --port=8000
