#!/bin/bash
set -e

echo "🚀 Starting Judge0 Setup on Oracle Cloud Always-Free ARM (Ubuntu)..."

# 1. Install Docker & Docker Compose if not present
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg unzip
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker $USER
    echo "✅ Docker installed."
else
    echo "✅ Docker is already installed."
fi

# 2. Download Judge0 v1.13.1
echo "⬇️ Downloading Judge0 CE..."
cd ~
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

# 4. Open Firewall (Oracle Ubuntu drops incoming by default)
echo "🛡️ Configuring Ubuntu Firewall to allow port 2358..."
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 2358 -j ACCEPT || true
sudo netfilter-persistent save || true

# 5. Start Services
echo "🐳 Starting database and Redis..."
sudo docker compose up -d db redis
echo "⏳ Waiting 15 seconds for DB to initialize..."
sleep 15

echo "🐳 Starting Judge0 server and workers..."
sudo docker compose up -d

echo "⏳ Waiting 15 seconds for Server to start..."
sleep 15

# 6. Verify Installation
echo "🧪 Verifying local installation..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:2358/languages)
if [ "$HTTP_STATUS" -eq 401 ] || [ "$HTTP_STATUS" -eq 200 ]; then
    echo ""
    echo "========================================================="
    echo "✅ SUCCESS! Judge0 is running successfully!"
    echo "========================================================="
    echo "⚠️  IMPORTANT: COPY THESE DETAILS AND SEND THEM TO ME!"
    echo ""
    echo "JUDGE0_AUTH_TOKEN: $AUTH_TOKEN"
    echo "========================================================="
    echo "Next step: In Oracle Cloud Console, go to your VCN -> Default Security List -> Add Ingress Rule:"
    echo "Source CIDR: 0.0.0.0/0 | IP Protocol: TCP | Destination Port Range: 2358"
    echo "========================================================="
else
    echo "❌ Something went wrong. HTTP Status: $HTTP_STATUS"
    sudo docker compose logs --tail 50 server
fi
