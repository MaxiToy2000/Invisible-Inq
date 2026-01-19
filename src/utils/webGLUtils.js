let activeGraphInstance = null;

export const setActiveGraphInstance = (instance) => {
  if (activeGraphInstance && activeGraphInstance !== instance) {
    cleanupGraphInstance(activeGraphInstance);
  }

  activeGraphInstance = instance;
};

export const getActiveGraphInstance = () => {
  return activeGraphInstance;
};

export const cleanupGraphInstance = (instance) => {
  if (!instance) return;

  try {
    if (typeof instance.pauseAnimation === 'function') {
      instance.pauseAnimation();
    }

    let renderer = null;
    let scene = null;
    let canvas = null;

    if (instance._renderer) {
      renderer = instance._renderer;
      scene = instance._scene;
    } else if (typeof instance.renderer === 'function') {
      renderer = instance.renderer();
      if (typeof instance.scene === 'function') {
        scene = instance.scene();
      }
    }

    if (renderer && renderer.domElement) {
      canvas = renderer.domElement;
    }

    if (scene) {
      while (scene.children.length > 0) {
        const object = scene.children[0];
        scene.remove(object);

        if (object.geometry) {
          object.geometry.dispose();
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => {
              if (material.map) material.map.dispose();
              material.dispose();
            });
          } else {
            if (object.material.map) object.material.map.dispose();
            object.material.dispose();
          }
        }
      }
    }

    if (canvas) {
      try {
        let gl = null;
        let contextType = null;

        gl = canvas.getContext('webgl2');
        if (gl) {
          contextType = 'webgl2';
        } else {
          gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          if (gl) {
            contextType = 'webgl';
          } else {
            const ctx2d = canvas.getContext('2d');
            if (ctx2d) {
              contextType = '2d';
            }
          }
        }

        if (gl) {
          const loseContextExt = gl.getExtension('WEBGL_lose_context');
          if (loseContextExt) {
            loseContextExt.loseContext();
          }

          if (renderer && typeof renderer.forceContextLoss === 'function') {
            renderer.forceContextLoss();
          }
        }

        if (canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }

        canvas.width = 1;
        canvas.height = 1;

        try {
          canvas.setAttribute('data-disposed', 'true');
        } catch (e) {

        }
      } catch (e) {
        console.warn('Error forcing WebGL context loss:', e);
      }
    }

    if (renderer) {
      if (typeof renderer.dispose === 'function') {
        renderer.dispose();
      }
    }

    if (typeof instance.dispose === 'function') {
      instance.dispose();
    }
  } catch (error) {
    console.error("Error cleaning up graph instance:", error);
  }

  if (instance === activeGraphInstance) {
    activeGraphInstance = null;
  }
};

export const releaseUnusedWebGLContexts = () => {
  return new Promise(resolve => {
    if (typeof window !== 'undefined') {
      const canvases = document.querySelectorAll('canvas');
      canvases.forEach(canvas => {
        if (!document.body.contains(canvas)) {
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          if (gl) {
            const loseContextExt = gl.getExtension('WEBGL_lose_context');
            if (loseContextExt) {
              loseContextExt.loseContext();
            }

            canvas.width = 1;
            canvas.height = 1;
          }
        }
      });
    }

    resolve();
  });
};

export const checkWebGLContextLimit = () => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    if (!gl) {
      console.warn('Unable to create new WebGL context - may be at browser limit');
      return true;
    }

    const loseContextExt = gl.getExtension('WEBGL_lose_context');
    if (loseContextExt) {
      loseContextExt.loseContext();
    }

    return false;
  } catch (e) {
    console.error('Error checking WebGL context limit:', e);
    return true;
  }
};
