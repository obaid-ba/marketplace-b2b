#!/bin/sh
# Worker de file d'attente : diffusion des demandes, notifications e-mail, etc.
# Utilisé par le service worker de Render et par docker-compose.
set -e
cd /var/www/html

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

echo "▶ Worker prêt"
exec php artisan queue:work --tries=3 --timeout=90 --sleep=3 --max-time=3600
