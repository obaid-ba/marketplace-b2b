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
    $url = (string) getenv("DB_URL");
    $sslmode = getenv("DB_SSLMODE") ?: "require";
    $host = getenv("DB_HOST") ?: "127.0.0.1";
    $port = getenv("DB_PORT") ?: "5432";
    $db = getenv("DB_DATABASE") ?: "laravel";
    $user = getenv("DB_USERNAME") ?: "";
    $pass = getenv("DB_PASSWORD") ?: "";
    if ($url !== "") {
        $parts = @parse_url($url);
        if (is_array($parts) && !empty($parts["host"])) {
            $host = $parts["host"];
            $port = (string) ($parts["port"] ?? 5432);
            $path = isset($parts["path"]) ? rawurldecode(ltrim($parts["path"], "/")) : $db;
            if ($path !== "") { $db = $path; }
            if (isset($parts["user"])) { $user = urldecode($parts["user"]); }
            if (isset($parts["pass"])) { $pass = urldecode($parts["pass"]); }
            if (!empty($parts["query"])) {
                parse_str($parts["query"], $q);
                if (!empty($q["sslmode"])) { $sslmode = $q["sslmode"]; }
            }
        }
    }
    $dsn = "pgsql:host={$host};port={$port};dbname=" . str_replace(["\\", "'"], ["\\\\", "\\'"], $db) . ";sslmode={$sslmode}";
    try {
        new PDO($dsn, $user, $pass, [PDO::ATTR_TIMEOUT => 5, PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
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
