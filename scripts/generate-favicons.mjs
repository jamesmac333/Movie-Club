import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

async function generate() {
  const publicDir = path.resolve(process.cwd(), 'public');
  const sourceSvg = path.join(publicDir, 'favicon.svg');
  const sourcePng = path.join(publicDir, 'icon-512.png');

  const inputBuffer = fs.existsSync(sourceSvg) 
    ? fs.readFileSync(sourceSvg) 
    : fs.readFileSync(sourcePng);

  console.log('Generating crisp multi-resolution favicons...');

  // 1. Generate 48x48 PNG (Google Search standard multiple of 48px)
  await sharp(inputBuffer)
    .resize(48, 48)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'favicon-48x48.png'));
  console.log('Created favicon-48x48.png');

  // 2. Generate 96x96 PNG
  await sharp(inputBuffer)
    .resize(96, 96)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'favicon-96x96.png'));
  console.log('Created favicon-96x96.png');

  // 3. Generate 32x32 PNG
  await sharp(inputBuffer)
    .resize(32, 32)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'favicon-32x32.png'));
  console.log('Created favicon-32x32.png');

  // 4. Generate 16x16 PNG
  await sharp(inputBuffer)
    .resize(16, 16)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'favicon-16x16.png'));
  console.log('Created favicon-16x16.png');

  // 5. Generate 180x180 Apple touch icon
  await sharp(inputBuffer)
    .resize(180, 180)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Created apple-touch-icon.png');

  // 6. Generate 192x192 & 512x512 PWA icons
  await sharp(inputBuffer)
    .resize(192, 192)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'icon-192.png'));
  console.log('Created icon-192.png');

  await sharp(inputBuffer)
    .resize(512, 512)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'icon-512.png'));
  console.log('Created icon-512.png');

  // 7. Generate true multi-resolution favicon.ico containing 16x16, 32x32, 48x48
  try {
    const icoBuffer = await pngToIco([
      path.join(publicDir, 'favicon-16x16.png'),
      path.join(publicDir, 'favicon-32x32.png'),
      path.join(publicDir, 'favicon-48x48.png'),
    ]);
    fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
    console.log('Created multi-size favicon.ico successfully!');
  } catch (err) {
    console.error('Error generating favicon.ico:', err);
  }
}

generate();
