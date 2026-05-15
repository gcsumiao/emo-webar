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

function configureTexture(tex) {
  const THREE = getThree();
  if (!THREE || !tex) return tex;
  if ('SRGBColorSpace' in THREE) tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function textureHasImage(tex) {
  const image = tex?.image;
  return Boolean(image && (image.complete || image.naturalWidth || image.width || image.videoWidth));
}

function loadTextureRecord(url) {
  const registry = ensureRegistry();
  if (registry.textureCache.has(url)) {
    const cached = registry.textureCache.get(url);
    if (cached?.texture) {
      if (!cached.loaded && textureHasImage(cached.texture)) cached.loaded = true;
      return cached;
    }
    const record = {
      url,
      texture: configureTexture(cached),
      loaded: textureHasImage(cached),
      error: false,
    };
    registry.textureCache.set(url, record);
    return record;
  }
  const THREE = getThree();
  if (!THREE) return null;
  const loader = new THREE.TextureLoader();
  loader.crossOrigin = 'anonymous';
  const record = {
    url,
    texture: null,
    loaded: false,
    error: false,
  };
  const tex = loader.load(
    url,
    () => {
      record.loaded = true;
      record.error = false;
    },
    undefined,
    () => {
      record.error = true;
    },
  );
  record.texture = configureTexture(tex);
  registry.textureCache.set(url, record);
  return record;
}

function loadTexture(url) {
  return loadTextureRecord(url)?.texture || null;
}

if (AFRAME && !AFRAME.components['sprite-sequence']) {
  AFRAME.registerComponent('sprite-sequence', {
    schema: {
      configKey: { type: 'string', default: '' },
      autoplay: { type: 'boolean', default: false },
    },
    init() {
      this.frameIdx = 0;
      this.elapsed = 0;
      this.playing = false;
      this.completed = false;
      this._loadConfig();

      this._applyWhenReady = () => {
        this.applyFrame(0);
        if (this.data.autoplay) this.play();
      };
      const mesh = this.el.getObject3D('mesh');
      if (mesh && mesh.material) this._applyWhenReady();
      else this.el.addEventListener('object3dset', this._applyWhenReady, { once: true });
    },
    _loadConfig(config = null) {
      const registry = ensureRegistry();
      const nextConfig = config || registry.configs.get(this.data.configKey) || {};
      this.frames = Array.isArray(nextConfig.frameSequenceUrls) ? nextConfig.frameSequenceUrls.slice() : [];
      this.fps = nextConfig.frameRate || 30;
      this.frameDurMs = 1000 / this.fps;
      this.finalIdleUrl = nextConfig.finalIdleFrameUrl || (this.frames.length ? this.frames[this.frames.length - 1] : null);
      this.textureRecords = this.frames.map(loadTextureRecord);
      this.textures = this.textureRecords.map((record) => record?.texture || null);
      if (this.finalIdleUrl) loadTexture(this.finalIdleUrl);
    },
    reloadConfig(configKey) {
      if (configKey) {
        this.data.configKey = configKey;
        this.el.setAttribute('sprite-sequence', 'configKey', configKey);
      }
      this.playing = false;
      this.completed = false;
      this.elapsed = 0;
      this.frameIdx = 0;
      this.textureRecords = [];
      this.textures = [];
      this._loadConfig();
      this.applyFrame(0);
    },
    setConfig(config) {
      this.playing = false;
      this.completed = false;
      this.elapsed = 0;
      this.frameIdx = 0;
      this.textureRecords = [];
      this.textures = [];
      this._loadConfig(config);
      this.applyFrame(0);
    },
    getTextureReadiness() {
      const frameCount = this.frames.length;
      let loadedCount = 0;
      let errorCount = 0;
      this.textureRecords.forEach((record) => {
        if (!record) return;
        if (!record.loaded && textureHasImage(record.texture)) record.loaded = true;
        if (record.loaded) loadedCount += 1;
        if (record.error) errorCount += 1;
      });
      return {
        frameCount,
        loadedCount,
        errorCount,
        pendingCount: Math.max(0, frameCount - loadedCount - errorCount),
        ready: frameCount > 0 && loadedCount === frameCount,
      };
    },
    areTexturesReady() {
      return this.getTextureReadiness().ready;
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
      if (this.elapsed < this.frameDurMs) return;
      this.elapsed -= this.frameDurMs;
      const nextIdx = this.frameIdx + 1;
      if (nextIdx >= this.frames.length) {
        this.playing = false;
        this.completed = true;
        this.el.emit('sprite-sequence-end');
        return;
      }
      this.applyFrame(nextIdx);
    },
  });
}
