const AFRAME = window.AFRAME;

function getThree() {
  return window.THREE || window.AFRAME?.THREE;
}

function ensureRegistry() {
  if (!window.__gltfRegistry) {
    window.__gltfRegistry = {
      configs: new Map(),
    };
  }
  return window.__gltfRegistry;
}

function toArray(value) {
  return Array.isArray(value) ? value : [value];
}

function numberOr(value, fallback) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

if (AFRAME && !AFRAME.components['gltf-transition-model']) {
  AFRAME.registerComponent('gltf-transition-model', {
    schema: {
      configKey: { type: 'string', default: '' },
      autoplay: { type: 'boolean', default: false },
    },
    init() {
      this.config = {};
      this.model = null;
      this.mixer = null;
      this.actions = new Map();
      this.clips = [];
      this.materialState = new Map();
      this.fadeToken = 0;
      this.ready = false;
      this._onModelLoaded = (event) => this._handleModelLoaded(event);
      this.el.addEventListener('model-loaded', this._onModelLoaded);
      this.reloadConfig(this.data.configKey);
      const existingModel = this.el.getObject3D('mesh');
      if (existingModel) this._setupModel(existingModel);
      this.el.object3D.visible = false;
    },
    remove() {
      this.stopAllAnimations();
      this.el.removeEventListener('model-loaded', this._onModelLoaded);
    },
    update(oldData) {
      if (oldData.configKey !== this.data.configKey) this.reloadConfig(this.data.configKey);
    },
    reloadConfig(configKey) {
      if (configKey) this.data.configKey = configKey;
      const registry = ensureRegistry();
      this.config = registry.configs.get(this.data.configKey) || {};
      if (this.ready && this.data.autoplay) this.playIntroThenIdle();
    },
    _handleModelLoaded(event) {
      this._setupModel(event.detail?.model || this.el.getObject3D('mesh'));
    },
    _setupModel(model) {
      const THREE = getThree();
      if (!THREE || !model) return;
      this.stopAllAnimations();
      this.model = model;
      this.clips = this._readClips(model);
      this.actions = new Map();
      this.materialState = new Map();
      this.mixer = new THREE.AnimationMixer(model);
      this.clips.forEach((clip) => {
        if (clip?.name) this.actions.set(clip.name, this.mixer.clipAction(clip));
      });
      this._captureMaterialState();
      this.ready = true;
      this.el.emit('gltf-transition-ready', { clips: this.getAnimationNames() });
      if (this.data.autoplay) this.show().then(() => this.playIntroThenIdle());
    },
    _readClips(model) {
      const component = this.el.components?.['gltf-model'];
      const candidates = [
        model.animations,
        component?.model?.animations,
        component?.animations,
      ];
      const clips = candidates.find((item) => Array.isArray(item) && item.length);
      return clips ? clips.slice() : [];
    },
    _captureMaterialState() {
      if (!this.model?.traverse) return;
      this.model.traverse((node) => {
        if (!node.isMesh || !node.material) return;
        toArray(node.material).forEach((material) => {
          if (!material || this.materialState.has(material)) return;
          this.materialState.set(material, {
            opacity: numberOr(material.opacity, 1),
            transparent: Boolean(material.transparent),
          });
        });
      });
    },
    _setMaterialAlpha(alpha) {
      this.materialState.forEach((state, material) => {
        material.transparent = true;
        material.opacity = state.opacity * alpha;
        material.needsUpdate = true;
      });
    },
    _restoreMaterials() {
      this.materialState.forEach((state, material) => {
        material.opacity = state.opacity;
        material.transparent = state.transparent;
        material.needsUpdate = true;
      });
    },
    _fade({ from, to, durationMs = 0, endVisible = true } = {}) {
      const token = ++this.fadeToken;
      if (!this.model) return Promise.resolve(false);
      this.el.object3D.visible = true;
      this.model.visible = true;
      if (!durationMs || durationMs <= 0 || from === to) {
        this._setMaterialAlpha(to);
        if (to >= 1) this._restoreMaterials();
        this.el.object3D.visible = endVisible;
        this.model.visible = endVisible;
        return Promise.resolve(true);
      }
      this._setMaterialAlpha(from);
      return new Promise((resolve) => {
        const start = performance.now();
        const tick = (now) => {
          if (token !== this.fadeToken) {
            resolve(false);
            return;
          }
          const t = Math.min(1, (now - start) / durationMs);
          const alpha = from + (to - from) * t;
          this._setMaterialAlpha(alpha);
          if (t >= 1) {
            if (to >= 1) this._restoreMaterials();
            this.el.object3D.visible = endVisible;
            this.model.visible = endVisible;
            resolve(true);
            return;
          }
          window.requestAnimationFrame(tick);
        };
        window.requestAnimationFrame(tick);
      });
    },
    show(options = {}) {
      const transition = this.config.transition || {};
      const durationMs = numberOr(options.crossfadeMs, numberOr(transition.crossfadeMs, 180));
      return this._fade({ from: 0, to: 1, durationMs, endVisible: true }).then((result) => {
        this.el.emit('gltf-transition-shown');
        return result;
      });
    },
    hide(options = {}) {
      const transition = this.config.transition || {};
      const durationMs = numberOr(options.crossfadeMs, numberOr(transition.crossfadeMs, 180));
      this.stopAllAnimations();
      return this._fade({ from: 1, to: 0, durationMs, endVisible: false }).then((result) => {
        this.el.emit('gltf-transition-hidden');
        return result;
      });
    },
    playClip(name, options = {}) {
      const THREE = getThree();
      if (!THREE || !name) return Promise.resolve(false);
      const action = this.actions.get(name);
      if (!action) {
        this.el.emit('gltf-animation-missing', { name });
        return Promise.resolve(false);
      }
      const loop = options.loop === true;
      const once = options.loop === false || options.once === true;
      const fadeMs = numberOr(options.crossFadeMs, numberOr(this.config.animation?.crossFadeMs, 180));
      const timeScale = numberOr(options.timeScale, numberOr(this.config.animation?.timeScale, 1));
      this.actions.forEach((other) => {
        if (other !== action) other.fadeOut?.(fadeMs / 1000);
      });
      action.enabled = true;
      action.timeScale = timeScale;
      action.reset();
      if (once) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = options.clampWhenFinished !== false;
      } else {
        action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
        action.clampWhenFinished = false;
      }
      action.fadeIn?.(fadeMs / 1000);
      action.play();
      if (!once) return Promise.resolve(true);
      return new Promise((resolve) => {
        const finish = (event) => {
          if (event.action !== action) return;
          this.mixer?.removeEventListener?.('finished', finish);
          this.el.emit('gltf-animation-finished', { name });
          resolve(true);
        };
        this.mixer?.addEventListener?.('finished', finish);
      });
    },
    async playIntroThenIdle() {
      const animation = this.config.animation || {};
      const introClip = animation.introClip;
      const idleClip = animation.idleClip;
      if (introClip && this.actions.has(introClip)) {
        await this.playClip(introClip, {
          once: true,
          clampWhenFinished: animation.clampIntroWhenFinished !== false,
          crossFadeMs: animation.crossFadeMs,
          timeScale: animation.timeScale,
        });
      } else if (introClip) {
        this.el.emit('gltf-animation-missing', { name: introClip });
      }
      return this.playIdle();
    },
    playIdle() {
      const animation = this.config.animation || {};
      const idleClip = animation.idleClip;
      if (!idleClip) return Promise.resolve(false);
      if (!this.actions.has(idleClip)) {
        this.el.emit('gltf-animation-missing', { name: idleClip });
        return Promise.resolve(false);
      }
      return this.playClip(idleClip, {
        loop: animation.loopIdle !== false,
        crossFadeMs: animation.crossFadeMs,
        timeScale: animation.timeScale,
      });
    },
    stopAllAnimations() {
      this.actions?.forEach((action) => {
        try { action.stop(); } catch {}
      });
      try { this.mixer?.stopAllAction?.(); } catch {}
    },
    getAnimationNames() {
      return Array.from(this.actions?.keys?.() || []);
    },
    isReady() {
      return Boolean(this.ready && this.model);
    },
    tick(_, dtMs) {
      if (!this.mixer) return;
      this.mixer.update((dtMs || 0) / 1000);
    },
  });
}
