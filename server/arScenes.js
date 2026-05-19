import fs from 'node:fs/promises';
import path from 'node:path';
import { withDb } from './db.js';

const DEFAULT_TENANT = 'emo';
const DEFAULT_LOCATION = 'store-a';
const DEFAULT_RECOGNITION_MODE = 'client-scene-rotation';
const STATIC_CATALOG_PATH = path.join(process.cwd(), 'public', 'assets', 'ar', 'mindar-scenes.json');
const STATIC_MANIFEST_PATH = path.join(process.cwd(), 'public', 'assets', 'ar', 'manifest.json');

function asSlug(value, fallback) {
  const next = String(value || '').trim();
  return next || fallback;
}

function asNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function jsonObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function readDefaultTarget(manifest) {
  return jsonObject(manifest?.defaultTarget);
}

function sceneMindUrl(scene) {
  return scene?.mindFileUrl || scene?.mindTargetUrl || scene?.mindTargetSrc || scene?.url || '';
}

function normalizeStaticScene(scene, index, defaultTarget, manifestTargets = []) {
  const sceneId = String(scene?.sceneId || scene?.id || `scene-${index}`);
  const targetCount = Math.max(0, asNumber(scene?.targetCount, 0));
  const sourceTargets = Array.isArray(scene?.targets) && scene.targets.length
    ? scene.targets
    : sceneId === 'targets' && manifestTargets.length
      ? manifestTargets
      : Array.from({ length: targetCount }, (_, targetIndex) => ({ targetIndex }));

  return {
    sceneId,
    label: String(scene?.label || sceneId),
    mindFileUrl: sceneMindUrl(scene),
    mindTargetUrl: sceneMindUrl(scene),
    targetCount,
    priority: asNumber(scene?.priority, index),
    targets: sourceTargets.map((target, targetIndex) => {
      const resolvedIndex = Number.isFinite(Number(target?.targetIndex))
        ? Number(target.targetIndex)
        : targetIndex;
      return {
        targetIndex: resolvedIndex,
        targetId: String(target?.targetId || `${sceneId}-${resolvedIndex}`),
        label: String(target?.label || `${sceneId} target ${resolvedIndex}`),
        renderMode: target?.renderMode || defaultTarget.renderMode || 'gltf-only',
        glb: jsonObject(target?.glb),
        sprite: jsonObject(target?.sprite),
        action: jsonObject(target?.action?.type ? target.action : { type: 'none' }),
      };
    }),
  };
}

export async function readStaticScenePayload({
  tenant = DEFAULT_TENANT,
  location = DEFAULT_LOCATION,
  source = 'static-fallback',
} = {}) {
  const [catalogText, manifestText] = await Promise.all([
    fs.readFile(STATIC_CATALOG_PATH, 'utf8'),
    fs.readFile(STATIC_MANIFEST_PATH, 'utf8'),
  ]);
  const catalog = JSON.parse(catalogText);
  const manifest = JSON.parse(manifestText);
  const defaultTarget = readDefaultTarget(manifest);
  const manifestTargets = Array.isArray(manifest.targets) ? manifest.targets : [];
  const scenes = (Array.isArray(catalog.scenes) ? catalog.scenes : [])
    .map((scene, index) => normalizeStaticScene(scene, index, defaultTarget, manifestTargets));

  return {
    schemaVersion: Number(catalog.schemaVersion) || 1,
    tenant,
    location,
    recognitionMode: DEFAULT_RECOGNITION_MODE,
    source,
    defaultSceneId: catalog.defaultSceneId || manifest.defaultSceneId || scenes[0]?.sceneId || 'targets',
    scenes,
  };
}

function normalizeDbTarget(row) {
  return {
    targetIndex: Number(row.target_index),
    targetId: String(row.target_id),
    label: String(row.label),
    renderMode: row.render_mode || 'gltf-only',
    glb: jsonObject(row.glb),
    sprite: jsonObject(row.sprite),
    action: jsonObject(row.action?.type ? row.action : { type: 'none' }),
  };
}

function normalizeDbScene(row, targets) {
  const sceneId = String(row.slug);
  return {
    sceneId,
    label: String(row.label || sceneId),
    mindFileUrl: row.mind_file_url,
    mindTargetUrl: row.mind_file_url,
    targetCount: Number(row.target_count) || targets.length,
    priority: Number(row.priority) || 0,
    targets,
  };
}

