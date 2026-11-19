import { useEffect, useImperativeHandle, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MOUSE } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CAMERA_FOV, CONTROL_SPEEDS, constrainPan } from './camera-view.js';

function moveTo(controls, view) {
  controls.enableDamping = false;
  controls.update();
  controls.target.set(view.target.x, view.target.y, view.target.z);
  controls.object.position.set(
    view.position.x,
    view.position.y,
    view.position.z
  );
  controls.update();
  controls.enableDamping = true;
}

/**
 * VIS07: mouse control of the PerspectiveCamera.
 * Left drag pans along the floor, right drags orbits around the target, the wheel dollies.
 * All limits come from `setup`; when it changes the controls are rebuilt
 * and the view starts again from the floor centre.
 */
export default function CameraControls({ setup, ref }) {
  const camera = useThree((state) => state.camera);
  const domElement = useThree((state) => state.gl.domElement);
  const controlsRef = useRef(null);

  useEffect(() => {
    camera.fov = CAMERA_FOV;
    camera.near = setup.near;
    camera.far = setup.far;
    camera.updateProjectionMatrix();

    const controls = new OrbitControls(camera, domElement);
    controls.mouseButtons = {
      LEFT: MOUSE.PAN,
      MIDDLE: MOUSE.DOLLY,
      RIGHT: MOUSE.ROTATE,
    };
    Object.assign(controls, CONTROL_SPEEDS);
    controls.enableDamping = true;
    controls.screenSpacePanning = false; // pan slides parallel to the floor
    controls.zoomToCursor = false; // the wheel always dollies towards the target
    controls.minDistance = setup.minDistance;
    controls.maxDistance = setup.maxDistance;
    controls.minPolarAngle = setup.minPolarAngle;
    controls.maxPolarAngle = setup.maxPolarAngle;
    controls.minAzimuthAngle = setup.minAzimuthAngle;
    controls.maxAzimuthAngle = setup.maxAzimuthAngle;

    // Pan limit: "change" is dispatched by update() after the camera has looked at the
    // target, so moving both by the same offset keeps the orientation (no jump).
    const onChange = () => {
      const { target, position, changed } = constrainPan(
        controls.target,
        camera.position,
        setup.panBounds
      );
      if (!changed) return;
      controls.target.set(target.x, target.y, target.z);
      camera.position.set(position.x, position.y, position.z);
    };

    // Right drag orbits: the browser context menu must not open on the canvas.
    const onContextMenu = (event) => event.preventDefault();

    controls.addEventListener('change', onChange);
    domElement.addEventListener('contextmenu', onContextMenu);
    moveTo(controls, setup);
    controlsRef.current = controls;

    return () => {
      controls.removeEventListener('change', onChange);
      domElement.removeEventListener('contextmenu', onContextMenu);
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, domElement, setup]);

  // Damping needs one update per frame. A negative priority keeps R3F's own rendering.
  useFrame(() => controlsRef.current?.update(), -1);

  useImperativeHandle(
    ref,
    () => ({
      reset: () => {
        if (controlsRef.current) moveTo(controlsRef.current, setup);
      },
    }),
    [setup]
  );

  return null;
}
