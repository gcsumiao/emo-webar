import { KIVICUBE_PLUGIN_SRC } from './kivicubeConfig.js';

let pluginPromise = null;

export function ensureKivicubePlugin() {
  if (window.kivicubeIframePlugin) return Promise.resolve(window.kivicubeIframePlugin);
  if (pluginPromise) return pluginPromise;

  pluginPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${KIVICUBE_PLUGIN_SRC}"]`);

    const resolveIfReady = () => {
      if (window.kivicubeIframePlugin) {
        resolve(window.kivicubeIframePlugin);
        return true;
      }
      return false;
    };

    if (resolveIfReady()) return;

    const script = existingScript || document.createElement('script');
    const onLoad = () => {
      if (resolveIfReady()) return;
      reject(new Error('Kivicube iframe plugin loaded but window.kivicubeIframePlugin is unavailable.'));
    };
    const onError = () => {
      pluginPromise = null;
      reject(new Error(`Failed to load Kivicube iframe plugin: ${KIVICUBE_PLUGIN_SRC}`));
    };

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });

    if (!existingScript) {
      script.src = KIVICUBE_PLUGIN_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return pluginPromise;
}