export async function getScenesFromDb({
  tenant = DEFAULT_TENANT,
  location = DEFAULT_LOCATION,
  limit = 0,
} = {}) {
  return withDb(async (client) => {
    const sceneResult = await client.query(
      `
        select
          s.id,
          s.slug,
          s.label,
          s.mind_file_url,
          s.target_count,
          ls.priority
        from tenants t
        join locations l on l.tenant_id = t.id
        join location_scenes ls on ls.location_id = l.id
        join scenes s on s.id = ls.scene_id
        where t.slug = $1
          and l.slug = $2
          and t.active = true
          and l.active = true
          and s.active = true
          and ls.active = true
        order by ls.priority asc, s.slug asc
        ${limit > 0 ? 'limit $3' : ''}
      `,
      limit > 0 ? [tenant, location, limit] : [tenant, location]
    );

    if (!sceneResult.rows.length) return null;

    const sceneIds = sceneResult.rows.map((row) => row.id);
    const targetResult = await client.query(
      `
        select scene_id, target_index, target_id, label, render_mode, glb, sprite, action
        from scene_targets
        where scene_id = any($1::bigint[])
          and active = true
        order by scene_id asc, target_index asc
      `,
      [sceneIds]
    );

    const targetsBySceneId = new Map();
    targetResult.rows.forEach((row) => {
      const key = Number(row.scene_id);
      if (!targetsBySceneId.has(key)) targetsBySceneId.set(key, []);
      targetsBySceneId.get(key).push(normalizeDbTarget(row));
    });

    const scenes = sceneResult.rows.map((row) => (
      normalizeDbScene(row, targetsBySceneId.get(Number(row.id)) || [])
    ));

    return {
      schemaVersion: 1,
      tenant,
      location,
      recognitionMode: DEFAULT_RECOGNITION_MODE,
      source: 'postgres',
      defaultSceneId: scenes[0]?.sceneId || 'targets',
      scenes,
    };
  });
}

export async function getScenesPayload({
  tenant,
  location,
  limit = Number(process.env.AR_SCENE_MAX_RESULTS || 0),
} = {}) {
  const resolvedTenant = asSlug(tenant, process.env.AR_DEFAULT_TENANT || DEFAULT_TENANT);
  const resolvedLocation = asSlug(location, process.env.AR_DEFAULT_LOCATION || DEFAULT_LOCATION);

  try {
    const dbPayload = await getScenesFromDb({
      tenant: resolvedTenant,
      location: resolvedLocation,
      limit: Math.max(0, Number(limit) || 0),
    });
    if (dbPayload?.scenes?.length) return dbPayload;
  } catch (error) {
    console.warn('[AR scenes] Falling back to static catalog:', error);
  }

  return readStaticScenePayload({
    tenant: resolvedTenant,
    location: resolvedLocation,
    source: 'static-fallback',
  });
}

export async function recordRecognitionEvent({
  tenant = DEFAULT_TENANT,
  location = DEFAULT_LOCATION,
  sceneId,
  targetIndex,
  confidence = null,
  source = 'mindar',
  userAgent = '',
} = {}) {
  return withDb(async (client) => {
    const lookup = await client.query(
      `
        select
          t.id as tenant_id,
          l.id as location_id,
          s.id as scene_id
        from tenants t
        left join locations l on l.tenant_id = t.id and l.slug = $2
        left join scenes s on s.tenant_id = t.id and s.slug = $3
        where t.slug = $1
        limit 1
      `,
      [tenant, location, sceneId || '']
    );

    const ids = lookup.rows[0] || {};
    const result = await client.query(
      `
        insert into recognition_events (
          tenant_id,
          location_id,
          scene_id,
          target_index,
          confidence,
          source,
          user_agent
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        returning id, created_at
      `,
      [
        ids.tenant_id || null,
        ids.location_id || null,
        ids.scene_id || null,
        Number.isFinite(Number(targetIndex)) ? Number(targetIndex) : null,
        Number.isFinite(Number(confidence)) ? Number(confidence) : null,
        String(source || 'mindar').slice(0, 80),
        String(userAgent || '').slice(0, 500),
      ]
    );

    return result.rows[0];
  });
}
