import { useEffect, useRef } from 'react';
import GUI from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { DEFAULT_LIGHTING } from './lighting-defaults.js';

/** One folder per light source: title, max intensity and whether it is a spotlight. */
const LIGHTS = [
  { key: 'ambient', title: 'Ambient light', maxIntensity: 2 },
  { key: 'hemisphere', title: 'Hemisphere light', maxIntensity: 2 },
  { key: 'directional', title: 'Directional light', maxIntensity: 3 },
  {
    key: 'spotlight',
    title: 'Spotlight (kitchen)',
    maxIntensity: 10,
    spot: true,
  },
  {
    key: 'lineSpotlight',
    title: 'Spotlight (assembly line)',
    maxIntensity: 10,
    spot: true,
  },
];

/**
 * Lighting controls (VIS06). The light positions stay fixed (VIS05); the manager can
 * only switch each light on/off and change its colour and intensity, plus cutoff angle
 * (degrees) and penumbra for the spotlights.
 *
 * Renders the lil-gui panel (open by default) in the top-right corner of the nearest
 * positioned parent. Calls `onChange(lighting)` with a fresh copy on every change.
 */
export default function LightingControls({ onChange }) {
  const containerRef = useRef(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const state = structuredClone(DEFAULT_LIGHTING);
    const gui = new GUI({
      title: 'Lighting',
      container: containerRef.current,
    });
    const syncs = [];

    const emit = () => onChangeRef.current?.(structuredClone(state));

    // When a light is off, its other controls are disabled.
    const addLight = ({ key, title, maxIntensity, spot }) => {
      const light = state[key];
      const folder = gui.addFolder(title);

      const enabled = folder.add(light, 'enabled').name('On');
      const controls = [
        folder.addColor(light, 'color').name('Color'),
        folder.add(light, 'intensity', 0, maxIntensity, 0.01).name('Intensity'),
      ];
      if (spot) {
        controls.push(
          folder.add(light, 'angle', 5, 90, 1).name('Cutoff angle (°)'),
          folder.add(light, 'penumbra', 0, 1, 0.01).name('Penumbra')
        );
      }

      const sync = () => controls.forEach((c) => c.disable(!light.enabled));
      enabled.onChange(sync);
      syncs.push(sync);
      sync();
    };

    const reset = () => {
      for (const key of Object.keys(DEFAULT_LIGHTING)) {
        Object.assign(state[key], DEFAULT_LIGHTING[key]);
      }
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
      syncs.forEach((sync) => sync());
      emit();
    };

    gui.add({ reset }, 'reset').name('Reset');
    LIGHTS.forEach(addLight);

    // Fires for every controller, including those inside folders.
    gui.onChange(emit);

    return () => gui.destroy();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 1,
        // The panel is taller than small viewers: scroll inside the viewer instead of being cut.
        maxHeight: 'calc(100% - 16px)',
        overflowY: 'auto',
      }}
    />
  );
}
