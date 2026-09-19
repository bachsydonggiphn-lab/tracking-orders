const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const localDb = path.join(__dirname, '..', 'data', 'tracking.sqlite');
if (!fs.existsSync(localDb)) {
  console.log('No local db found to sync.');
  process.exit(0);
}

const conn = new Client();
conn.on('ready', () => {
  console.log('Connected via SSH. Starting SFTP upload of tracking.sqlite...');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const remoteDb = '/var/www/tracking-orders/data/tracking.sqlite';
    sftp.fastPut(localDb, remoteDb, (err) => {
      if (err) {
        console.error('Upload failed:', err);
        conn.end();
        process.exit(1);
      }
      console.log('Database uploaded successfully!');
      conn.exec('pm2 reload tracking-server', (err, stream) => {
        stream.on('close', () => {
          console.log('Reloaded tracking-server with synced DB!');
          conn.end();
        });
      });
    });
  });
}).connect({
  host: '162.4.176.249',
  port: 24700,
  username: 'root',
  password: '8QRkN417-)++$JTT>$h@'
});
