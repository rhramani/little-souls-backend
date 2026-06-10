const sharp = require('sharp');

async function main() {
  const url = 'https://pub-ed33023176d04767a8dc019c44657d76.r2.dev/uploads/c03183af-d862-4de9-aeeb-fbc589c31e48_ChatGPT_Image_Jun_9_2026_11_11_09_AM.png';
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const metadata = await sharp(buffer).metadata();
  console.log('Image dimensions:', metadata.width, 'x', metadata.height, 'aspect:', metadata.width / metadata.height);
}

main().catch(console.error);
