let previewStream = null;
let previewFacingMode = 'environment';
let requestPromise = null;
let transferred = false;
const subscribers = new Set();

function hasLiveVideo(stream) {
  return Boolean(stream?.getVideoTracks?.().some((track) => track.readyState === 'live'));
}

function normalizeFacingMode(value) {
  return value === 'user' ? 'user' : 'environment';
}

function snapshot() {
  return {
    stream: hasLiveVideo(previewStream) ? previewStream : null,
    facingMode: previewFacingMode,
    transferred,
  };
}

function notify() {
  const next = snapshot();
  subscribers.forEach((cb) => {
    try { cb(next); } catch (error) { console.error(error); }
  });
}

function clearDeadStream() {
  if (previewStream && !hasLiveVideo(previewStream)) {
    previewStream = null;
    transferred = false;
    notify();
  }
}

export function subscribeCameraPreview(cb) {
  subscribers.add(cb);
  cb(snapshot());
  return () => subscribers.delete(cb);
}

export function getCameraPreviewSnapshot() {
  clearDeadStream();
  return snapshot();
}

export async function requestCameraPreview({ facingMode = 'environment' } = {}) {
  clearDeadStream();
  const nextFacingMode = normalizeFacingMode(facingMode);
  if (previewStream && previewFacingMode === nextFacingMode && hasLiveVideo(previewStream)) {
    return previewStream;
  }
  if (requestPromise) return requestPromise;

  requestPromise = navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: nextFacingMode },
    },
  }).then((stream) => {
    if (previewStream && previewStream !== stream && !transferred) {
      previewStream.getTracks?.().forEach((track) => track.stop());
    }
    previewStream = stream;
    previewFacingMode = nextFacingMode;
    transferred = false;
    notify();
    return stream;
  }).finally(() => {
    requestPromise = null;
  });

  return requestPromise;
}

export function takeCameraPreviewStream({ facingMode = 'environment' } = {}) {
  clearDeadStream();
  const nextFacingMode = normalizeFacingMode(facingMode);
  if (!previewStream || transferred || previewFacingMode !== nextFacingMode || !hasLiveVideo(previewStream)) {
    return null;
  }
  transferred = true;
  notify();
  return previewStream;
}

export function detachCameraPreview() {
  if (!previewStream) return;
  if (!transferred) {
    previewStream.getTracks?.().forEach((track) => track.stop());
  }
  previewStream = null;
  transferred = false;
  notify();
}

export function stopCameraPreview() {
  if (previewStream) {
    previewStream.getTracks?.().forEach((track) => track.stop());
  }
  previewStream = null;
  transferred = false;
  notify();
}
