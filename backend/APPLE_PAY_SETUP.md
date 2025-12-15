# Настройка Apple Pay для Stripe

## Требования

Apple Pay работает только при соблюдении следующих условий:

1. **HTTPS** — сайт должен работать по HTTPS (не HTTP)
2. **Верифицированный домен** — домен должен быть добавлен в Stripe Dashboard
3. **Совместимое устройство** — Safari на Mac/iOS или Chrome на Android с Google Pay

## Шаг 1: Регистрация домена в Stripe Dashboard

### 1.1. Перейдите в настройки Apple Pay

1. Откройте [Stripe Dashboard](https://dashboard.stripe.com)
2. Перейдите в **Settings** → **Payment methods** → **Apple Pay**
3. Или напрямую: https://dashboard.stripe.com/settings/payment_methods

### 1.2. Добавьте домен

1. Нажмите **"Add new domain"**
2. Введите ваш домен: `phonecleanerplus.info` (без https://)
3. Stripe предоставит файл верификации

### 1.3. Разместите файл верификации

Stripe потребует разместить файл по адресу:
```
https://phonecleanerplus.info/.well-known/apple-developer-merchantid-domain-association
```

**Вариант 1: Через nginx**

Добавьте в конфигурацию nginx:

```nginx
location /.well-known/apple-developer-merchantid-domain-association {
    default_type application/octet-stream;
    alias /var/www/phonecleanerplus.info/.well-known/apple-developer-merchantid-domain-association;
}
```

**Вариант 2: Статический файл**

Создайте файл в директории:
```bash
mkdir -p frontend/.well-known
# Скопируйте содержимое файла от Stripe
nano frontend/.well-known/apple-developer-merchantid-domain-association
```

### 1.4. Подтвердите домен

После размещения файла нажмите **"Verify"** в Stripe Dashboard.

## Шаг 2: Настройка HTTPS

### Вариант A: Продакшен с nginx + Let's Encrypt

```bash
# Установите certbot
sudo apt install certbot python3-certbot-nginx

# Получите сертификат
sudo certbot --nginx -d phonecleanerplus.info -d www.phonecleanerplus.info
```

### Вариант B: Локальная разработка с ngrok

ngrok автоматически предоставляет HTTPS:

```bash
ngrok http 8080
```

Используйте HTTPS URL от ngrok (например: `https://abc123.ngrok-free.app`)

**Важно:** Для тестирования Apple Pay через ngrok, нужно добавить ngrok домен в Stripe Dashboard.

## Шаг 3: Тестирование

### Тестовые карты для Apple Pay

В тестовом режиме Stripe используйте тестовые карты в Apple Wallet:

1. На iPhone откройте **Settings** → **Wallet & Apple Pay**
2. Добавьте тестовую карту: `4242 4242 4242 4242`
3. Используйте любую дату истечения и CVC

### Проверка доступности

Откройте консоль браузера на странице оплаты. Вы должны увидеть:

```
Apple Pay / Google Pay available: {applePay: true}
```

Если видите:
```
Apple Pay / Google Pay not available
```

Проверьте:
- HTTPS активен
- Домен верифицирован
- Браузер поддерживает Apple Pay/Google Pay
- Есть карты в Wallet

## Шаг 4: Конфигурация nginx для продакшена

Пример полной конфигурации nginx:

```nginx
server {
    listen 80;
    server_name phonecleanerplus.info www.phonecleanerplus.info;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name phonecleanerplus.info www.phonecleanerplus.info;

    ssl_certificate /etc/letsencrypt/live/phonecleanerplus.info/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/phonecleanerplus.info/privkey.pem;

    root /var/www/phonecleanerplus.info/frontend;
    index index.html;

    # Apple Pay domain verification
    location /.well-known/apple-developer-merchantid-domain-association {
        default_type application/octet-stream;
    }

    # Static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy to FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Шаг 5: Запуск FastAPI в продакшене

### Systemd сервис

Создайте файл `/etc/systemd/system/phonecleaner-api.service`:

```ini
[Unit]
Description=Phone Cleaner Plus API
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/phonecleanerplus.info
Environment="PATH=/var/www/phonecleanerplus.info/backend/venv/bin"
ExecStart=/var/www/phonecleanerplus.info/backend/venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000

[Install]
WantedBy=multi-user.target
```

Запуск:
```bash
sudo systemctl daemon-reload
sudo systemctl enable phonecleaner-api
sudo systemctl start phonecleaner-api
```

## Troubleshooting

### Apple Pay кнопка не появляется

1. **Проверьте HTTPS**: Apple Pay требует HTTPS
2. **Проверьте домен**: Домен должен быть верифицирован в Stripe
3. **Проверьте браузер**: Используйте Safari на Mac/iOS
4. **Проверьте Wallet**: Должна быть хотя бы одна карта в Apple Wallet

### Ошибка "Domain not registered"

1. Убедитесь, что файл верификации доступен:
   ```bash
   curl https://yourdomain.com/.well-known/apple-developer-merchantid-domain-association
   ```
2. Повторите верификацию в Stripe Dashboard

### Google Pay не работает

1. Google Pay требует Chrome на Android
2. Должна быть настроена карта в Google Pay
3. Домен должен быть на HTTPS

## Полезные ссылки

- [Stripe Apple Pay Documentation](https://stripe.com/docs/apple-pay)
- [Stripe Payment Request Button](https://stripe.com/docs/stripe-js/elements/payment-request-button)
- [Apple Pay on the Web](https://developer.apple.com/documentation/apple_pay_on_the_web)

