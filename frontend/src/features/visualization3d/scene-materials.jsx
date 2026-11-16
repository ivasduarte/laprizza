import { Component, Suspense, useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three';

/**
 * Materials of the 3D objects (VIS04). The material of each object comes from the back
 * end as JSON (`element.material`, `content.floor.material`):
 *   { color, colorMap, roughnessMap, bumpMap, normalMap, roughness, metalness, repeat }
 *
 * Performance:
 * - textures are only loaded when the JSON references them (1k JPGs from public/textures);
 * - each file is downloaded once and cached by URL (drei's loader cache); the per-object
 *   copies needed for `repeat` share the same image source, so it is uploaded to the
 *   GPU once;
 * - materials and texture copies are disposed when the object leaves the scene;
 * - while textures load, the object is drawn with its plain material (no empty frame).
 */

const MAX_ANISOTROPY = 4;

const TEXTURE_SLOTS = {
  colorMap: 'map',
  roughnessMap: 'roughnessMap',
  bumpMap: 'bumpMap',
  normalMap: 'normalMap',
};

const hasTextures = (spec) => Boolean(spec?.colorMap);

/** Plain (untextured) material from the JSON colour and properties. */
function usePlainMaterial(spec, fallbackColor) {
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: spec?.color ?? fallbackColor,
        roughness: spec?.roughness ?? 1,
        metalness: spec?.metalness ?? 0,
      }),
    [spec?.color, spec?.roughness, spec?.metalness, fallbackColor]
  );
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

/** Textured material; suspends while the textures load. */
function TexturedMaterial({ spec, children }) {
  const maxAnisotropy = useThree((state) =>
    state.gl.capabilities.getMaxAnisotropy()
  );

  const urls = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(TEXTURE_SLOTS)
          .filter(([property]) => spec[property])
          .map(([property, slot]) => [slot, spec[property]])
      ),
    [spec]
  );
  const loaded = useTexture(urls);

  const repeatX = spec.repeat?.x ?? 1;
  const repeatY = spec.repeat?.y ?? 1;

  const material = useMemo(() => {
    const textures = {};
    for (const [slot, texture] of Object.entries(loaded)) {
      // Copy so that each object can have its own repeat; the image source is shared.
      const copy = texture.clone();
      copy.wrapS = RepeatWrapping;
      copy.wrapT = RepeatWrapping;
      copy.repeat.set(repeatX, repeatY);
      copy.anisotropy = Math.min(MAX_ANISOTROPY, maxAnisotropy);
      if (slot === 'map') copy.colorSpace = SRGBColorSpace;
      copy.needsUpdate = true;
      textures[slot] = copy;
    }
    return new MeshStandardMaterial({
      color: spec.color ?? '#ffffff',
      roughness: spec.roughness ?? 1,
      metalness: spec.metalness ?? 0,
      ...textures,
    });
  }, [
    loaded,
    repeatX,
    repeatY,
    maxAnisotropy,
    spec.color,
    spec.roughness,
    spec.metalness,
  ]);

  useEffect(
    () => () => {
      for (const slot of Object.values(TEXTURE_SLOTS))
        material[slot]?.dispose();
      material.dispose();
    },
    [material]
  );

  return children(material);
}

/** A texture that fails to load falls back to the plain material instead of breaking the scene. */
class TextureErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn(
      '[VIS04] Texture could not be loaded; using the plain material.',
      error
    );
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Resolves the material of one object and renders `children(material)`.
 * - no `spec`: `children(null)`, so the model keeps its own default colours;
 * - `spec` without textures: a plain material with its colour and properties;
 * - `spec` with textures: the plain material while loading or on failure, then the
 *   textured material.
 */
export function WithMaterial({ spec, fallbackColor, children }) {
  if (!spec) return children(null);
  return (
    <ResolvedMaterial spec={spec} fallbackColor={fallbackColor}>
      {children}
    </ResolvedMaterial>
  );
}

function ResolvedMaterial({ spec, fallbackColor, children }) {
  const plain = usePlainMaterial(spec, fallbackColor);
  if (!hasTextures(spec)) return children(plain);

  const plainView = children(plain);
  return (
    <TextureErrorBoundary fallback={plainView}>
      <Suspense fallback={plainView}>
        <TexturedMaterial spec={spec}>{children}</TexturedMaterial>
      </Suspense>
    </TextureErrorBoundary>
  );
}

/**
 * Material of a mesh surface: the resolved material when there is one, otherwise the
 * model's own default colour (so models without a JSON material look as before).
 */
export function Surface({ material, color }) {
  return material ? (
    // Shared by several meshes and disposed by its owner (WithMaterial), never per mesh.
    <primitive object={material} attach="material" dispose={null} />
  ) : (
    <meshStandardMaterial color={color} />
  );
}
