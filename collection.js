"use strict";

const forestItems = {
  pinecone: { name: "松果", rarity: "普通" },
  mushroom: { name: "小蘑菇", rarity: "普通" },
  leaf: { name: "红叶", rarity: "普通" },
  amberCone: { name: "琥珀松果", rarity: "稀有" },
  silverCap: { name: "银边蘑菇", rarity: "稀有" },
  goldenLeaf: { name: "金叶", rarity: "稀有" },
};

const forestSpots = [
  { id: "trail-pine", x: 0.14, type: "pine", name: "松果旁", common: "pinecone", rare: "amberCone" },
  { id: "fern-mushroom", x: 0.35, type: "mushroom", name: "蕨叶下的蘑菇", common: "mushroom", rare: "silverCap" },
  { id: "leaf-pile", x: 0.52, type: "leaves", name: "落叶堆", common: "leaf", rare: "goldenLeaf" },
  { id: "moss-pine", x: 0.70, type: "pine", name: "苔藓旁的松果", common: "pinecone", rare: "amberCone" },
  { id: "far-leaves", x: 0.88, type: "leaves", name: "小径尽头的落叶堆", common: "leaf", rare: "goldenLeaf" },
];

const searchRest = 180000;
const ornamentCost = 2;

function readCollection(saved) {
  const inventory = {};
  for (const id of Object.keys(forestItems)) {
    const count = saved?.inventory?.[id];
    if (Number.isSafeInteger(count) && count > 0) inventory[id] = count;
  }
  const known = Array.isArray(saved?.discovered) ? saved.discovered : [];
  const discovered = [...new Set([...known.filter((id) => typeof id === "string" && Object.prototype.hasOwnProperty.call(forestItems, id)), ...Object.keys(inventory)])];
  const searchedAt = {};
  const lastSearchFound = {};
  for (const spot of forestSpots) {
    const time = saved?.searchedAt?.[spot.id];
    if (Number.isSafeInteger(time) && time > 0) {
      searchedAt[spot.id] = time;
      if (saved?.lastSearchFound?.[spot.id] === true) lastSearchFound[spot.id] = true;
    }
  }
  return {
    inventory,
    discovered,
    searchedAt,
    lastSearchFound,
    ornamentOwned: saved?.ornamentOwned === true,
    ornamentPlaced: saved?.ornamentOwned === true && saved?.ornamentPlaced === true,
  };
}

function canSearch(collection, spot, now) {
  return now >= (collection.searchedAt[spot.id] ?? -searchRest) + searchRest;
}

function searchSpot(collection, spot, now, roll = Math.random()) {
  if (!canSearch(collection, spot, now)) return null;
  collection.searchedAt[spot.id] = now;
  const itemId = roll < 0.10 ? spot.rare : roll < 0.85 ? spot.common : null;
  collection.lastSearchFound[spot.id] = itemId !== null;
  if (itemId) {
    collection.inventory[itemId] = Math.min(Number.MAX_SAFE_INTEGER, (collection.inventory[itemId] ?? 0) + 1);
    if (!collection.discovered.includes(itemId)) collection.discovered.push(itemId);
  }
  return { itemId };
}

function createCollectionView(onChange, onDepletionChange) {
  const search = document.querySelector("#explore-spot");
  const hint = document.querySelector("#explore-hint");
  const result = document.querySelector("#explore-result");
  const bag = document.querySelector("#bag-items");
  const guide = document.querySelector("#guide-items");
  const count = document.querySelector("#guide-count");
  const ornament = document.querySelector("#cabin-ornament");
  const decorate = document.querySelector("#decorate-cabin");
  const decorationStatus = document.querySelector("#decoration-status");
  let collection;
  let nearby;
  let refreshTimer;

  function showSearch() {
    clearTimeout(refreshTimer);
    const now = Date.now();
    const depleted = forestSpots.filter((spot) => collection.lastSearchFound[spot.id] && !canSearch(collection, spot, now));
    onDepletionChange(new Set(depleted.map((spot) => spot.id)));

    search.disabled = !nearby || !canSearch(collection, nearby, now);
    if (!nearby) {
      hint.textContent = "沿小径靠近有名称的标记，再点「探索」。";
    } else {
      hint.textContent = search.disabled ? nearby.name + " · 刚找过，过一会儿再来。" : nearby.name + " · 可以探索";
    }

    const cooling = nearby && search.disabled ? [...depleted, nearby] : depleted;
    if (cooling.length) {
      const next = Math.min(...cooling.map((spot) => collection.searchedAt[spot.id] + searchRest - now));
      refreshTimer = setTimeout(showSearch, Math.min(next, searchRest));
    }
  }

  function showCollections(next) {
    collection = next;
    bag.replaceChildren();
    guide.replaceChildren();
    for (const [id, item] of Object.entries(forestItems)) {
      const quantity = collection.inventory[id] ?? 0;
      if (quantity) {
        const entry = document.createElement("li");
        entry.textContent = item.name + " × " + quantity;
        bag.append(entry);
      }
      const entry = document.createElement("li");
      const known = collection.discovered.includes(id);
      entry.textContent = known ? item.name + " · " + item.rarity : "未发现";
      guide.append(entry);
    }
    if (!bag.childElementCount) {
      const entry = document.createElement("li");
      entry.textContent = "背包里还没有森林物品。";
      bag.append(entry);
    }
    count.textContent = collection.discovered.length + " / " + Object.keys(forestItems).length;
    ornament.hidden = !collection.ornamentPlaced;
    decorate.disabled = !collection.ornamentOwned && (collection.inventory.pinecone ?? 0) < ornamentCost;
    decorate.textContent = collection.ornamentOwned
      ? (collection.ornamentPlaced ? "收起松果摆件" : "摆放松果摆件")
      : "制作松果摆件 · 2 松果";
    showSearch();
  }

  search.addEventListener("click", () => {
    if (!nearby) return;
    const found = searchSpot(collection, nearby, Date.now());
    if (!found) return;
    const item = forestItems[found.itemId];
    result.textContent = item ? "找到了" + (item.rarity === "稀有" ? "稀有物品「" : "「") + item.name + "」！"
      : "棉花糖翻了翻，这次没有找到东西。";
    onChange();
    showCollections(collection);
  });

  decorate.addEventListener("click", () => {
    if (!collection.ornamentOwned) {
      if ((collection.inventory.pinecone ?? 0) < ornamentCost) return;
      collection.inventory.pinecone -= ornamentCost;
      collection.ornamentOwned = true;
      collection.ornamentPlaced = true;
      decorationStatus.textContent = "制作完成，松果摆件已放进小屋。";
    } else {
      collection.ornamentPlaced = !collection.ornamentPlaced;
      decorationStatus.textContent = collection.ornamentPlaced ? "已摆放松果摆件。" : "已收起松果摆件。";
    }
    onChange();
    showCollections(collection);
  });

  return {
    showCollections,
    setNearby(spot) {
      nearby = spot;
      showSearch();
    },
    clearResult() {
      result.textContent = "";
      decorationStatus.textContent = "";
    },
  };
}
