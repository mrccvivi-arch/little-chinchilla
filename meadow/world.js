import * as THREE from "./vendor/three.module.min.js";

const trees = [
  [-8, 7, 1.25], [7, 10, 1], [-12, 12, 1.6], [13, 6, 1.4], [-4, 0, 1],
  [-14, -4, 1.4], [-4, -9, 1.65], [1, -13, 1.2], [14, -10, 1.5], [17, -14, 1.55],
  [-16, -13, 1.7], [18, 11, 1.4], [-18, 3, 1.25],
];

export const landmarks = [
  { x: 0, z: 15, range: 2.8, label: "返回森林", portal: true },
  { x: 3, z: 7, range: 2.8, label: "查看野花", text: "花瓣随风轻轻晃动。棉花糖停下来闻了闻。" },
  { x: -7, z: 2, range: 2.7, label: "查看蘑菇", text: "几朵蘑菇挤在一起，像一排小伞。" },
  { x: 8, z: -3, range: 4, label: "查看建造区", text: "这块平坦的草地留给以后建造，目前可以在这里散步。" },
];

const terrain = { width: 54, depth: 48, columns: 32, rows: 28 };

function hillHeight(x, z) {
  const hill = (cx, cz, radius, height) => {
    const amount = Math.max(0, 1 - Math.hypot(x - cx, z - cz) / radius);
    return height * amount ** 2 * (3 - 2 * amount);
  };
  return hill(-13, -10, 12, 3.1) + hill(17, -12, 8, 1.9) + hill(-15, 11, 8, 1.35);
}

export function groundHeight(x, z) {
  // Match the two triangles in each terrain cell so feet follow the rendered surface.
  const stepX = terrain.width / terrain.columns;
  const stepZ = terrain.depth / terrain.rows;
  const cellX = (x + terrain.width / 2) / stepX;
  const cellZ = (z + terrain.depth / 2) / stepZ;
  const ix = Math.floor(cellX);
  const iz = Math.floor(cellZ);
  const u = cellX - ix;
  const v = cellZ - iz;
  const left = ix * stepX - terrain.width / 2;
  const top = iz * stepZ - terrain.depth / 2;
  const upperRight = hillHeight(left + stepX, top);
  const lowerLeft = hillHeight(left, top + stepZ);
  if (u + v <= 1) return hillHeight(left, top) * (1 - u - v) + upperRight * u + lowerLeft * v;
  return hillHeight(left + stepX, top + stepZ) * (u + v - 1) + upperRight * (1 - v) + lowerLeft * (1 - u);
}

export function canStand(x, z, bounds) {
  return Math.abs(x) <= bounds.x && Math.abs(z) <= bounds.z &&
    trees.every(([tx, tz, size]) => (tx - x) ** 2 + (tz - z) ** 2 >= (size * .34 + .49) ** 2);
}

