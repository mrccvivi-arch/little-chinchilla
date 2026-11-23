import * as THREE from "./vendor/three.module.min.js";
import { canStand, createWorld, disposeWorld, groundHeight, landmarks } from "./world.js";
import { createControls } from "./controls.js";

export function openMeadow(root, { player, spawn, bounds, onSave, onReturn, onError }) {
  const stage = root.querySelector(".meadow-stage");
  const status = root.querySelector("#meadow-status");
  const action = root.querySelector("#meadow-interact");
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "云野三维画面");
  const context = canvas.getContext("webgl2", { antialias: true, alpha: false, powerPreference: "low-power" });
  if (!context) throw new Error("此设备或浏览器无法开启 WebGL 2");

  const renderer = new THREE.WebGLRenderer({ canvas, context });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.4));
  const { scene, avatar, contact } = createWorld();
  const camera = new THREE.PerspectiveCamera(53, 1, .1, 75);
  const origin = canStand(player.x, player.z, bounds) ? player : spawn;
  let { x, z, yaw } = origin;
  let desiredYaw = yaw;
  let elevation = .38;
  let desiredElevation = elevation;
  let frame;
  let previousTime;
  let disposed = false;
  let nearby;
  let savedPlayer = origin;
  const target = new THREE.Vector3();
  stage.prepend(canvas);

  function getPlayer() {
    return { x, z, yaw: desiredYaw % (Math.PI * 2) };
  }

  function savePlayer() {
    const position = getPlayer();
    if (position.x === savedPlayer.x && position.z === savedPlayer.z && position.yaw === savedPlayer.yaw) return;
    savedPlayer = position;
    onSave(position);
  }

  function resize() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    wake();
  }

  function updateLandmark() {
    const found = landmarks.find((spot) => Math.hypot(spot.x - x, spot.z - z) <= spot.range);
    if (found === nearby) return;
    nearby = found;
    action.disabled = !found;
    action.textContent = found?.label ?? "互动";
  }

  function interact() {
    if (!nearby) return;
    if (nearby.portal) onReturn();
    else status.textContent = nearby.text;
  }

  function wake() {
    if (disposed || document.hidden || frame !== undefined) return;
    frame = requestAnimationFrame(render);
  }

  const controls = createControls(stage, {
    onChange: wake,
    onLook(dx, dy) {
      desiredYaw -= dx * .008;
      desiredElevation = Math.max(.22, Math.min(1.12, desiredElevation + dy * .006));
      wake();
    },
    onRelease() {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = previousTime = undefined;
      }
      savePlayer();
    },
  });

  function render(time) {
    frame = undefined;
    if (disposed || document.hidden) return;
    const dt = Math.min(.05, (time - (previousTime ?? time - 16)) / 1000);
    previousTime = time;
    const [horizontal, vertical] = controls.movement();
    const moving = Math.hypot(horizontal, vertical) > .08;
    if (moving) {
      const dx = (Math.cos(desiredYaw) * horizontal + Math.sin(desiredYaw) * vertical) * dt * 4.5;
      const dz = (-Math.sin(desiredYaw) * horizontal + Math.cos(desiredYaw) * vertical) * dt * 4.5;
      if (canStand(x + dx, z, bounds)) x += dx;
      if (canStand(x, z + dz, bounds)) z += dz;
      const heading = Math.atan2(-dx, -dz);
      const turn = heading - avatar.rotation.y;
      avatar.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, dt * 13);
    }
    avatar.position.set(x, groundHeight(x, z), z);
    contact.position.set(x, avatar.position.y + .025, z);

    const ease = 1 - Math.exp(-dt * 13);
    yaw += (desiredYaw - yaw) * ease;
    elevation += (desiredElevation - elevation) * ease;
    const distance = 6.8;
    const cameraX = x + Math.sin(yaw) * Math.cos(elevation) * distance;
    const cameraZ = z + Math.cos(yaw) * Math.cos(elevation) * distance;
    camera.position.set(cameraX, Math.max(groundHeight(cameraX, cameraZ) + .65,
      avatar.position.y + 1.05 + Math.sin(elevation) * distance), cameraZ);
    target.set(x, avatar.position.y + .83, z);
    camera.lookAt(target);
    updateLandmark();
    renderer.render(scene, camera);
    if (moving || Math.abs(yaw - desiredYaw) + Math.abs(elevation - desiredElevation) > .001) wake();
    else previousTime = undefined;
  }

  function contextLost(event) {
    event.preventDefault();
    onError("云野的 3D 画面暂时中断，可以返回林间小径后再试。");
  }

  const observer = "ResizeObserver" in window ? new ResizeObserver(resize) : null;
  if (observer) observer.observe(stage);
  else window.addEventListener("resize", resize);
  window.addEventListener("pagehide", savePlayer);
  action.addEventListener("click", interact);
  canvas.addEventListener("webglcontextlost", contextLost);
  action.disabled = true;
  action.textContent = "互动";
  resize();

  return {
    getPlayer,
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pagehide", savePlayer);
      action.removeEventListener("click", interact);
      canvas.removeEventListener("webglcontextlost", contextLost);
      controls.dispose();
      disposeWorld(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      action.disabled = true;
    },
  };
}
