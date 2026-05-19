import fs from 'node:fs/promises';
import path from 'node:path';
import { closePool, withDb } from '../server/db.js';

const tenantSlug = process.env.AR_SEED_TENANT || process.env.AR_DEFAULT_TENANT || 'emo';
const tenantName = process.env.AR_SEED_TENANT_NAME || 'EMO';
const locationSlug = process.env.AR_SEED_LOCATION || process.env.AR_DEFAULT_LOCATION || 'store-a';
const locationName = process.env.AR_SEED_LOCATION_NAME || 'Store A';
const catalogPath = path.join(process.cwd(), 'public', 'assets', 'ar', 'mindar-scenes.json');
const manifestPath = path.join(process.cwd(), 'public', 'assets', 'ar', 'manifest.json');

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readTargetCount(scene) {
  const count = Number(scene?.targetCount);
  return Number.isInteger(count) && count > 0 ? count : 0;
}

function sceneMindUrl(scene) {
  return scene?.mindFileUrl || scene?.mindTargetUrl || scene?.mindTargetSrc || scene?.url || '';
}

function generateTargets(scene, manifestTargets) {
  const sceneId = String(scene.sceneId || scene.id);
  if (Array.isArray(scene.targets) && scene.targets.length) return scene.targets;
  if (sceneId === 'targets' && Array.isArray(manifestTargets) && manifestTargets.length) {
    return manifestTargets;
  }
  return Array.from({ length: readTargetCount(scene) }, (_, targetIndex) => ({ targetIndex }));
}

async function main() {
  const [catalogText, manifestText] = await Promise.all([
    fs.readFile(catalogPath, 'utf8'),
    fs.readFile(manifestPath, 'utf8'),
  ]);
  const catalog = JSON.parse(catalogText);
  const manifest = JSON.parse(manifestText);
  const defaultTarget = isPlainObject(manifest.defaultTarget) ? manifest.defaultTarget : {};
  const manifestTargets = Array.isArray(manifest.targets) ? manifest.targets : [];
  const scenes = Array.isArray(catalog.scenes) ? catalog.scenes : [];

  await withDb(async (client) => {
    await client.query('begin');
    try {
      const tenant = await client.query(
        `
          insert into tenants (slug, name)
          values ($1, $2)
          on conflict (slug) do update set name = excluded.name, active = true
          returning id
        `,
        [tenantSlug, tenantName]
      );
      const tenantId = tenant.rows[0].id;

      const location = await client.query(
        `
          insert into locations (tenant_id, slug, name)
          values ($1, $2, $3)
          on conflict (tenant_id, slug) do update set name = excluded.name, active = true
          returning id
        `,
        [tenantId, locationSlug, locationName]
      );
      const locationId = location.rows[0].id;

      for (const [priority, scene] of scenes.entries()) {
        const sceneId = String(scene.sceneId || scene.id || `scene-${priority}`);
        const label = String(scene.label || sceneId);
        const mindFileUrl = sceneMindUrl(scene);
        const targetCount = readTargetCount(scene);
        const sceneResult = await client.query(
          `
            insert into scenes (tenant_id, slug, label, mind_file_url, target_count)
            values ($1, $2, $3, $4, $5)
            on conflict (tenant_id, slug) do update set
              label = excluded.label,
              mind_file_url = excluded.mind_file_url,
              target_count = excluded.target_count,
              active = true,
              updated_at = now()
            returning id
          `,
          [tenantId, sceneId, label, mindFileUrl, targetCount]
        );
        const sceneDbId = sceneResult.rows[0].id;

        await client.query(
          `
            insert into location_scenes (location_id, scene_id, priority)
            values ($1, $2, $3)
            on conflict (location_id, scene_id) do update set
              priority = excluded.priority,
              active = true
          `,
          [locationId, sceneDbId, priority]
        );

        const targets = generateTargets(scene, manifestTargets);
        for (const [fallbackIndex, target] of targets.entries()) {
          const targetIndex = Number.isFinite(Number(target.targetIndex))
            ? Number(target.targetIndex)
            : fallbackIndex;
          const targetId = String(target.targetId || `${sceneId}-${targetIndex}`);
          const targetLabel = String(target.label || `${sceneId} target ${targetIndex}`);
          const renderMode = target.renderMode || defaultTarget.renderMode || 'gltf-only';
          const glb = isPlainObject(target.glb) ? target.glb : {};
          const sprite = isPlainObject(target.sprite) ? target.sprite : {};
          const action = isPlainObject(target.action) ? target.action : { type: 'none' };

          await client.query(
            `
              insert into scene_targets (
                scene_id,
                target_index,
                target_id,
                label,
                render_mode,
                glb,
                sprite,
                action
              )
              values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb)
              on conflict (scene_id, target_index) do update set
                target_id = excluded.target_id,
                label = excluded.label,
                render_mode = excluded.render_mode,
                glb = excluded.glb,
                sprite = excluded.sprite,
                action = excluded.action,
                active = true,
                updated_at = now()
            `,
            [
              sceneDbId,
              targetIndex,
              targetId,
              targetLabel,
              renderMode,
              JSON.stringify(glb),
              JSON.stringify(sprite),
              JSON.stringify(action),
            ]
          );
        }
      }

      await client.query('commit');
      console.log(`Seeded ${scenes.length} scenes for ${tenantSlug}/${locationSlug}.`);
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  }, { allowDefault: true });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
