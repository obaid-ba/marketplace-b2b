#!/bin/sh
# Démarrage de l'API : port nginx, clé, attente de la base, caches, migrations, puis
# nginx + PHP-FPM sous supervisor (voir supervisord.conf).
set -e
cd /var/www/html

PORT="${PORT:-8000}"
export PORT

# --- nginx : le port d'écoute dépend de l'hébergeur (Render impose $PORT) ---
sed "s/__PORT__/${PORT}/g" /etc/nginx/http.d/marketplace.conf.template \
    > /etc/nginx/http.d/marketplace.conf

# --- Clé d'application ---
if [ -z "$APP_KEY" ]; then
    if [ "$APP_ENV" = "production" ]; then
        echo "APP_KEY manquante : renseignez-la dans les variables d'environnement." >&2
        exit 1
    fi
    KEY_FILE=storage/app/.app_key
    [ -f "$KEY_FILE" ] || php -r 'echo "base64:".base64_encode(random_bytes(32));' > "$KEY_FILE"
    APP_KEY="$(cat "$KEY_FILE")"
    export APP_KEY
fi

# --- Attente de la base (Neon ou service PostgreSQL local) ---
echo "▶ Attente de la base de données…"
i=0
until php -r '
    $url = getenv("DB_URL");
    try {
        if ($url) {
            $parts = parse_url($url);
            $dsn = sprintf("pgsql:host=%s;port=%s;dbname=%s", $parts["host"], $parts["port"] ?? 5432, ltrim($parts["path"] ?? "", "/"));
            $user = $parts["user"] ?? ""; $pass = $parts["pass"] ?? "";
        } else {
            $dsn = sprintf("pgsql:host=%s;port=%s;dbname=%s", getenv("DB_HOST"), getenv("DB_PORT") ?: 5432, getenv("DB_DATABASE"));
            $user = getenv("DB_USERNAME"); $pass = getenv("DB_PASSWORD");
        }
        new PDO($dsn, $user, $pass, [PDO::ATTR_TIMEOUT => 3]);
    } catch (Throwable $e) { exit(1); }
'; do
    i=$((i + 1))
    if [ "$i" -gt 60 ]; then
        echo "Base injoignable après 2 minutes." >&2
        exit 1
    fi
    sleep 2
done
echo "  base joignable"

# --- Caches ---
php artisan config:cache
php artisan route:cache || echo "  route:cache ignoré"
php artisan view:cache || echo "  view:cache ignoré"

# --- Schéma et données de démonstration ---
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    echo "▶ Migrations"
    php artisan migrate --force
fi

if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
    USERS=$(php artisan tinker --execute='echo \App\Models\User::count();' 2>/dev/null | tail -n 1)
    if [ "$USERS" = "0" ]; then
        echo "▶ Données de démonstration"
        php artisan db:seed --force
    fi
fi

if [ "${MEDIA_DRIVER:-local}" = "local" ]; then
    php artisan storage:link >/dev/null 2>&1 || true
fi

echo "▶ API prête sur le port ${PORT}"
exec supervisord -c /etc/supervisor/conf.d/marketplace.conf
