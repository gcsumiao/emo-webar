const AFRAME = window.AFRAME;

if (AFRAME && !AFRAME.components['billboard-y']) {
  AFRAME.registerComponent('billboard-y', {
    init() {
      const THREE = window.THREE || AFRAME.THREE;
      this._tmp = new THREE.Vector3();
    },
    tick() {
      const camera = this.el.sceneEl?.camera;
      if (!camera) return;
      const obj = this.el.object3D;
      const parent = obj.parent;
      if (!parent) return;
      camera.getWorldPosition(this._tmp);
      parent.worldToLocal(this._tmp);
      const dx = this._tmp.x - obj.position.x;
      const dz = this._tmp.z - obj.position.z;
      const angleY = Math.atan2(dx, dz);
      obj.rotation.set(0, angleY, 0);
    },
  });
}
