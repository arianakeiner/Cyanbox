# CYANBOX · Servicio de persistencia (API Laravel) para el entorno Docker
FROM php:8.3-cli
RUN apt-get update && apt-get install -y --no-install-recommends git unzip libpq-dev libsqlite3-dev libzip-dev \
    && docker-php-ext-install pdo_pgsql pdo_sqlite zip \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-interaction --prefer-dist --no-scripts --no-autoloader
COPY . .
RUN composer dump-autoload --optimize && rm -f .env && cp .env.example .env
EXPOSE 8000
CMD ["php", "iniciar.php", "produccion"]
