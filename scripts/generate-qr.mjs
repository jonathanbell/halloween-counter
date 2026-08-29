// Bake QR codes for the admin pages at build time.
// Usage: node scripts/generate-qr.mjs <publicUrl> <adminToken> <settingsToken>
// Writes: public/qr/admin-qr.png and public/qr/settings-qr.png

import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

const [publicUrl, adminToken, settingsToken] = process.argv.slice(2);

if (!publicUrl || !adminToken || !settingsToken) {
  console.error('Usage: node scripts/generate-qr.mjs <publicUrl> <adminToken> <settingsToken>');
  process.exit(1);
}

const dir = 'public/qr';
fs.mkdirSync(dir, { recursive: true });

const adminUrl = `${publicUrl}/remote.html?token=${adminToken}`;
const settingsUrl = `${publicUrl}/settings.html?token=${settingsToken}`;

const width = { width: 512, margin: 2 };

await QRCode.toFile(path.join(dir, 'admin-qr.png'), adminUrl, width);
await QRCode.toFile(path.join(dir, 'settings-qr.png'), settingsUrl, width);

console.log('Generated admin-qr.png and settings-qr.png in', dir);
