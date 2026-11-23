const movementKeys = {
  KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0],
};

export function createControls(stage, { onChange, onLook, onRelease }) {
  const joystick = stage.querySelector(".meadow-joystick");
  const stick = joystick.querySelector("span");
  const dragSurface = stage.querySelector("canvas");
  const keys = new Set();
  const cleanup = [];
  let joystickPointer;
  let lookPointer;
  let previousX;
  let previousY;
  let touchX = 0;
  let touchZ = 0;

  function listen(target, event, handler) {
    target.addEventListener(event, handler);
    cleanup.push(() => target.removeEventListener(event, handler));
  }

  function dragStick(event) {
    const rect = joystick.getBoundingClientRect();
    const radius = rect.width * .36;
    touchX = (event.clientX - rect.left - rect.width / 2) / radius;
    touchZ = (event.clientY - rect.top - rect.height / 2) / radius;
    const length = Math.max(1, Math.hypot(touchX, touchZ));
    touchX /= length;
    touchZ /= length;
    stick.style.transform = `translate(${touchX * radius}px, ${touchZ * radius}px)`;
    onChange();
  }

  function resetStick() {
    joystickPointer = undefined;
    touchX = touchZ = 0;
    stick.style.transform = "";
  }

  listen(joystick, "pointerdown", (event) => {
    if (event.button !== 0 || joystickPointer !== undefined) return;
    joystickPointer = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    dragStick(event);
  });
  listen(joystick, "pointermove", (event) => {
    if (joystickPointer === event.pointerId) dragStick(event);
  });
  function endStick(event) {
    if (joystickPointer !== event.pointerId) return;
    resetStick();
    onRelease();
  }

  listen(dragSurface, "pointerdown", (event) => {
    const rect = stage.getBoundingClientRect();
    if (event.button !== 0 || lookPointer !== undefined ||
      (event.pointerType === "touch" && event.clientX < rect.left + rect.width / 2)) return;
    lookPointer = event.pointerId;
    previousX = event.clientX;
    previousY = event.clientY;
    dragSurface.setPointerCapture(event.pointerId);
  });
  listen(dragSurface, "pointermove", (event) => {
    if (lookPointer !== event.pointerId) return;
    onLook(event.clientX - previousX, event.clientY - previousY);
    previousX = event.clientX;
    previousY = event.clientY;
  });
  function endLook(event) {
    if (lookPointer !== event.pointerId) return;
    lookPointer = undefined;
    onRelease();
  }

  for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) {
    listen(joystick, event, endStick);
    listen(dragSurface, event, endLook);
  }
  listen(window, "keydown", (event) => {
    if (!movementKeys[event.code] || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    keys.add(event.code);
    onChange();
  });
  listen(window, "keyup", (event) => {
    if (keys.delete(event.code)) onRelease();
  });
  listen(window, "blur", clear);
  listen(document, "visibilitychange", () => {
    if (document.hidden) clear();
    else onChange();
  });

  function clear() {
    resetStick();
    lookPointer = undefined;
    keys.clear();
    onRelease();
  }

  return {
    movement() {
      let x = touchX;
      let z = touchZ;
      for (const key of keys) {
        x += movementKeys[key][0];
        z += movementKeys[key][1];
      }
      const length = Math.max(1, Math.hypot(x, z));
      return [x / length, z / length];
    },
    dispose() {
      cleanup.forEach((remove) => remove());
      resetStick();
    },
  };
}
