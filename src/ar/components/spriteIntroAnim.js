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

function easeOutBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function smoothStep(t) {
  return t * t * (3 - 2 * t);
}

function setMaterialOpacity(el, opacity) {
  const mesh = el?.getObject3D('mesh');
  if (!mesh || !mesh.material) return;
  mesh.material.opacity = opacity;
  mesh.material.transparent = true;
  mesh.material.needsUpdate = true;
}

if (AFRAME && !AFRAME.components['sprite-intro-anim']) {
  AFRAME.registerComponent('sprite-intro-anim', {
    schema: {
      configKey: { type: 'string', default: '' },
    },
    init() {
      const registry = ensureRegistry();
      const config = registry?.configs?.get(this.data.configKey) || {};
      this.config = config;
      this.state = 'idle'; // idle | entering | final | hidden | lossDimmed
      this.elapsed = 0;
      this.idleClock = 0;
      this.completionResolvers = [];
      this.charEl = this.el.querySelector('.sprite-character');
      this.shadowEl = this.el.parentEl?.querySelector('.sprite-shadow') || null;
      this.el.object3D.visible = false;
      this._setOpacities(0);
    },
    reloadConfig(configKey) {
      if (configKey) {
        this.data.configKey = configKey;
        this.el.setAttribute('sprite-intro-anim', 'configKey', configKey);
      }
      const registry = ensureRegistry();
      this.config = registry.configs.get(this.data.configKey) || {};
      if (this.state !== 'entering') this.reset();
    },
    setConfig(config) {
      this.config = config || {};
      if (this.state !== 'entering') this.reset();
    },
    _setOpacities(charOpacity) {
      setMaterialOpacity(this.charEl, charOpacity);
      const shadowMax = this.config.shadowOpacity ?? 0.22;
      setMaterialOpacity(this.shadowEl, charOpacity * shadowMax);
    },
    _applyTransform(eased) {
      const fp = this.config.enterFromPosition || [0, 0, 0.03];
      const tp = this.config.enterToPosition || [0, 0, 0.14];
      const fs = this.config.enterFromScale || [0.001, 0.001, 0.001];
      const ts = this.config.enterToScale || [0.45, 0.45, 0.45];
      this.el.object3D.position.set(
        fp[0] + (tp[0] - fp[0]) * eased,
        fp[1] + (tp[1] - fp[1]) * eased,
        fp[2] + (tp[2] - fp[2]) * eased,
      );
      this.el.object3D.scale.set(
        fs[0] + (ts[0] - fs[0]) * eased,
        fs[1] + (ts[1] - fs[1]) * eased,
        fs[2] + (ts[2] - fs[2]) * eased,
      );
    },
    _resolveIntro() {
      const resolvers = this.completionResolvers;
      this.completionResolvers = [];
      resolvers.forEach((r) => {
        try { r(); } catch (e) { /* ignore */ }
      });
    },
    playIntro() {
      if (this.state === 'entering' || this.state === 'final') {
        return Promise.resolve();
      }
      this.state = 'entering';
      this.elapsed = 0;
      this.el.object3D.visible = true;
      this._applyTransform(0);
      this._setOpacities(0);
      const seq = this.charEl?.components?.['sprite-sequence'];
      if (seq) seq.play();
      return new Promise((resolve) => this.completionResolvers.push(resolve));
    },
    stopIntro() {
      const seq = this.charEl?.components?.['sprite-sequence'];
      if (seq) seq.stop();
      // Leave state as-is so caller can resume or hide
    },
    enterFinalIdle() {
      this.state = 'final';
      this.idleClock = 0;
      this.el.object3D.visible = true;
      this._applyTransform(1);
      this._setOpacities(1);
      const seq = this.charEl?.components?.['sprite-sequence'];
      if (seq) seq.setFinalIdle();
      this._resolveIntro();
    },
    hide() {
      this.state = 'hidden';
      this.el.object3D.visible = false;
      this._setOpacities(0);
      const seq = this.charEl?.components?.['sprite-sequence'];
      if (seq) seq.stop();
    },
    setLossDim(amount) {
      const clamped = Math.max(0, Math.min(1, amount));
      const target = 1 - 0.6 * clamped;
      this._setOpacities(target);
    },
    restoreFromLoss() {
      if (this.state === 'final') {
        this._setOpacities(1);
      }
    },
    reset() {
      this.state = 'idle';
      this.elapsed = 0;
      this.idleClock = 0;
      this.el.object3D.visible = false;
      this._setOpacities(0);
    },
    getState() {
      return this.state;
    },
    tick(_, dtMs) {
      if (this.state === 'entering') {
        this.elapsed += dtMs;
        const dur = this.config.enterDurationMs || 700;
        const t = Math.min(1, this.elapsed / dur);
        const eased = easeOutBack(t);
        this._applyTransform(eased);
        this._setOpacities(Math.min(1, t * 1.4));
        if (t >= 1) {
          this.state = 'final';
          this.idleClock = 0;
          this._resolveIntro();
        }
      } else if (this.state === 'final') {
        this.idleClock += dtMs;
        const idleDur = this.config.idleFloatDurationMs || 1800;
        const phase = (this.idleClock % (idleDur * 2)) / idleDur;
        const tri = phase < 1 ? phase : 2 - phase;
        const eased = smoothStep(tri);
        const baseZ = this.config.enterToPosition?.[2] ?? 0.14;
        const peakZ = this.config.idleFloatToZ ?? 0.17;
        this.el.object3D.position.z = baseZ + (peakZ - baseZ) * eased;
      }
    },
  });
}
