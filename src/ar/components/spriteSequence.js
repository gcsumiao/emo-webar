const AFRAME = window.AFRAME;

function ensureRegistry() {
  if (!window.__spriteRegistry) {
    window.__spriteRegistry = {
      configs: new Map(),
      textureCache: new Map(),
    };
  }
  return window.__spriteRegistry;
}

function getThree() {
  return window.THREE || (AFRAME && AFRAME.THREE);
}

function loadTexture(url) {
  const registry = ensureRegistry();
  if (registry.textureCache.has(url)) return registry.textureCache.get(url);
  const THREE = getThree();
  if (!THREE) return null;
  const loader = new THREE.TextureLoader();
  loader.crossOrigin = 'anonymous';
  const tex = loader.load(url);
  if ('SRGBColorSpace' in THREE) tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  registry.textureCache.set(url, tex);
  return tex;
}

if (AFRAME && !AFRAME.components['sprite-sequence']) {
  AFRAME.registerComponent('sprite-sequence', {
    schema: {
      configKey: { type: 'string', default: '' },
      autoplay: { type: 'boolean', default: false },
    },
    init() {
      const registry = ensureRegistry();
      const config = registry.configs.get(this.data.configKey) || {};
      this.frames = Array.isArray(config.frameSequenceUrls) ? config.frameSequenceUrls.slice() : [];
      this.fps = config.frameRate || 30;
      this.frameDurMs = 1000 / this.fps;
      this.finalIdleUrl = config.finalIdleFrameUrl || (this.frames.length ? this.frames[this.frames.length - 1] : null);
      this.frameIdx = 0;
      this.elapsed = 0;
      this.playing = false;
      this.completed = false;

      this.textures = this.frames.map(loadTexture).filter(Boolean);
      if (this.finalIdleUrl) loadTexture(this.finalIdleUrl);

      this._applyWhenReady = () => {
        this.applyFrame(0);
        if (this.data.autoplay) this.play();
      };
      const mesh = this.el.getObject3D('mesh');
      if (mesh && mesh.material) this._applyWhenReady();
      else this.el.addEventListener('object3dset', this._applyWhenReady, { once: true });
    },
    applyFrame(idx) {
      const mesh = this.el.getObject3D('mesh');
      if (!mesh || !mesh.material) return;
      const tex = this.textures[idx];
      if (!tex) return;
      mesh.material.map = tex;
      mesh.material.transparent = true;
      mesh.material.depthWrite = false;
      if (mesh.material.color) mesh.material.color.set('#ffffff');
      mesh.material.needsUpdate = true;
      this.frameIdx = idx;
    },
    play() {
      if (!this.frames.length) return;
      this.playing = true;
      this.completed = false;
      this.elapsed = 0;
      this.frameIdx = 0;
      this.applyFrame(0);
      this.el.emit('sprite-sequence-started');
    },
    stop() {
      this.playing = false;
    },
    seek(idx) {
      const clamped = Math.max(0, Math.min(this.frames.length - 1, Math.round(idx)));
      this.applyFrame(clamped);
    },
    setFinalIdle(url) {
      const target = url || this.finalIdleUrl;
      if (!target) return;
      const tex = loadTexture(target);
      if (!tex) return;
      const mesh = this.el.getObject3D('mesh');
      if (!mesh || !mesh.material) return;
      mesh.material.map = tex;
      mesh.material.transparent = true;
      mesh.material.depthWrite = false;
      if (mesh.material.color) mesh.material.color.set('#ffffff');
      mesh.material.needsUpdate = true;
    },
    tick(_, dtMs) {
      if (!this.playing || this.completed) return;
      this.elapsed += dtMs;
      const idx = Math.floor(this.elapsed / this.frameDurMs);
      if (idx >= this.frames.length) {
        this.applyFrame(this.frames.length - 1);
        this.playing = false;
        this.completed = true;
        this.el.emit('sprite-sequence-end');
        return;
      }
      this.applyFrame(idx);
    },
  });
}
