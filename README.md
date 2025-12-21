# Phone Cleaner Plus - Документация проекта

## 📋 Описание

Веб-приложение для подписки на сервис очистки телефона с интеграцией Stripe для обработки платежей. Проект состоит из FastAPI бэкенда и статического фронтенда на HTML/CSS/JavaScript.

## 🗂️ Структура проекта

```
phonecleanerplus.info/
├── backend/              # FastAPI бэкенд
│   ├── main.py          # Точка входа приложения
│   ├── config.py        # Конфигурация (переменные окружения)
│   ├── requirements.txt # Python зависимости
│   ├── Dockerfile       # Docker образ для бэкенда
│   ├── .env            # Переменные окружения (создать из env.example)
│   ├── routers/        # API маршруты
│   │   └── stripe_router.py  # Stripe API endpoints
│   └── services/       # Бизнес-логика
│       └── stripe_service.py  # Работа со Stripe API
│
├── frontend/            # Статический фронтенд
│   ├── index.html      # Главная страница
│   ├── payment.html    # Страница оплаты
│   ├── welcome.html    # Страница после успешной оплаты
│   ├── scripts/        # JavaScript файлы
│   │   └── main.js     # Основная логика фронтенда + Stripe
│   ├── styles/         # CSS стили
│   ├── images/         # Изображения и иконки
│   ├── nginx.conf      # Конфигурация Nginx
│   └── Dockerfile      # Docker образ для фронтенда
│
├── docker-compose.yml   # Docker Compose конфигурация
└── README.md           # Эта документация
```

## 🚀 Быстрый старт

### Локальная разработка

#### 1. Настройка бэкенда

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# или
venv\Scripts\activate     # Windows

pip install -r requirements.txt
cp env.example .env
# Отредактируйте .env и добавьте свои Stripe ключи
```

#### 2. Запуск бэкенда

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Бэкенд будет доступен на `http://localhost:8000`

#### 3. Запуск фронтенда

```bash
cd frontend
python3 -m http.server 8080
# или используйте любой другой HTTP сервер
```

Фронтенд будет доступен на `http://localhost:8080`

### Развертывание через Docker

```bash
# 1. Создайте файл backend/.env из env.example
cp backend/env.example backend/.env
# Отредактируйте backend/.env

# 2. Запустите контейнеры
docker compose up --build -d

# 3. Проверьте статус
docker compose ps

# 4. Просмотр логов
docker compose logs -f
```

## ⚙️ Конфигурация

### Переменные окружения (backend/.env)

```env
# Stripe API ключи (получить на https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...

# URL приложения
BASE_URL=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Период пробного использования (дни)
TRIAL_PERIOD_DAYS=3

# Режим отладки
DEBUG=False
```

### Настройка Stripe

1. **API ключи**: Получите в [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. **Webhook**: Создайте endpoint в [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
   - URL: `https://yourdomain.com/api/stripe/webhook`
   - События: `customer.subscription.created`, `invoice.paid`
3. **Price ID**: Создайте продукт и цену в Stripe Dashboard
4. **Apple Pay**: Настройте домен в [Stripe Settings](https://dashboard.stripe.com/settings/payment_methods)

## 📁 Основные файлы

### Бэкенд

- **`backend/main.py`** - Точка входа FastAPI приложения, настройка CORS и роутеров
- **`backend/config.py`** - Загрузка переменных окружения через Pydantic
- **`backend/routers/stripe_router.py`** - API endpoints:
  - `POST /api/stripe/create-setup-intent` - Создание SetupIntent
  - `POST /api/stripe/create-subscription` - Создание подписки
  - `POST /api/stripe/webhook` - Обработка webhook от Stripe
  - `GET /api/stripe/session/{session_id}` - Получение информации о сессии
- **`backend/services/stripe_service.py`** - Бизнес-логика работы со Stripe:
  - Создание клиентов
  - Создание подписок
  - Обработка webhook событий

### Фронтенд

- **`frontend/payment.html`** - Страница оплаты с формами карт и Apple Pay
- **`frontend/scripts/main.js`** - Основная логика:
  - Инициализация Stripe Elements
  - Обработка форм оплаты
  - Интеграция Apple Pay / Google Pay
  - Валидация и отправка данных на бэкенд
- **`frontend/welcome.html`** - Страница после успешной оплаты

## 🐳 Docker

### Структура

- **`api`** сервис: FastAPI бэкенд на порту 8000
- **`web`** сервис: Nginx фронтенд на порту 8080 (localhost)

### Команды

```bash
# Запуск
docker compose up -d

# Остановка
docker compose down

# Пересборка
docker compose up --build -d

# Логи
docker compose logs -f api
docker compose logs -f web

# Перезапуск
docker compose restart api
```


## 🛠️ Технологии

- **Backend**: FastAPI, Python 3.12, Stripe API
- **Frontend**: HTML, CSS, JavaScript, Stripe.js
- **Deployment**: Docker, Docker Compose, Nginx
- **Payment**: Stripe (Cards, Apple Pay, Google Pay)

