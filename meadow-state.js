"use strict";

const meadowBounds = { x: 21, z: 18 };
const meadowSpawn = { x: 0, z: 9, yaw: -0.42 };
const meadowGateAt = 0.93;

function readMeadow(saved) {
  const place = saved?.player;
  return {
    player: {
      x: Number.isFinite(place?.x) ? Math.max(-meadowBounds.x, Math.min(meadowBounds.x, place.x)) : meadowSpawn.x,
      z: Number.isFinite(place?.z) ? Math.max(-meadowBounds.z, Math.min(meadowBounds.z, place.z)) : meadowSpawn.z,
      yaw: Number.isFinite(place?.yaw) ? place.yaw % (Math.PI * 2) : meadowSpawn.yaw,
    },
    // Each future placement has a stable ID, a recipe type, a 3D position and a Y rotation in radians.
    placements: Array.isArray(saved?.placements) ? saved.placements.filter((entry) =>
      typeof entry?.id === "string" && typeof entry.type === "string" &&
      [entry.position?.x, entry.position?.y, entry.position?.z, entry.rotation].every(Number.isFinite)
    ) : [],
  };
}
