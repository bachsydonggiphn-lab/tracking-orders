const { Client } = require('ssh2');

const conn = new Client();

const config = {
  host: '162.4.176.249',
  port: 24700,
  username: 'root',
  password: '8QRkN417-)++$JTT>$h@'
};

console.log('Connecting to VPS:', config.host + ':' + config.port);

conn.on('ready', () => {
  console.log('SSH Connection ready!');
  const cmd = `
    echo "=== SYSTEM INFO ==="
    uname -a
    cat /etc/os-release | grep PRETTY_NAME
    free -m
    df -h /
    echo "=== INSTALLED TOOLS ==="
    which node || echo "node not found"
    node -v || true
    which npm || echo "npm not found"
    npm -v || true
    which pm2 || echo "pm2 not found"
    pm2 -v || true
    which nginx || echo "nginx not found"
    nginx -v || true
    echo "=== LISTENING PORTS ==="
    ss -tulpn | grep LISTEN || netstat -tulpn | grep LISTEN
    echo "=== NGINX SITES ==="
    ls -la /etc/nginx/sites-enabled/ || echo "no nginx sites"
    echo "=== PM2 LIST ==="
    pm2 list || true
  `;

  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let output = '';
    stream.on('close', (code, signal) => {
      console.log('Command finished with code ' + code);
      console.log(output);
      conn.end();
    }).on('data', (data) => {
      output += data;
    }).stderr.on('data', (data) => {
      output += '[STDERR] ' + data;
    });
  });
}).on('error', (err) => {
  console.error('SSH Error:', err);
}).connect(config);
