import { arAudio } from '../../lib/arAudio.js';

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

function normalizeClipNames(names, fallbackNames) {
  if (Array.isArray(names) && names.length) return names.filter(Boolean).map(String);
  if (typeof names === 'string' && names) return [names];
  return fallbackNames;
}

function markerAudioName(marker) {
  return String(marker?.audio || marker?.sound || marker?.action || '').toLowerCase().replace(/[_\s]/g, '-');
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
      this.bounds = null;
      this.materialState = new Map();
      this.nodeState = new Map();
      this.hiddenNodeState = new Map();
      this.hiddenNodesRevealed = true;
      this.fadeToken = 0;
      this.ready = false;
      this.markerRun = null;
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
    resetLoadState() {
      this.stopAllAnimations();
      this.model = null;
      this.mixer = null;
      this.actions = new Map();
      this.clips = [];
      this.bounds = null;
      this.materialState = new Map();
      this.nodeState = new Map();
      this.hiddenNodeState = new Map();
      this.hiddenNodesRevealed = true;
      this.ready = false;
      this.markerRun = null;
      this.el.object3D.visible = false;
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
      this.bounds = this._readBounds(model);
      this.actions = new Map();
      this.materialState = new Map();
      this.nodeState = new Map();
      this.hiddenNodeState = new Map();
      this.hiddenNodesRevealed = true;
      this.mixer = new THREE.AnimationMixer(model);
      this.clips.forEach((clip) => {
        if (clip?.name) this.actions.set(clip.name, this.mixer.clipAction(clip));
      });
      this._configureOverlayRendering();
      this._captureMaterialState();
      this._syncHiddenNodesAtTime(this._getStartTimeSec());
      this.ready = true;
      this.applyAnimationFrame(this._getStartFrame());
      this.el.emit('gltf-transition-ready', { clips: this.getAnimationNames(), bounds: this.bounds });
      if (this.data.autoplay) this.show().then(() => this.playIntroThenIdle());
    },
    _readBounds(model) {
      const THREE = getThree();
      if (!THREE || !model) return null;
      const box = new THREE.Box3().setFromObject(model);
      if (box.isEmpty()) return null;
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      return {
        min: [box.min.x, box.min.y, box.min.z],
        max: [box.max.x, box.max.y, box.max.z],
        size: [size.x, size.y, size.z],
        center: [center.x, center.y, center.z],
      };
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
    _configureOverlayRendering() {
      if (!this.model?.traverse) return;
      this.model.traverse((node) => {
        if (!node.isMesh) return;
        this.nodeState.set(node, {
          frustumCulled: node.frustumCulled,
          renderOrder: node.renderOrder,
        });
        node.frustumCulled = false;
      });
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
            depthWrite: material.depthWrite,
            depthTest: material.depthTest,
            roughness: material.roughness,
            metalness: material.metalness,
            envMapIntensity: material.envMapIntensity,
          });
        });
      });
    },
    _getStartFrame() {
      const animation = this.config.animation || {};
      return Math.max(0, numberOr(animation.initialFrame, numberOr(animation.startFrame, 0)));
    },
    _getFps(options = {}) {
      const animation = this.config.animation || {};
      return Math.max(1, numberOr(options.fps, numberOr(animation.fps, 24)));
    },
    _getStartTimeSec(options = {}) {
      const animation = this.config.animation || {};
      const fps = this._getFps(options);
      const frame = Math.max(0, numberOr(options.startFrame, this._getStartFrame()));
      return Number.isFinite(Number(options.startTimeSec))
        ? Math.max(0, Number(options.startTimeSec))
        : frame / fps;
    },
    _getEndFrame(options = {}) {
      const animation = this.config.animation || {};
      const frame = Number(options.endFrame ?? animation.endFrame ?? animation.finalFrame ?? animation.stopFrame);
      return Number.isFinite(frame) ? Math.max(0, frame) : null;
    },
    _getEndTimeSec(options = {}) {
      const time = Number(options.endTimeSec ?? options.stopTimeSec);
      if (Number.isFinite(time)) return Math.max(0, time);
      const frame = this._getEndFrame(options);
      return frame == null ? null : frame / this._getFps(options);
    },
    _getPlaybackEndTimeSec(actions, options = {}) {
      const actionList = Array.isArray(actions) ? actions : [actions];
      const durations = actionList
        .map((action) => Number(action?.getClip?.().duration))
        .filter(Number.isFinite);
      const maxDuration = durations.length ? Math.max(...durations) : 0;
      const configuredEnd = this._getEndTimeSec(options);
      const fallbackEnd = maxDuration > 0 ? maxDuration : this._getStartTimeSec(options);
      const endTimeSec = configuredEnd == null
        ? fallbackEnd
        : maxDuration > 0
          ? Math.min(configuredEnd, maxDuration)
          : configuredEnd;
      return Math.max(this._getStartTimeSec(options), endTimeSec);
    },
    _clampActionsAtTime(actions, timeSec) {
      const actionList = Array.isArray(actions) ? actions : [actions];
      actionList.forEach((action) => {
        if (!action) return;
        const duration = Number(action.getClip?.().duration);
        action.enabled = true;
        action.paused = false;
        action.time = Math.min(Math.max(0, timeSec), Number.isFinite(duration) && duration > 0 ? duration : timeSec);
      });
      this.mixer?.update?.(0);
      this._syncHiddenNodesAtTime(timeSec);
      actionList.forEach((action) => {
        if (action) action.paused = true;
      });
      this.model?.updateMatrixWorld?.(true);
      this.bounds = this._readBounds(this.model);
    },
    _getHiddenNodeNames() {
      const animation = this.config.animation || {};
      const names = animation.hiddenNodesUntilFrame || animation.hiddenNodes || [];
      return Array.isArray(names) ? names.filter(Boolean).map(String) : [];
    },
    _getHiddenRevealTimeSec() {
      const animation = this.config.animation || {};
      const fps = this._getFps();
      const explicitTime = Number(animation.revealHiddenNodesTime ?? animation.revealHiddenNodesTimeSec);
      if (Number.isFinite(explicitTime)) return Math.max(0, explicitTime);
      const explicitFrame = Number(animation.revealHiddenNodesFrame ?? animation.hiddenUntilFrame);
      if (Number.isFinite(explicitFrame)) return Math.max(0, explicitFrame / fps);
      const branchMarker = Array.isArray(animation.markers)
        ? animation.markers.find((marker) => String(marker?.id || '').toLowerCase() === 'branch-pop' || markerAudioName(marker) === 'branch-pop')
        : null;
      const markerFrame = Number(branchMarker?.frame);
      return Number.isFinite(markerFrame) ? Math.max(0, markerFrame / fps) : 0;
    },
    _setConfiguredHiddenNodesVisible(visible) {
      const names = new Set(this._getHiddenNodeNames());
      if (!this.model?.traverse || !names.size) return false;
      this.model.traverse((node) => {
        if (!names.has(node.name)) return;
        if (!this.hiddenNodeState.has(node)) {
          this.hiddenNodeState.set(node, { visible: node.visible !== false });
        }
        const original = this.hiddenNodeState.get(node);
        node.visible = visible ? original.visible : false;
      });
      this.model.updateMatrixWorld?.(true);
      this.hiddenNodesRevealed = visible;
      return true;
    },
    _syncHiddenNodesAtTime(timeSec = 0) {
      const names = this._getHiddenNodeNames();
      if (!names.length) {
        this.hiddenNodesRevealed = true;
        return false;
      }
      const shouldShow = Number(timeSec) >= this._getHiddenRevealTimeSec();
      if (shouldShow === this.hiddenNodesRevealed) return false;
      return this._setConfiguredHiddenNodesVisible(shouldShow);
    },
    _setMaterialAlpha(alpha) {
      this.materialState.forEach((state, material) => {
        material.transparent = true;
        material.opacity = state.opacity * alpha;
        material.depthTest = state.depthTest;
        material.depthWrite = alpha >= 0.999 ? state.depthWrite : false;
        material.needsUpdate = true;
      });
    },
    _restoreMaterials() {
      this.materialState.forEach((state, material) => {
        material.opacity = state.opacity;
        material.transparent = state.transparent;
        material.depthWrite = state.depthWrite;
        material.depthTest = state.depthTest;
        if ('roughness' in material && state.roughness !== undefined) material.roughness = state.roughness;
        if ('metalness' in material && state.metalness !== undefined) material.metalness = state.metalness;
        if ('envMapIntensity' in material && state.envMapIntensity !== undefined) material.envMapIntensity = state.envMapIntensity;
        material.needsUpdate = true;
      });
      this.nodeState.forEach((state, node) => {
        node.renderOrder = state.renderOrder;
        node.frustumCulled = state.frustumCulled;
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
    _normalizeMarkers(markers) {
      if (!Array.isArray(markers) || !markers.length) return [];
      const fps = Math.max(1, numberOr(this.config.animation?.fps, 24));
      return markers
        .map((marker, index) => {
          const frame = Number(marker?.frame);
          const time = Number(marker?.time ?? marker?.timeSec);
          const timeSec = Number.isFinite(time)
            ? time
            : Number.isFinite(frame)
              ? frame / fps
              : null;
          if (!Number.isFinite(timeSec)) return null;
          return {
            ...marker,
            id: String(marker.id || marker.name || marker.audio || marker.sound || `marker-${index}`),
            frame: Number.isFinite(frame) ? frame : null,
            timeSec,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.timeSec - b.timeSec);
    },
    _startMarkers(markers, timeScale = 1, startTimeSec = 0, endTimeSec = null) {
      const normalized = this._normalizeMarkers(markers);
      const startSec = Math.max(0, numberOr(startTimeSec, 0));
      const endSec = Number(endTimeSec);
      this.markerRun = normalized.length
        ? {
          markers: normalized,
          fired: new Set(),
          elapsedSec: startSec,
          endTimeSec: Number.isFinite(endSec) ? Math.max(startSec, endSec) : null,
          timeScale: Math.abs(numberOr(timeScale, 1)) || 1,
        }
        : null;
      this._syncHiddenNodesAtTime(startSec);
      this._flushMarkers();
    },
    _stopMarkers() {
      this.markerRun = null;
    },
    _flushMarkers(elapsedOverride = null) {
      const run = this.markerRun;
      if (!run) return;
      const rawElapsedSec = Number.isFinite(elapsedOverride) ? elapsedOverride : run.elapsedSec;
      const elapsedSec = Number.isFinite(run.endTimeSec)
        ? Math.min(rawElapsedSec, run.endTimeSec)
        : rawElapsedSec;
      run.markers.forEach((marker) => {
        if (Number.isFinite(run.endTimeSec) && marker.timeSec > run.endTimeSec) return;
        if (run.fired.has(marker.id) || elapsedSec < marker.timeSec) return;
        run.fired.add(marker.id);
        this._triggerMarker(marker);
      });
    },
    _triggerMarker(marker) {
      const audioName = markerAudioName(marker);
      if (audioName === 'drop-bounce' || audioName === 'dropbounce' || audioName === 'drop') {
        arAudio.playDropBounce();
      } else if (audioName === 'branch-pop' || audioName === 'branchpop' || audioName === 'branch') {
        arAudio.playBranchPop();
      }
      this.el.emit('gltf-animation-marker', marker);
    },
    applyAnimationFrame(frame = 0, options = {}) {
      if (!this.mixer || !this.actions?.size) return false;
      const animation = this.config.animation || {};
      const fps = this._getFps(options);
      const frameNumber = Math.max(0, numberOr(frame, this._getStartFrame()));
      const timeSec = Number.isFinite(Number(options.timeSec))
        ? Math.max(0, Number(options.timeSec))
        : frameNumber / fps;
      const clipNames = normalizeClipNames(options.clips || animation.clips || animation.introClip, this.getAnimationNames());
      const actions = clipNames.map((name) => this.actions.get(name)).filter(Boolean);
      if (!actions.length) return false;

      this.stopAllAnimations();
      actions.forEach((action) => {
        action.enabled = true;
        action.paused = false;
        action.reset();
        action.play();
        action.time = Math.min(timeSec, action.getClip?.().duration || timeSec);
      });
      this.mixer.update(0);
      this._syncHiddenNodesAtTime(timeSec);
      actions.forEach((action) => {
        action.paused = true;
      });
      this.model?.updateMatrixWorld?.(true);
      this.bounds = this._readBounds(this.model);
      this.el.emit('gltf-animation-frame-applied', { frame: frameNumber, timeSec, clips: clipNames });
      return true;
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
      const startTimeSec = this._getStartTimeSec(options);
      const endTimeSec = this._getPlaybackEndTimeSec(action, options);
      this.actions.forEach((other) => {
        if (other !== action) other.fadeOut?.(fadeMs / 1000);
      });
      action.enabled = true;
      action.paused = false;
      action.timeScale = timeScale;
      action.reset();
      action.time = Math.min(startTimeSec, action.getClip?.().duration || startTimeSec);
      this._syncHiddenNodesAtTime(startTimeSec);
      this._startMarkers(options.markers, timeScale, startTimeSec, endTimeSec);
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
        let settled = false;
        let timeout = null;
        const finish = (event) => {
          if (event.action !== action) return;
          done(true);
        };
        const done = (result) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          this.mixer?.removeEventListener?.('finished', finish);
          this._clampActionsAtTime(action, endTimeSec);
          this._flushMarkers(endTimeSec);
          this._stopMarkers();
          this.el.emit('gltf-animation-finished', { name, endFrame: this._getEndFrame(options), endTimeSec });
          resolve(result);
        };
        const remainingDuration = Math.max(0, endTimeSec - startTimeSec);
        const durationMs = remainingDuration > 0
          ? (remainingDuration / (Math.abs(timeScale) || 1)) * 1000 + 50
          : 50;
        timeout = window.setTimeout(() => done(true), durationMs);
        this.mixer?.addEventListener?.('finished', finish);
      });
    },
    playClipsOnce(names, options = {}) {
      const THREE = getThree();
      if (!THREE) return Promise.resolve(false);
      const clipNames = normalizeClipNames(names, this.getAnimationNames());
      const entries = clipNames
        .map((name) => {
          const action = this.actions.get(name);
          if (!action) this.el.emit('gltf-animation-missing', { name });
          return action ? { name, action } : null;
        })
        .filter(Boolean);
      if (!entries.length) return Promise.resolve(false);

      this.stopAllAnimations();
      const fadeMs = numberOr(options.crossFadeMs, numberOr(this.config.animation?.crossFadeMs, 0));
      const timeScale = numberOr(options.timeScale, numberOr(this.config.animation?.timeScale, 1));
      const startTimeSec = this._getStartTimeSec(options);
      const endTimeSec = this._getPlaybackEndTimeSec(entries.map(({ action }) => action), options);
      entries.forEach(({ action }) => {
        action.enabled = true;
        action.paused = false;
        action.timeScale = timeScale;
        action.reset();
        action.time = Math.min(startTimeSec, action.getClip?.().duration || startTimeSec);
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = options.clampWhenFinished !== false;
        action.fadeIn?.(fadeMs / 1000);
        action.play();
      });
      this._syncHiddenNodesAtTime(startTimeSec);
      this._startMarkers(options.markers || this.config.animation?.markers, timeScale, startTimeSec, endTimeSec);

      return new Promise((resolve) => {
        const remaining = new Set(entries.map(({ action }) => action));
        let settled = false;
        let timeout = null;
        const finish = (event) => {
          if (!remaining.has(event.action)) return;
          remaining.delete(event.action);
          if (!remaining.size) done(true);
        };
        const done = (result) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          this.mixer?.removeEventListener?.('finished', finish);
          this._clampActionsAtTime(entries.map(({ action }) => action), endTimeSec);
          this._flushMarkers(endTimeSec);
          this._stopMarkers();
          this.el.emit('gltf-animation-finished', {
            name: 'all-clips',
            clips: entries.map(({ name }) => name),
            endFrame: this._getEndFrame(options),
            endTimeSec,
          });
          resolve(result);
        };
        const remainingDuration = Math.max(0, endTimeSec - startTimeSec);
        const durationMs = remainingDuration > 0
          ? (remainingDuration / (Math.abs(timeScale) || 1)) * 1000 + 250
          : 250;
        timeout = window.setTimeout(() => done(true), durationMs);
        this.mixer?.addEventListener?.('finished', finish);
      });
    },
    async playIntroThenIdle() {
      const animation = this.config.animation || {};
      if (animation.playMode === 'all-clips-once') {
        await this.playClipsOnce(animation.clips, {
          clampWhenFinished: animation.clampIntroWhenFinished !== false,
          crossFadeMs: animation.crossFadeMs,
          timeScale: animation.timeScale,
          markers: animation.markers,
          endFrame: animation.endFrame,
          endTimeSec: animation.endTimeSec,
        });
        return this.playIdle();
      }
      const introClip = animation.introClip;
      const idleClip = animation.idleClip;
      if (introClip && this.actions.has(introClip)) {
        await this.playClip(introClip, {
          once: true,
          clampWhenFinished: animation.clampIntroWhenFinished !== false,
          crossFadeMs: animation.crossFadeMs,
          timeScale: animation.timeScale,
          markers: animation.markers,
          endFrame: animation.endFrame,
          endTimeSec: animation.endTimeSec,
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
      this._stopMarkers();
      this.actions?.forEach((action) => {
        try { action.stop(); } catch {}
      });
      try { this.mixer?.stopAllAction?.(); } catch {}
    },
    getAnimationNames() {
      return Array.from(this.actions?.keys?.() || []);
    },
    getBounds() {
      return this.bounds;
    },
    isReady() {
      return Boolean(this.ready && this.model);
    },
    tick(_, dtMs) {
      if (!this.mixer) return;
      const dtSec = (dtMs || 0) / 1000;
      this.mixer.update(dtSec);
      if (this.markerRun) {
        this.markerRun.elapsedSec += dtSec * this.markerRun.timeScale;
        this._syncHiddenNodesAtTime(this.markerRun.elapsedSec);
        this._flushMarkers();
      }
    },
  });
}
