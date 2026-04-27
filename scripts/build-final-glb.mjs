import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRMaterialsUnlit } from '@gltf-transform/extensions';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SRC = path.resolve(
  ROOT,
  '2.AR角色素材/2.一毛动画工程文件/emo3D动画黑色背景（png帧序列+MP4）/png/1_0261.png',
);
const OUT = path.resolve(ROOT, 'public/assets/step06/models/yimao-final.glb');
const TEXTURE_SIZE = 1024;

async function main() {
  await fs.access(SRC);
  await fs.mkdir(path.dirname(OUT), { recursive: true });

  const pngBuffer = await sharp(SRC)
    .resize(TEXTURE_SIZE, TEXTURE_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const doc = new Document();
  const buffer = doc.createBuffer();

  const positions = new Float32Array([
    -0.5, -0.5, 0,
     0.5, -0.5, 0,
     0.5,  0.5, 0,
    -0.5,  0.5, 0,
  ]);
  const normals = new Float32Array([
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
  ]);
  // glTF: TEXCOORD_0 origin is top-left, V increases downward.
  // World +Y = top of quad → UV V=0; world -Y = bottom → UV V=1.
  const uvs = new Float32Array([
    0, 1,
    1, 1,
    1, 0,
    0, 0,
  ]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

  const positionAccessor = doc.createAccessor('position')
    .setType('VEC3')
    .setArray(positions)
    .setBuffer(buffer);
  const normalAccessor = doc.createAccessor('normal')
    .setType('VEC3')
    .setArray(normals)
    .setBuffer(buffer);
  const uvAccessor = doc.createAccessor('uv')
    .setType('VEC2')
    .setArray(uvs)
    .setBuffer(buffer);
  const indexAccessor = doc.createAccessor('indices')
    .setType('SCALAR')
    .setArray(indices)
    .setBuffer(buffer);

  const texture = doc.createTexture('yimao-final-tex')
    .setImage(pngBuffer)
    .setMimeType('image/png');

  const unlitExt = doc.createExtension(KHRMaterialsUnlit);
  const unlit = unlitExt.createUnlit();

  const material = doc.createMaterial('yimao-final-mat')
    .setBaseColorTexture(texture)
    .setBaseColorFactor([1, 1, 1, 1])
    .setAlphaMode('BLEND')
    .setDoubleSided(true)
    .setExtension('KHR_materials_unlit', unlit);

  const primitive = doc.createPrimitive()
    .setMode(4) // TRIANGLES
    .setAttribute('POSITION', positionAccessor)
    .setAttribute('NORMAL', normalAccessor)
    .setAttribute('TEXCOORD_0', uvAccessor)
    .setIndices(indexAccessor)
    .setMaterial(material);

  const mesh = doc.createMesh('yimao-final').addPrimitive(primitive);
  const node = doc.createNode('yimao-final').setMesh(mesh);
  const scene = doc.createScene('Scene').addChild(node);
  doc.getRoot().setDefaultScene(scene);

  const io = new NodeIO().registerExtensions([KHRMaterialsUnlit]);
  await io.write(OUT, doc);

  const stat = await fs.stat(OUT);
  const mb = (stat.size / (1024 * 1024)).toFixed(2);
  console.log(`✓ wrote ${path.relative(ROOT, OUT)} (${mb} MB, texture ${TEXTURE_SIZE}×${TEXTURE_SIZE})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
