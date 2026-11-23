"use strict";

// Positions are fractions of the playable region and survive changes in screen size.
const forestRegion = { id: "forest-edge", entrance: 0.08 };

function readWorld(saved) {
  const region = saved?.forest;
  const position = Number.isFinite(region?.position)
    ? Math.max(0, Math.min(1, region.position)) : forestRegion.entrance;

  return {
    ...saved,
    collection: readCollection(saved?.collection),
    scene: saved?.scene === "forest" ? "forest" : "cabin",
    forest: {
      ...region,
      regionId: forestRegion.id,
      position: region?.regionId === forestRegion.id ? position : forestRegion.entrance,
    },
  };
}

function createForestScene(root, onStop, onNearby) {
  const viewport = root.querySelector(".forest-viewport");
  const world = root.querySelector(".forest-world");
  const pet = root.querySelector(".forest-pet");
  const inputs = new Map();
  const markers = forestSpots.map((spot) => {
    const marker = document.createElement("span");
    marker.className = "forest-marker";
    marker.dataset.type = spot.type;
    marker.setAttribute("aria-hidden", "true");
    world.insertBefore(marker, pet);
    return marker;
  });
  let nearbyIndex = -1;
  let active = false;
  let position = forestRegion.entrance;
  let lastSavedPosition = position;
  let facing = 1;
  let frame;
  let previousTime;
  let edge;
  let distance;
  let viewportWidth;
  let regionWidth;

  function measure() {
    edge = pet.offsetWidth / 2;
    regionWidth = world.offsetWidth;
    viewportWidth = viewport.clientWidth;
    distance = Math.max(1, regionWidth - edge * 2);
    forestSpots.forEach((spot, index) => {
      markers[index].style.left = (edge + spot.x * distance) + "px";
    });
    render();
  }

  function updateNearby(index) {
    if (nearbyIndex === index) return;
    markers[nearbyIndex]?.classList.remove("is-nearby");
    nearbyIndex = index;
    markers[index]?.classList.add("is-nearby");
    onNearby(forestSpots[index]);
  }

  function render() {
    const x = edge + position * distance;
    const camera = Math.max(0, Math.min(regionWidth - viewportWidth, x - viewportWidth * 0.46));
    world.style.transform = `translate3d(${-camera}px, 0, 0)`;
    pet.style.transform = `translate3d(${x - edge}px, 0, 0)`;
    pet.style.setProperty("--facing", facing);
    updateNearby(forestSpots.findIndex((spot) => Math.abs(spot.x - position) <= 0.047));
  }

  function savePosition() {
    if (lastSavedPosition === position) return;
    lastSavedPosition = position;
    onStop(position);
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = undefined;
    previousTime = undefined;
    pet.classList.remove("is-walking");
  }

  function advance(time) {
    const seconds = Math.min(0.05, (time - (previousTime ?? time)) / 1000);
    const next = Math.max(0, Math.min(1, position + facing * 190 * seconds / distance));
    pet.classList.toggle("is-walking", next !== position);
    position = next;
    previousTime = time;
    render();
    frame = requestAnimationFrame(advance);
  }

  function press(source, direction) {
    if (!active || inputs.has(source)) return;
    inputs.set(source, direction);
    facing = direction;
    // A short tap also takes a step, even if it ends before the first frame.
    position = Math.max(0, Math.min(1, position + direction * 18 / distance));
    render();
    if (frame === undefined) frame = requestAnimationFrame(advance);
  }

  function release(source) {
    if (!inputs.delete(source)) return;
    if (inputs.size) {
      for (const direction of inputs.values()) facing = direction;
      return;
    }
    stop();
    savePosition();
  }

  root.querySelectorAll("[data-move]").forEach((button) => {
    const direction = Number(button.dataset.move);
    button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      button.setPointerCapture(event.pointerId);
      press(event.pointerId, direction);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      button.addEventListener(type, (event) => release(event.pointerId));
    }
    // Keyboard activation and assistive technology can dispatch a click alone.
    button.addEventListener("click", (event) => {
      if (event.detail !== 0) return;
      press(button, direction);
      release(button);
    });
    button.addEventListener("contextmenu", (event) => event.preventDefault());
  });

  const keyboardDirections = { ArrowLeft: -1, ArrowRight: 1 };
  window.addEventListener("keydown", (event) => {
    const direction = keyboardDirections[event.key];
    if (!active || !direction || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    press(event.key, direction);
  });
  window.addEventListener("keyup", (event) => release(event.key));

  function pause() {
    inputs.clear();
    stop();
    if (active) savePosition();
  }

  window.addEventListener("blur", pause);
  window.addEventListener("pagehide", pause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
  });
  function resize() {
    if (active) measure();
  }
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(viewport);
  else window.addEventListener("resize", resize);

  return {
    show(savedPosition) {
      inputs.clear();
      stop();
      active = true;
      position = lastSavedPosition = savedPosition;
      facing = 1;
      measure();
    },
    hide() {
      inputs.clear();
      stop();
      active = false;
      updateNearby(-1);
    },
    getPosition() { return position; },
  };
}
