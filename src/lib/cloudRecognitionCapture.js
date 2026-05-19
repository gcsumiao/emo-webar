const DEFAULT_CAPTURE_SIZE = 384;
const DEFAULT_JPEG_QUALITY = 0.72;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function findCameraVideo() {
  const videos = Array.from(document.querySelectorAll('video'));
  return videos.find((video) => (
    video.videoWidth > 0 &&
    video.videoHeight > 0 &&
    video.readyState >= 2 &&
    video.offsetParent !== null
  )) || videos.find((video) => video.videoWidth > 0 && video.videoHeight > 0) || null;
}

function visibleIntersection(a, b) {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.left + a.width, b.left + b.width);
  const bottom = Math.min(a.top + a.height, b.top + b.height);
  if (right <= left || bottom <= top) return null;
  return { left, top, width: right - left, height: bottom - top };
}

function readSourceRect(video, cropRect) {
  const videoRect = video.getBoundingClientRect();
  const viewportRect = {
    left: 0,
    top: 0,
    width: window.innerWidth || document.documentElement.clientWidth || videoRect.width,
    height: window.innerHeight || document.documentElement.clientHeight || videoRect.height,
  };
  const requested = cropRect || viewportRect;
  const clipped = visibleIntersection(requested, videoRect) || videoRect;
  const style = window.getComputedStyle(video);
  const objectFit = style.objectFit || 'cover';

  if (objectFit === 'fill') {
    return {
      sx: clamp(((clipped.left - videoRect.left) / videoRect.width) * video.videoWidth, 0, video.videoWidth - 1),
      sy: clamp(((clipped.top - videoRect.top) / videoRect.height) * video.videoHeight, 0, video.videoHeight - 1),
      sw: clamp((clipped.width / videoRect.width) * video.videoWidth, 1, video.videoWidth),
      sh: clamp((clipped.height / videoRect.height) * video.videoHeight, 1, video.videoHeight),
    };
  }

  const scale = objectFit === 'contain'
    ? Math.min(videoRect.width / video.videoWidth, videoRect.height / video.videoHeight)
    : Math.max(videoRect.width / video.videoWidth, videoRect.height / video.videoHeight);
  const renderedWidth = video.videoWidth * scale;
  const renderedHeight = video.videoHeight * scale;
  const renderedLeft = videoRect.left + (videoRect.width - renderedWidth) / 2;
  const renderedTop = videoRect.top + (videoRect.height - renderedHeight) / 2;

  return {
    sx: clamp((clipped.left - renderedLeft) / scale, 0, video.videoWidth - 1),
    sy: clamp((clipped.top - renderedTop) / scale, 0, video.videoHeight - 1),
    sw: clamp(clipped.width / scale, 1, video.videoWidth),
    sh: clamp(clipped.height / scale, 1, video.videoHeight),
  };
}

export function captureRecognitionFrame({
  cropRect,
  size = DEFAULT_CAPTURE_SIZE,
  quality = DEFAULT_JPEG_QUALITY,
} = {}) {
  const video = findCameraVideo();
  if (!video) return null;

  const source = readSourceRect(video, cropRect);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return null;

  ctx.drawImage(
    video,
    source.sx,
    source.sy,
    source.sw,
    source.sh,
    0,
    0,
    size,
    size
  );

  return {
    imageDataUrl: canvas.toDataURL('image/jpeg', quality),
    width: size,
    height: size,
  };
}
