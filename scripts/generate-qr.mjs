// Bake QR codes.
// Usage: node scripts/generate-qr.mjs <publicUrl> <adminToken> <settingsToken>
// Get the tokens with `make tokens`.
// Writes:
//   qr-print/admin-qr.png, qr-print/settings-qr.png - carry a token, so they
//     go to a gitignored folder for printing, never public/ (the repo is
//     public and the app serves everything in public/)
//   public/qr/game-qr.svg (no token: the garage door shows it to everyone)
//   public/qr/home-qr.svg (no token: the remote shows it to visitors' phones)

import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

const [publicUrl, adminToken, settingsToken] = process.argv.slice(2);

if (!publicUrl || !adminToken || !settingsToken) {
  console.error('Usage: node scripts/generate-qr.mjs <publicUrl> <adminToken> <settingsToken>');
  process.exit(1);
}

const dir = 'public/qr';
const printDir = 'qr-print';
fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync(printDir, { recursive: true });

const adminUrl = `${publicUrl}/remote.html?token=${adminToken}`;
const settingsUrl = `${publicUrl}/settings.html?token=${settingsToken}`;
const gameUrl = `${publicUrl}/game`;
const homeUrl = `${publicUrl}/`;

const width = { width: 512, margin: 2 };

await QRCode.toFile(path.join(printDir, 'admin-qr.png'), adminUrl, width);
await QRCode.toFile(path.join(printDir, 'settings-qr.png'), settingsUrl, width);

// SVG so it stays sharp at any size
await QRCode.toFile(path.join(dir, 'game-qr.svg'), gameUrl, { margin: 2 });
await QRCode.toFile(path.join(dir, 'home-qr.svg'), homeUrl, { margin: 2 });

console.log('Generated admin-qr.png and settings-qr.png in', printDir, '(print, do not commit)');
console.log('Generated game-qr.svg and home-qr.svg in', dir);
