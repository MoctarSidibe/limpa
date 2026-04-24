#!/usr/bin/env bash
# Limpa — Full deployment script for 37.60.240.199
# Run as root from /var/www/limpa after git clone
# Usage:
#   First deploy : bash deploy.sh --install
#   Update only  : bash deploy.sh --update

set -e

REPO_DIR="/var/www/limpa"
BACKEND_PORT=5003
ADMIN_PORT=8082
DASHBOARD_PORT=8083
PM2_NAME="limpa-backend"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[limpa]${NC} $1"; }
warn()    { echo -e "${YELLOW}[limpa]${NC} $1"; }
abort()   { echo -e "${RED}[limpa] ERROR:${NC} $1"; exit 1; }

# ── Argument check ────────────────────────────────────────────────────────────
MODE="${1:-}"
if [[ "$MODE" != "--install" && "$MODE" != "--update" ]]; then
  echo "Usage: bash deploy.sh --install   (first-time setup)"
  echo "       bash deploy.sh --update    (pull + rebuild + restart)"
  exit 1
fi

cd "$REPO_DIR" || abort "Directory $REPO_DIR not found. Clone the repo first:\n  git clone https://github.com/MoctarSidibe/limpa.git $REPO_DIR"

# ════════════════════════════════════════════════════════════════════════════
# UPDATE MODE — pull, rebuild, restart
# ════════════════════════════════════════════════════════════════════════════
if [[ "$MODE" == "--update" ]]; then
  info "Pulling latest code..."
  git pull origin main

  info "Recompiling backend..."
  cd "$REPO_DIR/backend"
  npm install --omit=dev
  npx tsc
  npx prisma generate
  npx prisma db push
  pm2 restart "$PM2_NAME" || abort "PM2 process '$PM2_NAME' not found. Run --install first."

  info "Rebuilding admin dashboard..."
  cd "$REPO_DIR/admin-dashboard"
  npm install --omit=dev
  npm run build

  info "Rebuilding baker/courier dashboard..."
  cd "$REPO_DIR/dashboard"
  npm install --omit=dev
  npm run build

  nginx -t && systemctl reload nginx
  info "Done. Limpa updated successfully."
  pm2 list | grep "$PM2_NAME"
  exit 0
fi

# ════════════════════════════════════════════════════════════════════════════
# INSTALL MODE — full first-time setup
# ════════════════════════════════════════════════════════════════════════════
info "Starting first-time Limpa deployment..."

# ── 1. Check required tools ───────────────────────────────────────────────
for cmd in node npm pm2 psql nginx; do
  command -v "$cmd" >/dev/null 2>&1 || abort "'$cmd' not found. Install it before running this script."
done
info "All required tools present."

# ── 2. Check .env exists ─────────────────────────────────────────────────
ENV_FILE="$REPO_DIR/backend/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  warn ".env not found — creating template at $ENV_FILE"
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
  cat > "$ENV_FILE" <<EOF
PORT=$BACKEND_PORT
DATABASE_URL="postgresql://limpa_user:CHANGE_THIS_PASSWORD@localhost:5432/limpa_db"
JWT_SECRET="$JWT_SECRET"
EOF
  echo ""
  warn "────────────────────────────────────────────────────────"
  warn "ACTION REQUIRED:"
  warn "  1. Create the PostgreSQL DB (see DEPLOYMENT.md step 2)"
  warn "  2. Update DATABASE_URL password in: $ENV_FILE"
  warn "  Then re-run: bash deploy.sh --install"
  warn "────────────────────────────────────────────────────────"
  exit 1
fi

# Verify DATABASE_URL is not still the placeholder
if grep -q "CHANGE_THIS_PASSWORD" "$ENV_FILE"; then
  abort "Please update the DATABASE_URL password in $ENV_FILE before continuing."
fi
info ".env found and configured."

