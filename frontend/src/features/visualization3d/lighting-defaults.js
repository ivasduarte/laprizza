/**
 * Default lighting (VIS05 look). The light positions are fixed in the scene; only these
 * values can be changed through the VIS06 controls.
 */
export const DEFAULT_LIGHTING = {
  ambient: { enabled: true, color: '#ffffff', intensity: 0.35 },
  hemisphere: { enabled: true, color: '#ffffff', intensity: 0.45 },
  directional: { enabled: true, color: '#ffffff', intensity: 1.1 },
  spotlight: {
    enabled: true,
    color: '#ffffff',
    intensity: 3,
    angle: 60,
    penumbra: 0.6,
  },
  lineSpotlight: {
    enabled: true,
    color: '#ffffff',
    intensity: 2,
    angle: 60,
    penumbra: 0.7,
  },
};
