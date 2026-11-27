# syntax=docker/dockerfile:1

# API Laravel — image de production (nginx + PHP-FPM + supervisor).
# Contexte de construction : racine du dépôt (voir deploy/docker-compose.yml et render.yaml).

# 1. Dépendances PHP, sans le code source pour profiter du cache Docker.
FROM composer:2 AS vendor
WORKDIR /app
COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist \
        --no-scripts --no-autoloader
COPY backend/ ./
RUN composer dump-autoload --optimize --classmap-authoritative

# 2. Image d'exécution.
FROM php:8.3-fpm-alpine

RUN apk add --no-cache nginx supervisor icu-libs libzip libpng libjpeg-turbo freetype postgresql-libs \
    && apk add --no-cache --virtual .build-deps $PHPIZE_DEPS icu-dev libzip-dev libpng-dev \
        libjpeg-turbo-dev freetype-dev postgresql-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" pdo_pgsql gd zip intl bcmath pcntl opcache \
    && apk del .build-deps \
    && rm -rf /var/cache/apk/* /tmp/*

WORKDIR /var/www/html

COPY --from=vendor /app ./
COPY deploy/api/php.ini /usr/local/etc/php/conf.d/zz-marketplace.ini
COPY deploy/api/nginx.conf.template /etc/nginx/http.d/marketplace.conf.template
COPY deploy/api/supervisord.conf /etc/supervisor/conf.d/marketplace.conf
COPY deploy/api/entrypoint.sh deploy/api/worker.sh /usr/local/bin/

RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/worker.sh \
    && rm -f /etc/nginx/http.d/default.conf \
    && mkdir -p storage/app/public storage/app/private storage/framework/cache/data \
        storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT:-8000}/up" >/dev/null 2>&1 || exit 1

CMD ["/usr/local/bin/entrypoint.sh"]
