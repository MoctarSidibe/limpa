# Limpa — Deployment Guide
**Server:** `37.60.240.199` (Contabo VPS)

---

## Port Map (full server)

| Port | Process | Notes |
|------|---------|-------|
| 22 | sshd | SSH |
| 80 | nginx | → ombia (5001) |
| 3001 | ombia-admin | PM2 |
| 3100 | Docker proxy | ombia |
| 3200 | Docker proxy | localhost only |
| 5000 | carte-grise-backend | PM2 |
| 5001 | ombia-express-api | PM2 |
| 5002 | ombia-docs | PM2 |
| 5432 | PostgreSQL | localhost only |
| 6379 | Redis | localhost only |
| 8080 | Jenkins | java |
| 8081 | nginx | → carte_grise |
| 8765 | Docker proxy | |
| **5003** | **limpa-backend** | **PM2 — reserved for Limpa** |
| **8082** | **nginx → Limpa admin** | **reserved for Limpa** |
| **8083** | **nginx → Limpa dashboard** | **reserved for Limpa** |

---

## Architecture on this Server

```
Internet
   │
   ├── :8082  ──► nginx (Limpa admin-dashboard static)
   │                └── /api/*     ──► localhost:5003 (limpa-backend)
   │                └── /uploads/* ──► localhost:5003
   │
   ├── :8083  ──► nginx (Limpa baker/courier dashboard static)
   │                └── /api/*     ──► localhost:5003
   │                └── /uploads/* ──► localhost:5003
   │
   └── Mobile app ──► http://37.60.240.199:8082/api
```

---

## 1. Prerequisites (already on server)

```bash
# Verify these are available
node --version      # v18+ required
npm --version
pm2 --version
psql --version      # PostgreSQL already running on :5432
nginx -v
```

---

## 2. Create PostgreSQL Database

```bash
sudo -u postgres psql
```

Inside psql:

```sql
CREATE DATABASE limpa_db;
CREATE USER limpa_user WITH PASSWORD 'choose_a_strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE limpa_db TO limpa_user;
-- PostgreSQL 15+ also requires this:
\c limpa_db
GRANT ALL ON SCHEMA public TO limpa_user;
\q
```

---

## 3. Clone the Repository

```bash
cd /var/www
git clone https://github.com/MoctarSidibe/limpa.git limpa
cd limpa
```

---

## 4. Backend Setup

### 4a. Install dependencies & compile

```bash
cd /var/www/limpa/backend
npm install
npx tsc           # compiles src/ → dist/
```

### 4b. Create environment file

```bash
nano /var/www/limpa/backend/.env
```

Paste (replace values):

```env
PORT=5003
DATABASE_URL="postgresql://limpa_user:choose_a_strong_password_here@localhost:5432/limpa_db"
JWT_SECRET="replace_with_a_long_random_string_min_32_chars"
```

Generate a secure JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 4c. Run Prisma migrations

```bash
cd /var/www/limpa/backend
npx prisma generate
npx prisma db push
```

### 4d. Create uploads directory

```bash
mkdir -p /var/www/limpa/backend/uploads
```

### 4e. Start with PM2

```bash
cd /var/www/limpa/backend
pm2 start dist/index.js --name limpa-backend
pm2 save
```

Verify it's running:

```bash
pm2 list
curl http://localhost:5003/api/products   # should return JSON
```

---

## 5. Build Admin Dashboard

```bash
cd /var/www/limpa/admin-dashboard
npm install
npm run build
# Output: /var/www/limpa/admin-dashboard/dist/
```

---

## 6. Build Baker/Courier Dashboard

```bash
cd /var/www/limpa/dashboard
npm install
npm run build
# Output: /var/www/limpa/dashboard/dist/
```

---

## 7. Nginx Configuration

Create the Limpa nginx config:

```bash
nano /etc/nginx/sites-available/limpa
```

Paste:

```nginx
# ── Limpa Admin Dashboard (:8082) ──────────────────────────────────────────
server {
    listen 8082;
    server_name 37.60.240.199;

    root /var/www/limpa/admin-dashboard/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to backend
    location /api/ {
        proxy_pass         http://127.0.0.1:5003;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_read_timeout 60s;
    }

    # Proxy uploaded images
    location /uploads/ {
        proxy_pass http://127.0.0.1:5003;
    }
}

# ── Limpa Baker/Courier Dashboard (:8083) ──────────────────────────────────
server {
    listen 8083;
    server_name 37.60.240.199;

    root /var/www/limpa/dashboard/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass         http://127.0.0.1:5003;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_read_timeout 60s;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:5003;
    }
}
```

Enable and reload:

```bash
ln -s /etc/nginx/sites-available/limpa /etc/nginx/sites-enabled/limpa
nginx -t                  # must say "syntax is ok"
systemctl reload nginx
```

---

## 8. Update Mobile App API URL

Before publishing the app, update `mobile/constants/api.ts`:

```ts
export const BASE_URL = 'http://37.60.240.199:8082';
export const API_URL  = `${BASE_URL}/api`;
```

Then rebuild/republish the Expo app via EAS or `expo build`.

---

## 9. Verify Everything

```bash
# Backend process
pm2 list | grep limpa

# Backend responds
curl http://localhost:5003/api/products

# Admin dashboard served
curl -s -o /dev/null -w "%{http_code}" http://37.60.240.199:8082/
# → 200

# Baker dashboard served
curl -s -o /dev/null -w "%{http_code}" http://37.60.240.199:8083/
# → 200

# API reachable through nginx
curl http://37.60.240.199:8082/api/products
# → {"products":[...]}
```

---

## 10. PM2 Startup on Reboot

```bash
pm2 startup          # follow the printed command (sudo ...)
pm2 save
```

---

## Updating the App (future deploys)

```bash
cd /var/www/limpa
git pull origin main

# Rebuild backend
cd backend && npx tsc && pm2 restart limpa-backend

# Rebuild dashboards (if changed)
cd ../admin-dashboard && npm run build
cd ../dashboard && npm run build

# Reload nginx (if config changed)
nginx -t && systemctl reload nginx
```

---

## Useful Commands

```bash
# Check all ports in use
sudo ss -tlnp | grep LISTEN

# PM2 logs for Limpa
pm2 logs limpa-backend --lines 100

# Restart backend
pm2 restart limpa-backend

# Check nginx errors
tail -f /var/log/nginx/error.log

# Check Limpa nginx access
tail -f /var/log/nginx/access.log | grep limpa
```

---

## Access URLs

| Service | URL |
|---------|-----|
| Admin dashboard | `http://37.60.240.199:8082` |
| Baker/courier dashboard | `http://37.60.240.199:8083` |
| Backend API (direct) | `http://37.60.240.199:5003/api` |
| Backend API (via nginx) | `http://37.60.240.199:8082/api` |
| Mobile app API | `http://37.60.240.199:8082/api` |
