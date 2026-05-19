import fs from 'node:fs/promises';
import path from 'node:path';
import { createImageDescriptor } from '../server/recognitionDescriptor.js';

const repoRoot = process.cwd();
const configPath = path.join(repoRoot, 'recognition', 'target-sources.json');
const catalogPath = path.join(repoRoot, 'public', 'assets', 'ar', 'mindar-scenes.json');
const manifestPath = path.join(repoRoot, 'public', 'assets', 'ar', 'manifest.json');
const outputPath = path.join(repoRoot, 'public', 'assets', 'ar', 'recognition-index.json');
const checkMode = process.argv.includes('--check');
const imageExtRe = /\.(png|jpe?g|webp)$/i;

function localeSort(left, right) {
  return left.localeCompare(right, 'zh-Hans-CN', {
    numeric: true,
    sensitivity: 'base',
  });
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function stripExt(filename) {
  return filename.replace(/\.[^.]+$/, '');
}

function matchesPrefix(filename, prefix) {
  if (!prefix) return imageExtRe.test(filename);
  const stem = stripExt(filename);
  return stem === prefix || stem.startsWith(`${prefix} `) || stem.startsWith(`${prefix}-`);
}

async function pathExists(filepath) {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filepath) {
  return JSON.parse(await fs.readFile(filepath, 'utf8'));
}

async function resolveSourceRoot(config) {
  if (process.env.AR_RECOGNITION_SOURCE_ROOT) {
    const envRoot = path.resolve(repoRoot, process.env.AR_RECOGNITION_SOURCE_ROOT);
    if (await pathExists(envRoot)) return envRoot;
  }

  for (const candidate of config.sourceRootCandidates || []) {
    const resolved = path.resolve(repoRoot, candidate);
    if (await pathExists(resolved)) return resolved;
  }

  throw new Error('Could not find recognition source root. Set AR_RECOGNITION_SOURCE_ROOT.');
}

async function listMatchingFiles(sourceRoot, group) {
  if (Array.isArray(group.files)) {
    return group.files.map((file) => toPosix(file));
  }

  const folder = group.folder;
  if (!folder) return [];

  const folderPath = path.join(sourceRoot, folder);
  const names = (await fs.readdir(folderPath))
    .filter((name) => imageExtRe.test(name));
  const prefixes = Array.isArray(group.prefixes) && group.prefixes.length ? group.prefixes : [''];
  const files = [];

  prefixes.forEach((prefix) => {
    names
      .filter((name) => matchesPrefix(name, prefix))
      .sort(localeSort)
      .forEach((name) => files.push(toPosix(path.posix.join(toPosix(folder), name))));
  });

  return files;
}

async function expandSceneFiles(sourceRoot, sceneConfig) {
  const groups = Array.isArray(sceneConfig.groups) && sceneConfig.groups.length
    ? sceneConfig.groups
    : [sceneConfig];
  const files = [];
  for (const group of groups) {
    files.push(...await listMatchingFiles(sourceRoot, group));
  }
  return files;
}

function targetMetadataFor(scene, manifest, targetIndex, sourcePath) {
  const manifestTargets = Array.isArray(manifest.targets) ? manifest.targets : [];
  const manifestTarget = scene.sceneId === manifest.defaultSceneId
    ? manifestTargets.find((target) => Number(target.targetIndex) === targetIndex)
    : null;
  const label = manifestTarget?.label || stripExt(path.posix.basename(sourcePath));
  return {
    targetId: manifestTarget?.targetId || `${scene.sceneId}-${targetIndex}`,
    label,
  };
}

async function main() {
  const [config, catalog, manifest] = await Promise.all([
    readJson(configPath),
    readJson(catalogPath),
    readJson(manifestPath),
  ]);
  const sourceRoot = await resolveSourceRoot(config);
  const sourceBaseUrl = process.env.AR_RECOGNITION_SOURCE_BASE_URL || 'source://';
  const scenesById = new Map((catalog.scenes || []).map((scene) => [scene.sceneId, scene]));
  const warnings = [];
  const targets = [];

  for (const sceneConfig of config.scenes || []) {
    const scene = scenesById.get(sceneConfig.sceneId);
    if (!scene) {
      warnings.push(`Unknown scene in recognition mapping: ${sceneConfig.sceneId}`);
      continue;
    }

    const files = await expandSceneFiles(sourceRoot, sceneConfig);
    if (Number(scene.targetCount) !== files.length) {
      warnings.push(`${scene.sceneId}: source count ${files.length} does not match catalog targetCount ${scene.targetCount}`);
    }

    for (const [targetIndex, sourcePath] of files.entries()) {
      const absolutePath = path.join(sourceRoot, sourcePath);
      if (!await pathExists(absolutePath)) {
        warnings.push(`${scene.sceneId}: missing source image ${sourcePath}`);
        continue;
      }
      const descriptor = await createImageDescriptor(absolutePath);
      const metadata = targetMetadataFor(scene, manifest, targetIndex, sourcePath);
      targets.push({
        sceneId: scene.sceneId,
        targetIndex,
        targetId: metadata.targetId,
        label: metadata.label,
        sourceImageUrl: sourceBaseUrl === 'source://'
          ? `source://${sourcePath}`
          : new URL(sourcePath.split('/').map(encodeURIComponent).join('/'), sourceBaseUrl).toString(),
        sourcePath,
        mindFileUrl: scene.mindTargetUrl || scene.mindFileUrl,
        descriptor,
      });
    }
  }

  const index = {
    schemaVersion: 1,
    algorithm: 'emo-recognition-v1',
    generatedAt: new Date().toISOString(),
    sourceRootHint: toPosix(path.relative(repoRoot, sourceRoot)) || '.',
    catalogUrl: '/assets/ar/mindar-scenes.json',
    targetCount: targets.length,
    warnings,
    targets,
  };

  if (checkMode) {
    const current = await fs.readFile(outputPath, 'utf8').catch(() => '');
    try {
      const currentIndex = JSON.parse(current);
      if (currentIndex.generatedAt) index.generatedAt = currentIndex.generatedAt;
    } catch {}
    const serialized = `${JSON.stringify(index, null, 2)}\n`;
    if (current !== serialized) {
      console.error('Recognition index is out of date. Run npm run recognition:index.');
      if (warnings.length) console.error(warnings.join('\n'));
      process.exitCode = 1;
      return;
    }
    if (warnings.length) {
      console.warn(warnings.join('\n'));
    }
    console.log(`Recognition index is up to date (${targets.length} targets).`);
    return;
  }

  const serialized = `${JSON.stringify(index, null, 2)}\n`;
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, serialized);
  warnings.forEach((warning) => console.warn(warning));
  console.log(`Wrote ${path.relative(repoRoot, outputPath)} with ${targets.length} targets.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
