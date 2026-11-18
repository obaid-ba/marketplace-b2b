#!/bin/sh
# Worker de file d'attente : diffusion des demandes, notifications e-mail, etc.
# Utilisé par le service worker de Render et par docker-compose.
set -e
cd /var/www/html

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
    $dsn = "pgsql:host={$host};port={$port};dbname={$db};sslmode={$sslmode}";
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

echo "▶ Worker prêt"
exec php artisan queue:work --tries=3 --timeout=90 --sleep=3 --max-time=3600
