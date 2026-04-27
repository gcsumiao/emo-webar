import { useEffect, useMemo, useState } from 'react';

function readViewport() {
  if (typeof window === 'undefined') return { width: 390, height: 844, orientation: 'portrait', isTablet: false };
  const width = window.innerWidth || 390;
  const height = window.innerHeight || 844;
  return {
    width,
    height,
    orientation: width > height ? 'landscape' : 'portrait',
    isTablet: Math.min(width, height) >= 700,
  };
}

export function useViewport() {
  const [viewport, setViewport] = useState(readViewport);

  useEffect(() => {
    const update = () => setViewport(readViewport());
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return viewport;
}

export function useScanGeometry() {
  const viewport = useViewport();
  return useMemo(() => {
    const scanSize = Math.min(420, Math.max(220, viewport.width * 0.68));
    return {
      ...viewport,
      scanSize,
      scanCenterX: viewport.width / 2,
      scanCenterY: viewport.isTablet ? viewport.height * 0.5 : viewport.height * 0.52,
    };
  }, [viewport]);
}
