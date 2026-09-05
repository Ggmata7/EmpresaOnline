// Reproducible image/video compression. Never crops or alters the supplied artwork.
// SHARP_MODULE may point to a bundled sharp installation; FFMPEG_PATH to its binary.
// node scripts/media/optimize-brand.cjs <source.jpg> <source.mp4>
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const sharp = require(process.env.SHARP_MODULE || 'sharp');

async function main() {
  const [image, video] = process.argv.slice(2);
  if (!image || !video) throw new Error('Supply an image and a video source.');
  const output = path.resolve(__dirname, '../../public/brand');
  fs.mkdirSync(output, { recursive: true });
  await sharp(image).rotate().resize({ width: 1280, withoutEnlargement: true })
    .webp({ quality: 84, effort: 6 }).toFile(path.join(output, 'catch-hero.webp'));
  await sharp(image).rotate().resize({ width: 640, withoutEnlargement: true })
    .webp({ quality: 78, effort: 6 }).toFile(path.join(output, 'catch-poster.webp'));
  const common = ['-hide_banner', '-loglevel', 'warning', '-y', '-i', video, '-an', '-map_metadata', '-1', '-vf', 'scale=960:-2', '-r', '24'];
  const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
  execFileSync(ffmpeg, [...common, '-c:v', 'libvpx-vp9', '-crf', '35', '-b:v', '0', '-deadline', 'good', '-cpu-used', '2', '-row-mt', '1', path.join(output, 'catch-hero.webm')], { stdio: 'inherit' });
  execFileSync(ffmpeg, [...common, '-c:v', 'libx264', '-crf', '27', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(output, 'catch-hero.mp4')], { stdio: 'inherit' });
  for (const name of fs.readdirSync(output)) console.log(`${name}: ${fs.statSync(path.join(output, name)).size} bytes`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
