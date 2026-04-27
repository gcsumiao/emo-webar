export function pointerDistance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function pointerAngle(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
}

export function normalizeAngleDelta(delta) {
  if (delta > 180) return delta - 360;
  if (delta < -180) return delta + 360;
  return delta;
}

export function clampScaleFactor(scaleFactor) {
  if (!Number.isFinite(scaleFactor)) return 1;
  return Math.min(1.12, Math.max(0.88, scaleFactor));
}
