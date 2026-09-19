const { Client } = require('ssh2');

const conn = new Client();

const commands = [
  'echo "=== STEP 1: CLONE / PULL CODE ==="',
  'if [ -d "/var/www/tracking-orders/.git" ]; then cd /var/www/tracking-orders && git fetch origin main && git reset --hard origin/main; else git clone https://github.com/bachsydonggiphn-lab/tracking-orders.git /var/www/tracking-orders; fi',
  
  'echo "=== STEP 2: SETUP ENV ==="',
  'cd /var/www/tracking-orders && echo "PORT=5000" > .env',

  'echo "=== STEP 3: INSTALL DEPENDENCIES ==="',
  'cd /var/www/tracking-orders && npm install --production=false',

  'echo "=== STEP 4: BUILD APPLICATION ==="',
  'cd /var/www/tracking-orders && npm run build',

  'echo "=== STEP 5: PM2 PROCESS SETUP ==="',
  'cd /var/www/tracking-orders && pm2 delete tracking-server || true',
  'cd /var/www/tracking-orders && pm2 start dist/server.cjs --name tracking-server --time',
  'pm2 save',

  'echo "=== STEP 6: UFW FIREWALL CONFIG ==="',
  'ufw allow 5000/tcp comment "Tracking Port"',
  'ufw status verbose',

  'echo "=== STEP 7: NGINX CONFIG FOR tracking.gepoder.click ==="',
  `cat << 'EOF' > /etc/nginx/sites-available/tracking.gepoder.click
server {
    listen 80;
    listen [::]:80;
    listen 443 ssl;
    listen [::]:443 ssl;

    server_name tracking.gepoder.click;

    ssl_certificate /etc/nginx/ssl/nginx.crt;
    ssl_certificate_key /etc/nginx/ssl/nginx.key;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\$host;
        proxy_cache_bypass \\$http_upgrade;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
    }
}
EOF`,
  'ln -sf /etc/nginx/sites-available/tracking.gepoder.click /etc/nginx/sites-enabled/tracking.gepoder.click',
  'nginx -t',
  'systemctl reload nginx',

  'echo "=== STEP 8: VERIFY ENDPOINTS ==="',
  'sleep 2',
  'curl -I http://127.0.0.1:5000/ || true',
  'pm2 list'
].join('\n');

console.log('Connecting to VPS to start full deployment...');

conn.on('ready', () => {
  console.log('Connected! Executing deployment script...');
  conn.exec(commands, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code) => {
      console.log('Deployment completed with exit code:', code);
      conn.end();
      process.exit(code || 0);
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).connect({
  host: '162.4.176.249',
  port: 24700,
  username: 'root',
  password: '8QRkN417-)++$JTT>$h@'
});