# ── 3. Backend ────────────────────────────────────────────────────────────
info "Installing backend dependencies..."
cd "$REPO_DIR/backend"
npm install --omit=dev

info "Compiling TypeScript..."
npx tsc

info "Running Prisma migrations..."
npx prisma generate
npx prisma db push

info "Creating uploads directory..."
mkdir -p "$REPO_DIR/backend/uploads"

info "Starting backend with PM2..."
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME"
else
  pm2 start "$REPO_DIR/backend/dist/index.js" --name "$PM2_NAME"
fi
pm2 save

# ── 4. Admin dashboard ───────────────────────────────────────────────────
info "Building admin dashboard..."
cd "$REPO_DIR/admin-dashboard"
npm install --omit=dev
npm run build

# ── 5. Baker/courier dashboard ───────────────────────────────────────────
info "Building baker/courier dashboard..."
cd "$REPO_DIR/dashboard"
npm install --omit=dev
npm run build

# ── 6. Nginx config ──────────────────────────────────────────────────────
NGINX_CONF="/etc/nginx/sites-available/limpa"
info "Writing nginx config to $NGINX_CONF..."

cat > "$NGINX_CONF" <<NGINX
# ── Limpa Admin Dashboard (:$ADMIN_PORT) ──────────────────────────────────
server {
    listen $ADMIN_PORT;
    server_name 37.60.240.199;

    root $REPO_DIR/admin-dashboard/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass         http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_read_timeout 60s;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
    }
}

# ── Limpa Baker/Courier Dashboard (:$DASHBOARD_PORT) ──────────────────────
server {
    listen $DASHBOARD_PORT;
    server_name 37.60.240.199;

    root $REPO_DIR/dashboard/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass         http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_read_timeout 60s;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
    }
}
NGINX

# Enable site
NGINX_ENABLED="/etc/nginx/sites-enabled/limpa"
if [[ ! -L "$NGINX_ENABLED" ]]; then
  ln -s "$NGINX_CONF" "$NGINX_ENABLED"
  info "Nginx site enabled."
fi

nginx -t || abort "Nginx config test failed. Check $NGINX_CONF"
systemctl reload nginx
info "Nginx reloaded."

# ── 7. PM2 startup hook ──────────────────────────────────────────────────
info "Saving PM2 process list for reboot persistence..."
pm2 save

# ── 8. Smoke tests ───────────────────────────────────────────────────────
info "Running smoke tests..."
sleep 2

BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$BACKEND_PORT/api/products)
ADMIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$ADMIN_PORT/)
DASH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$DASHBOARD_PORT/)

echo ""
echo "────────────────────────────────────────────────────────"
echo -e "  Backend API   :$BACKEND_PORT   → HTTP $([[ $BACKEND_STATUS == 200 ]] && echo -e "${GREEN}$BACKEND_STATUS OK${NC}" || echo -e "${RED}$BACKEND_STATUS FAIL${NC}")"
echo -e "  Admin dash    :$ADMIN_PORT   → HTTP $([[ $ADMIN_STATUS == 200 ]] && echo -e "${GREEN}$ADMIN_STATUS OK${NC}" || echo -e "${RED}$ADMIN_STATUS FAIL${NC}")"
echo -e "  Baker dash    :$DASHBOARD_PORT   → HTTP $([[ $DASH_STATUS == 200 ]] && echo -e "${GREEN}$DASH_STATUS OK${NC}" || echo -e "${RED}$DASH_STATUS FAIL${NC}")"
echo "────────────────────────────────────────────────────────"
echo ""
info "Deployment complete!"
echo ""
echo "  Admin dashboard  → http://37.60.240.199:$ADMIN_PORT"
echo "  Baker dashboard  → http://37.60.240.199:$DASHBOARD_PORT"
echo "  Mobile API URL   → http://37.60.240.199:$ADMIN_PORT/api"
echo ""
echo "  PM2 logs: pm2 logs $PM2_NAME"
