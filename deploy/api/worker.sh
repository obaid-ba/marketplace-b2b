#!/bin/sh
# Worker de file d'attente : diffusion des demandes, notifications e-mail, etc.
# Utilisé par le service worker de Render et par docker-compose.
set -e
cd /var/www/html

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

echo "▶ Worker prêt"
exec php artisan queue:work --tries=3 --timeout=90 --sleep=3 --max-time=3600
