export function getARRuntime() {
  return window.__ar || window.__mindar || null;
}

export function isKivicubeRuntime(runtime) {
  return runtime?.provider === 'kivicube';
}

export function subscribeARRuntime(eventName, cb) {
  const runtime = getARRuntime();
  const subscribe = runtime?.[eventName];
  if (typeof subscribe !== 'function') return () => {};
  return subscribe(cb);
}
