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

# --- Attente de la base (TiDB PostgreSQL-compatible ou PostgreSQL local) ---
# La connexion suit la configuration Laravel : variables DB_* et/ou DB_URL.
echo "▶ Attente de la base de données…"
i=0
until php -r '
    $url = (string) getenv("DB_URL");
    $conn = getenv("DB_CONNECTION") ?: "pgsql";
    $host = getenv("DB_HOST") ?: "127.0.0.1";
    $port = getenv("DB_PORT") ?: "5432";
    $db = getenv("DB_DATABASE") ?: "laravel";
    $user = getenv("DB_USERNAME") ?: "";
    $pass = getenv("DB_PASSWORD") ?: "";
    $sslmode = getenv("DB_SSLMODE") ?: "";
    $sslrootcert = getenv("DB_SSLROOTCERT") ?: "";
    if ($url !== "") {
        $parts = @parse_url($url);
        if (is_array($parts) && !empty($parts["host"])) {
            $host = $parts["host"];
            if (!empty($parts["port"])) { $port = (string) $parts["port"]; }
            if (!empty($parts["path"])) {
                $path = rawurldecode(ltrim($parts["path"], "/"));
                if ($path !== "") { $db = $path; }
            }
            if (isset($parts["user"])) { $user = urldecode($parts["user"]); }
            if (isset($parts["pass"])) { $pass = urldecode($parts["pass"]); }
            if (!empty($parts["scheme"])) { $conn = strtolower($parts["scheme"]); }
            if (!empty($parts["query"])) {
                parse_str($parts["query"], $q);
                if (!empty($q["sslmode"])) { $sslmode = $q["sslmode"]; }
                if (!empty($q["sslrootcert"])) { $sslrootcert = $q["sslrootcert"]; }
            }
        }
    }
    $isMySql = in_array($conn, ["mysql", "mariadb"], true);
    try {
        if ($isMySql) {
            $dsn = "mysql:host={$host};port={$port};dbname={$db}";
            $options = [PDO::ATTR_TIMEOUT => 5, PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION];
            $ca = getenv("MYSQL_ATTR_SSL_CA");
            if ($ca !== false && $ca !== "") { $options[PDO::MYSQL_ATTR_SSL_CA] = $ca; }
        } else {
            $dsn = "pgsql:host={$host};port={$port};dbname={$db}";
            if ($sslmode !== "") { $dsn .= ";sslmode={$sslmode}"; }
            if ($sslrootcert !== "") { $dsn .= ";sslrootcert={$sslrootcert}"; }
            $options = [PDO::ATTR_TIMEOUT => 5, PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION];
        }
        new PDO($dsn, $user, $pass, $options);
    } catch (Throwable $e) { if (!file_exists("/tmp/db-wait-error")) { file_put_contents("/tmp/db-wait-error", $e->getMessage()); } exit(1); }
'; do
    i=$((i + 1))
    if [ "$i" -eq 1 ] && [ -f /tmp/db-wait-error ]; then
        echo "  connexion impossible : $(cat /tmp/db-wait-error)" >&2
    fi
    if [ "$i" -gt 90 ]; then
        echo "Base injoignable après 3 minutes." >&2
        if [ -f /tmp/db-wait-error ]; then
            echo "  erreur : $(cat /tmp/db-wait-error)" >&2
        fi
        exit 1
    fi
    sleep 2
done
rm -f /tmp/db-wait-error
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
