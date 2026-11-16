/**
 * Downloads the Poly Haven textures used by the 3D viewer (VIS04) into
 * public/textures/<slug>/{diffuse,normal,rough}.jpg.
 *
 * Usage (from the frontend folder): node scripts/download-polyhaven-textures.mjs
 *
 * Textures are CC0 (https://polyhaven.com/license). The file URLs come from the public
 * Poly Haven API (https://api.polyhaven.com), used here only to download the files once.
 * 1k JPGs keep the download and GPU memory small (VIS04: no significant performance loss).
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEXTURES = [
  'blue_metal_plate', // counter
  'rubber_tiles', // conveyor belt
  'wood_table_001', // receiving platform
  'metal_plate', // crust dispenser
  'polystyrene', // robotic arms
  'red_brick', // wood-fired oven
  'rock_wall_08', // stone oven (kitchen equipment)
  'tiled_floor_001', // kitchen floor
];

const RESOLUTION = '1k';
const FORMAT = 'jpg';

/** Local file name -> Poly Haven map names to try, in order. */
const MAPS = {
  diffuse: ['Diffuse', 'diff', 'diffuse'],
  normal: ['nor_gl', 'Normal_GL', 'normal_gl'],
  rough: ['Rough', 'rough', 'Roughness'],
};

const HEADERS = {
  'User-Agent': 'LaPrizza-course-project/1.0 (texture download script)',
};

const root = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'textures'
);

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function getJson(url) {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok)
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.json();
}

function findFileUrl(files, candidates) {
  for (const name of candidates) {
    const url = files?.[name]?.[RESOLUTION]?.[FORMAT]?.url;
    if (url) return url;
  }
  return null;
}

async function downloadTexture(slug) {
  const files = await getJson(`https://api.polyhaven.com/files/${slug}`);
  const folder = join(root, slug);
  await mkdir(folder, { recursive: true });

  for (const [localName, candidates] of Object.entries(MAPS)) {
    const target = join(folder, `${localName}.${FORMAT}`);
    if (await exists(target)) {
      console.log(`  = ${slug}/${localName}.${FORMAT} (already there)`);
      continue;
    }
    const url = findFileUrl(files, candidates);
    if (!url) {
      console.error(
        `  ! ${slug}: no ${RESOLUTION} ${FORMAT} for ${localName}. Maps available: ${Object.keys(files).join(', ')}`
      );
      process.exitCode = 1;
      continue;
    }
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) throw new Error(`${response.status} downloading ${url}`);
    await writeFile(target, Buffer.from(await response.arrayBuffer()));
    console.log(`  + ${slug}/${localName}.${FORMAT}`);
  }
}

console.log(
  `Downloading ${TEXTURES.length} Poly Haven textures (${RESOLUTION} ${FORMAT}) into ${root}`
);
for (const slug of TEXTURES) {
  console.log(slug);
  try {
    await downloadTexture(slug);
  } catch (error) {
    console.error(`  ! ${slug}: ${error.message}`);
    process.exitCode = 1;
  }
}
