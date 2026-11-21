import { useEffect, useImperativeHandle, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Box3, MOUSE } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  CAMERA_BLOCKER,
  CAMERA_FOV,
  CONTROL_SPEEDS,
  OBSTACLE_MARGIN,
  constrainPan,
  isCameraPositionAllowed,
} from './camera-view.js';

/** The obstacle boxes are recomputed at most every BOXES_TTL ms (elements load late). */
const BOXES_TTL = 500;

/**
 * Bounding boxes (expanded by OBSTACLE_MARGIN) of the scene objects marked as camera
 * blockers (the configuration elements).
 */
function createObstacleBoxes(scene) {
  let boxes = [];
  let computedAt = -Infinity;
  return () => {
    const now = performance.now();
    if (now - computedAt < BOXES_TTL) return boxes;
    computedAt = now;
    boxes = [];
    scene.traverse((object) => {
      if (!object.userData?.[CAMERA_BLOCKER]) return;
      const box = new Box3().setFromObject(object);
      if (!box.isEmpty()) boxes.push(box.expandByScalar(OBSTACLE_MARGIN));
    });
    return boxes;
  };
}

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
  const scene = useThree((state) => state.scene);
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

    // Last camera position (and target) outside every object, restored when a pan,
    // orbit or dolly would put the camera inside an object or under the floor.
    const obstacleBoxes = createObstacleBoxes(scene);
    const lastAllowed = {
      position: camera.position.clone(),
      target: controls.target.clone(),
    };
    controls.userData = { lastAllowed };

    // Pan limit: "change" is dispatched by update() after the camera has looked at the
    // target, so moving both by the same offset keeps the orientation (no jump).
    const onChange = () => {
      const { target, position, changed } = constrainPan(
        controls.target,
        camera.position,
        setup.panBounds
      );
      if (changed) {
        controls.target.set(target.x, target.y, target.z);
        camera.position.set(position.x, position.y, position.z);
      }

      // VIS07: the camera cannot go through objects.
      if (isCameraPositionAllowed(camera.position, obstacleBoxes())) {
        lastAllowed.position.copy(camera.position);
        lastAllowed.target.copy(controls.target);
        return;
      }
      camera.position.copy(lastAllowed.position);
      controls.target.copy(lastAllowed.target);
      camera.lookAt(controls.target);
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
  }, [camera, domElement, scene, setup]);

  // Damping needs one update per frame. A negative priority keeps R3F's own rendering.
  useFrame(() => controlsRef.current?.update(), -1);

  useImperativeHandle(
    ref,
    () => ({
      reset: () => {
        const controls = controlsRef.current;
        if (!controls) return;
        moveTo(controls, setup);
        controls.userData?.lastAllowed.position.copy(controls.object.position);
        controls.userData?.lastAllowed.target.copy(controls.target);
      },
    }),
    [setup]
  );

  return null;
}