export function createWorld() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc8e9ed);
  scene.fog = new THREE.Fog(0xc8e9ed, 34, 66);
  scene.add(new THREE.HemisphereLight(0xfff6d9, 0x99b69c, 2.2));
  const sunlight = new THREE.DirectionalLight(0xffeac4, 2);
  sunlight.position.set(-9, 18, 8);
  scene.add(sunlight);

  const material = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });
  const grass = new THREE.PlaneGeometry(terrain.width, terrain.depth, terrain.columns, terrain.rows).rotateX(-Math.PI / 2);
  const positions = grass.attributes.position;
  const colors = [];
  const tint = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    positions.setY(i, hillHeight(positions.getX(i), positions.getZ(i)));
    tint.setHSL(.25 + .026 * Math.sin(i * 4.93), .29 + .085 * Math.sin(i * 7.1), .52 + .047 * Math.sin(i * 9.29));
    colors.push(tint.r, tint.g, tint.b);
  }
  grass.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  grass.computeVertexNormals();
  scene.add(new THREE.Mesh(grass, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));

  const trunk = material(0x896044);
  const canopy = [material(0x497d63), material(0x579372), material(0x7baf72)];
  const stone = material(0xa5a6a0);
  const snow = material(0xe0dfd5);
  const fur = material(0xc8bfb5);
  const innerEar = material(0xe7aaa7);
  const eye = material(0x3f3037);
  const cream = material(0xfff0b7);
  const pink = material(0xf39f93);
  const mushroom = material(0xbf625a);
  const grassStem = material(0x598556);
  const wood = material(0xab8058);
  const patch = material(0xcfca86);
  const path = material(0xd9c999);

  const sphere = new THREE.SphereGeometry(1, 10, 7);
  const cylinder = new THREE.CylinderGeometry(.85, 1, 1, 7);
  const cone = new THREE.ConeGeometry(1, 1, 7);
  const rock = new THREE.DodecahedronGeometry(1);
  const box = new THREE.BoxGeometry(1, 1, 1);

  function mesh(parent, geo, surface, x, y, z, sx, sy, sz) {
    const object = new THREE.Mesh(geo, surface);
    object.position.set(x, y, z);
    object.scale.set(sx, sy, sz);
    parent.add(object);
    return object;
  }

  for (const [x, z, size] of trees) {
    const y = groundHeight(x, z);
    mesh(scene, cylinder, trunk, x, y + size * .85, z, .25 * size, size * 1.8, .25 * size);
    for (let tier = 0; tier < 3; tier++) {
      const radius = size * (1.65 - tier * .34);
      const leaves = mesh(scene, cone, canopy[tier], x, y + size * (1.95 + tier * .76), z, radius, size * 1.85, radius);
      leaves.rotation.y = tier * .29 + x;
    }
  }

  for (const [x, z, size] of [[-2, 6, .55], [12, 1, .75], [-10, -6, .75], [4, -10, .53], [16, 8, .8]]) {
    mesh(scene, rock, stone, x, groundHeight(x, z) + size * .26, z, size, size * .52, size * .77).rotation.y = x;
  }
  for (const [x, z] of [[3, 7], [-3, 11], [6, 0], [13, 9], [-11, -3], [0, -12]]) {
    for (let i = 0; i < 5; i++) {
      const fx = x + Math.sin(i * 2.4) * .67;
      const fz = z + Math.cos(i * 2.4) * .6;
      const y = groundHeight(fx, fz);
      mesh(scene, cylinder, grassStem, fx, y + .16, fz, .027, .35, .027);
      mesh(scene, rock, i % 2 ? cream : pink, fx, y + .36, fz, .13, .08, .13);
    }
  }
  for (const [x, z, size] of [[-7, 2, 1], [-6.55, 2.1, .68], [-7.3, 2.45, .75], [12, -8, .75]]) {
    const y = groundHeight(x, z);
    mesh(scene, cylinder, cream, x, y + .18 * size, z, .11 * size, .36 * size, .11 * size);
    mesh(scene, sphere, mushroom, x, y + .38 * size, z, .34 * size, .19 * size, .34 * size);
  }

  // This flat clearing is reserved for the future placement grid.
  mesh(scene, box, patch, 8, .012, -3, 6.7, .024, 5.4);
  for (const [x, z] of [[4.7, -5.65], [11.3, -5.65], [4.7, -.35], [11.3, -.35]]) {
    mesh(scene, cylinder, wood, x, .17, z, .12, .34, .12);
  }
  for (const x of [-1.25, 1.25]) mesh(scene, box, wood, x, 1.21, 15, .36, 2.42, .44);
  mesh(scene, box, wood, 0, 2.45, 15, 2.95, .35, .58);
  mesh(scene, box, path, 0, .019, 14.3, 2.2, .038, 3.8);
  mesh(scene, box, cream, 0, 2.45, 14.69, .63, .15, .035);

  // Instance repeated scenery to keep draw calls low on tablets.
  const batches = new Map();
  for (const object of scene.children) {
    if (!object.isMesh) continue;
    const key = object.geometry.uuid + object.material.uuid;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(object);
  }
  for (const objects of batches.values()) {
    if (objects.length < 2) continue;
    const [first] = objects;
    const instances = new THREE.InstancedMesh(first.geometry, first.material, objects.length);
    objects.forEach((object, index) => {
      object.updateMatrix();
      instances.setMatrixAt(index, object.matrix);
      scene.remove(object);
    });
    instances.instanceMatrix.needsUpdate = true;
    scene.add(instances);
  }

  const contact = new THREE.Mesh(
    new THREE.CircleGeometry(.48, 12).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x304634, transparent: true, opacity: .24, depthWrite: false })
  );
  scene.add(contact);

  const avatar = new THREE.Group();
  mesh(avatar, sphere, fur, 0, .57, .08, .49, .59, .51);
  mesh(avatar, sphere, snow, 0, .42, -.23, .38, .39, .26);
  mesh(avatar, sphere, fur, 0, .91, -.23, .39, .37, .38);
  mesh(avatar, sphere, snow, 0, .78, -.49, .24, .19, .2);
  mesh(avatar, sphere, innerEar, 0, .86, -.656, .075, .045, .046);
  for (const side of [-1, 1]) {
    mesh(avatar, sphere, fur, side * .25, 1.29, -.11, .16, .31, .105).rotation.z = -side * .24;
    mesh(avatar, sphere, innerEar, side * .25, 1.31, -.196, .095, .22, .029).rotation.z = -side * .24;
    mesh(avatar, sphere, eye, side * .27, 1, -.48, .054, .067, .046);
    mesh(avatar, sphere, fur, side * .26, .095, -.16, .155, .091, .26);
    mesh(avatar, sphere, fur, side * .21, .35, -.4, .106, .13, .13);
  }
  mesh(avatar, sphere, fur, 0, .37, .59, .18, .16, .39).rotation.x = .52;
  mesh(avatar, sphere, fur, 0, .56, .89, .16, .14, .28).rotation.x = .9;
  scene.add(avatar);
  return { scene, avatar, contact };
}

export function disposeWorld(scene) {
  const geometries = new Set();
  const materials = new Set();
  scene.traverse((object) => {
    if (object.isMesh) {
      geometries.add(object.geometry);
      materials.add(object.material);
      if (object.isInstancedMesh) object.dispose();
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}
