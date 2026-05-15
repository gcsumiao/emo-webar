import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const mindarDir = path.join(repoRoot, 'public', 'assets', 'mindar');
const catalogPath = path.join(repoRoot, 'public', 'assets', 'ar', 'mindar-scenes.json');
const checkOnly = process.argv.includes('--check');

function readMindTargetCount(filePath) {
  const buffer = fs.readFileSync(filePath);
  const keyOffset = buffer.indexOf(Buffer.from('dataList'));
  if (keyOffset < 0) {
    throw new Error(`Could not find MindAR dataList in ${path.basename(filePath)}`);
  }

  const markerOffset = keyOffset + 'dataList'.length;
  const marker = buffer[markerOffset];
  if (marker >= 0x90 && marker <= 0x9f) return marker - 0x90;
  if (marker === 0xdc) return buffer.readUInt16BE(markerOffset + 1);
  if (marker === 0xdd) return buffer.readUInt32BE(markerOffset + 1);
  throw new Error(`Unsupported MindAR dataList marker 0x${marker.toString(16)} in ${path.basename(filePath)}`);
}

function sceneIdFromFilename(filename) {
  if (filename === 'targets.mind') return 'targets';
  const stem = filename.replace(/\.mind$/i, '');
  const withoutSuffix = stem.replace(/targets$/i, '');
  return withoutSuffix || stem;
}

function labelForScene(sceneId) {
  return sceneId === 'targets' ? 'Default EMO targets' : sceneId;
}

function sortMindFiles(files) {
  return files.sort((a, b) => {
    if (a === 'targets.mind') return -1;
    if (b === 'targets.mind') return 1;
    return a.localeCompare(b, 'zh-Hans-CN');
  });
}

function buildCatalog() {
  const files = sortMindFiles(fs.readdirSync(mindarDir).filter((file) => file.endsWith('.mind')));
  return {
    schemaVersion: 1,
    defaultSceneId: 'targets',
    scenes: files.map((filename) => {
      const sceneId = sceneIdFromFilename(filename);
      return {
        sceneId,
        label: labelForScene(sceneId),
        mindTargetUrl: `/assets/mindar/${filename}`,
        targetCount: readMindTargetCount(path.join(mindarDir, filename)),
      };
    }),
  };
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

const nextCatalogText = stableJson(buildCatalog());

if (checkOnly) {
  const currentCatalogText = fs.existsSync(catalogPath) ? fs.readFileSync(catalogPath, 'utf8') : '';
  if (currentCatalogText !== nextCatalogText) {
    console.error('MindAR scene catalog is out of date. Run npm run mindar:catalog.');
    process.exit(1);
  }
  console.log('MindAR scene catalog is up to date.');
} else {
  fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
  fs.writeFileSync(catalogPath, nextCatalogText);
  console.log(`Wrote ${path.relative(repoRoot, catalogPath)}`);
}
