#!/bin/bash
set -e

echo "🚀 Starting Judge0 Setup on AWS EC2 (Ubuntu)..."

# 1. Install Docker & Docker Compose
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker ubuntu
    echo "✅ Docker installed."
else
    echo "✅ Docker is already installed."
fi

# 2. Download Judge0 CE
echo "⬇️ Downloading Judge0 CE..."
cd ~
sudo apt-get update -y && sudo apt-get install unzip -y
rm -rf judge0-v1.13.1 judge0.zip
wget -qO judge0.zip https://github.com/judge0/judge0/releases/download/v1.13.1/judge0-v1.13.1.zip
unzip -q judge0.zip
cd judge0-v1.13.1

# 3. Generate secure tokens
echo "🔒 Configuring security tokens..."
POSTGRES_PASSWORD=$(openssl rand -hex 16)
REDIS_PASSWORD=$(openssl rand -hex 16)
AUTH_TOKEN=$(openssl rand -hex 32)

cat <<ENV_FILE > judge0.conf
REDIS_PASSWORD=$REDIS_PASSWORD
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
AUTH_TOKEN=$AUTH_TOKEN
ENABLE_WAIT_RESULT=true
ENABLE_COMPILER_OPTIONS=true
MAX_QUEUE_SIZE=100
CPU_TIME_LIMIT=10
MAX_FILE_SIZE=2048
MAX_MEMORY_LIMIT=262144
ENV_FILE

# 4. Start Services
echo "🐳 Starting database and Redis..."
sudo docker compose up -d db redis
echo "⏳ Waiting 15 seconds for DB to initialize..."
sleep 15

echo "🐳 Starting Judge0 server and workers..."
sudo docker compose up -d

echo "⏳ Waiting 15 seconds for Server to start..."
sleep 15

# 5. Verify Installation
echo "🧪 Verifying local installation..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:2358/languages)
if [ "$HTTP_STATUS" -eq 401 ] || [ "$HTTP_STATUS" -eq 200 ]; then
    echo ""
    echo "========================================================="
    echo "✅ SUCCESS! Judge0 is running successfully!"
    echo "========================================================="
    echo "⚠️  IMPORTANT: COPY THIS TOKEN AND SEND IT TO ME!"
    echo ""
    echo "JUDGE0_AUTH_TOKEN: $AUTH_TOKEN"
    echo "========================================================="
else
    echo "❌ Something went wrong. HTTP Status: $HTTP_STATUS"
    sudo docker compose logs --tail 50 server
fi
