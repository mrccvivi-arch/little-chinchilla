"use strict";

const saveKey = "little-chinchilla:v1";
const saveVersion = 2;
const levelThresholds = [0, 100, 230, 400, 620, 900, 1250, 1680, 2200, 2820];
const pet = document.querySelector("#pet");
const feeding = pet.querySelector(".pet-art");
const [leftPaw, rightPaw] = feeding.querySelectorAll(".feeding-paw");
const feedingGrass = feeding.querySelector(".feeding-grass");
const feedingMuzzle = feeding.querySelector(".feeding-muzzle");
const petPose = feeding.querySelector(".pet-pose");
const toyBall = feeding.querySelector(".toy-ball");
const toyBallSpin = toyBall.querySelector(".toy-ball-spin");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const feedingDuration = 3000;
const actionDurations = {
  feed: feedingDuration,
  playingBall: 3600,
  stroke: 2700,
  stretch: 1500,
  tilt: 1800,
  celebrate: 1100,
};
for (const [action, duration] of Object.entries(actionDurations)) {
  pet.style.setProperty(`--${action}-duration`, duration + "ms");
}
const levelLabel = document.querySelector("#level");
const xpLabel = document.querySelector("#xp-label");
const progress = document.querySelector("#xp-progress");
const reset = document.querySelector("#reset");
const bathProps = document.querySelectorAll(".bath, .bath-rim, .dust");
const activity = document.querySelector("#activity");
const meter = document.querySelector("#trust");
const score = document.querySelector("#score");
const bond = document.querySelector("#bond");
const message = document.querySelector("#message");
const warning = document.querySelector("#save-warning");
const buttons = [...document.querySelectorAll("[data-care]")];

const stages = [
  {
    name: "Shy（害羞）",
    activities: [
      ["idle", "nest", "躲在小窝旁偷偷张望"],
      ["sleep", "nest", "缩在小窝里打盹"],
      ["idle", "floor", "竖起耳朵听动静"],
    ],
  },
  {
    name: "Curious（好奇）",
    activities: [
      ["jump", "ledge", "跳上木台看看"],
      ["groom", "ledge", "在木台上梳理毛发"],
      ["idle", "floor", "沿着地板嗅来嗅去"],
    ],
  },
  {
    name: "Friendly（亲近）",
    activities: [
      ["idle", "near", "主动凑过来看看你"],
      ["stretch", "near", "在你身边舒服地伸懒腰"],
      ["sleep", "nest", "回窝安心打个盹"],
      ["jump", "ledge", "轻快地跳上木台"],
    ],
  },
];
const requiredLevel = { toy: 2, come: 3 };
const initialMessage = message.textContent;
let xp = 0;
let trust = 0;
let lastDailyDay = "";
let lastAward = {};

function levelForXp(total) {
  for (let index = levelThresholds.length - 1; index >= 0; index--) {
    if (total < levelThresholds[index]) continue;
    if (index < levelThresholds.length - 1) return index + 1;
    // After Level 10, each successive level costs 120 XP more.
    const levels = Math.floor((Math.sqrt(680 ** 2 + 240 * (total - 2820)) - 680) / 120);
    const level = 10 + levels;
    return total >= thresholdForLevel(level + 1) ? level + 1 : level;
  }
  return 1;
}

function thresholdForLevel(level) {
  if (level <= 10) return levelThresholds[level - 1];
  const extra = level - 10;
  return 2820 + 680 * extra + 60 * extra ** 2;
}

function migrateXp(saved) {
  const oldXp = Number.isSafeInteger(saved.xp) && saved.xp >= 0 ? saved.xp : 0;
  if (saved.version === saveVersion) return oldXp;
  // Keep the old level and XP earned within that level, including its unlocks.
  if (oldXp >= 10) return Math.min(Number.MAX_SAFE_INTEGER, 230 + oldXp - 10);
  if (oldXp >= 5) return 100 + oldXp - 5;
  return oldXp;
}

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(saveKey));
    if (!saved || typeof saved !== "object") return;
    xp = migrateXp(saved);
    trust = Number.isInteger(saved.trust) ? Math.max(0, Math.min(100, saved.trust)) : 0;
    lastDailyDay = /^\d{4}-\d{2}-\d{2}$/.test(saved.lastDailyDay) ? saved.lastDailyDay : "";
    lastAward = { ...saved.lastAward };
    return saved.version !== saveVersion;
  } catch {
    warning.hidden = false;
  }
}

function saveProgress() {
  const level = levelForXp(xp);
  try {
    localStorage.setItem(saveKey, JSON.stringify({
      version: saveVersion,
      trust,
      xp,
      level,
      unlocked: { feed: true, toy: level >= 2, come: level >= 3 },
      lastDailyDay,
      lastAward,
    }));
    warning.hidden = true;
  } catch {
    warning.hidden = false;
  }
}

function showProgress() {
  const level = levelForXp(xp);
  const stage = stages[Math.min(level, stages.length) - 1];
  const base = thresholdForLevel(level);
  const next = thresholdForLevel(level + 1);
  levelLabel.textContent = "Level " + level + " · " + stage.name;
  xpLabel.textContent = xp + " / " + next + " XP";
  progress.setAttribute("aria-valuemax", next - base);
  progress.setAttribute("aria-valuenow", xp - base);
  progress.setAttribute("aria-valuetext", xpLabel.textContent);
  progress.style.setProperty("--xp-ratio", (xp - base) / (next - base));

  meter.value = trust;
  score.textContent = trust + " / 100";
  bond.textContent = trust >= 60 ? "愿意主动靠近" : trust >= 20 ? "渐渐放松了" : "还在熟悉你";
  updateButtons();
}

function showActivity(action, place, label) {
  pet.dataset.action = action;
  pet.dataset.place = place;
  activity.textContent = label;
  cancelAnimationFrame(spriteFrame);
  petPose.removeAttribute("transform");
  if (action === "feed") playFeeding();
  if (action === "playingBall") playBall();
  bathProps.forEach((prop) => { prop.hidden = action !== "bath"; });
}

let spriteFrame;

function animateSprite(duration, draw, staticProgress) {
  if (reducedMotion.matches) {
    draw(staticProgress);
    return;
  }

  const start = performance.now();
  function frame(now) {
    const progress = Math.max(0, Math.min(1, (now - start) / duration));
    draw(progress);
    if (progress < 1) spriteFrame = requestAnimationFrame(frame);
  }
  draw(0);
  spriteFrame = requestAnimationFrame(frame);
}

function smooth(value) {
  return value * value * (3 - 2 * value);
}

function playFeeding() {
  function draw(progress) {
    // The translations and scales are in the original sprite's 720 × 480 grid.
    const lift = Math.max(0, Math.min(1, progress / 0.14, (0.94 - progress) / 0.18));
    const easedLift = smooth(lift);
    const remainingGrass = Math.max(0.10, 0.82 - Math.max(0, progress - 0.18) * 1.25);
    const chew = 0.67 + 0.33 * Math.sin(progress * 15 * Math.PI) ** 2;
    leftPaw.setAttribute("transform", `translate(${-49 * easedLift} ${-70 * easedLift})`);
    rightPaw.setAttribute("transform", `translate(${-67 * easedLift} ${-72 * easedLift})`);
    feedingGrass.setAttribute("transform", `scale(${remainingGrass})`);
    feedingMuzzle.setAttribute("transform", `scale(1 ${chew})`);
  }

  animateSprite(feedingDuration, draw, 0.15);
}

// Each pose uses the same 720 × 480 sprite coordinates, with time in milliseconds.
// Hold the ball at its starting position until each paw-contact pose is reached.
const ballPoses = [
  // time, body X, lean, paw X, paw Y, ball X
  [0, 0, 0, 0, 0, 94],
  [450, 0, -8, 0, 0, 94],
  [1000, -8, -10, -41, 40, 94],
  [1160, -18, -12, -46, 42, 76],
  [1570, -56, -4, 0, 0, 46],
  [1820, -75, -7, -25, -4, 46],
  [2190, -83, -11, -44, 32, 46],
  [2350, -67, -8, -14, 40, 67],
  [2830, -22, -4, 0, 0, 128],
  [3300, 0, 0, 0, 0, 128],
  [3600, 0, 0, 0, 0, 128],
];

function playBall() {
  rightPaw.removeAttribute("transform");
  animateSprite(actionDurations.playingBall, (progress) => {
    const elapsed = progress * actionDurations.playingBall;
    const endIndex = Math.max(1, ballPoses.findIndex(([time]) => time >= elapsed));
    const from = ballPoses[endIndex - 1];
    const to = ballPoses[endIndex];
    const fraction = smooth((elapsed - from[0]) / (to[0] - from[0]));
    const [bodyX, lean, pawX, pawY, ballX] = from.slice(1).map((start, index) => {
      return start + (to[index + 1] - start) * fraction;
    });
    petPose.setAttribute("transform", `translate(${bodyX} 0) rotate(${lean} 230 455)`);
    leftPaw.setAttribute("transform", `translate(${pawX} ${pawY})`);
    toyBall.setAttribute("transform", `translate(${ballX} 410)`);
    toyBallSpin.setAttribute("transform", `rotate(${(ballX - 94) * 180 / (34 * Math.PI)})`);
  }, 1000 / actionDurations.playingBall);
}

let activityTimer;
let busy = false;
let lastActivity;
let lastInteraction = Date.now();

function updateButtons() {
  const level = levelForXp(xp);
  buttons.forEach((button) => {
    const locked = level < (requiredLevel[button.dataset.care] ?? 1);
    button.disabled = locked || busy;
    const lock = button.querySelector(".lock");
    if (lock) lock.hidden = !locked;
  });
}

function schedule(callback, delay) {
  clearTimeout(activityTimer);
  activityTimer = setTimeout(callback, delay);
}

function pick(options) {
  return options[Math.floor(Math.random() * options.length)];
}

function autonomousActivity() {
  if (document.hidden || busy) return;
  const roll = Math.random();
  if (Date.now() - lastInteraction >= 25000 && roll < 0.24) {
    showActivity("tilt", "floor", "歪着头看看你");
    schedule(finishActivity, actionDurations.tilt);
    return;
  }
  if (roll > 0.82) {
    showActivity("stretch", "floor", "舒舒服服伸个懒腰");
    schedule(finishActivity, actionDurations.stretch);
    return;
  }
  const stage = stages[Math.min(levelForXp(xp), stages.length) - 1];
  lastActivity = pick(stage.activities.filter((option) => option !== lastActivity));
  showActivity(...lastActivity);
  if (lastActivity[0] === "stretch") schedule(finishActivity, actionDurations.stretch);
  else schedule(autonomousActivity, lastActivity[0] === "sleep" ? 8500 : 5500);
}

function finishActivity() {
  busy = false;
  updateButtons();
  showActivity("idle", pet.dataset.place, "休息一下");
  schedule(autonomousActivity, 1800);
}

const care = {
  feed: { action: ["feed", "floor", "吃提摩西草"], gain: 8, xp: 5, xpCooldown: 30000, text: "棉花糖捧起提摩西草，慢慢嚼了起来。" },
  pet: { action: ["stroke", "near", "闭上眼享受轻抚"], gain: 10, xp: 3, xpCooldown: 20000, text: "棉花糖眯起眼睛，耳朵轻轻抖了抖。" },
  toy: { action: ["playingBall", "floor", "用前爪推着小球玩"], xp: 1, xpCooldown: 30000, text: "棉花糖伸出前爪，把小球推来推去。" },
  come: { action: ["pet", "near", "主动靠近"], text: [
    "棉花糖小跑过来，停在你身边。",
    "棉花糖凑近嗅了嗅，在你旁边坐了下来。",
    "棉花糖来到你跟前，放松地伸了个懒腰。",
  ] },
  bath: { action: ["bath", "sand", "正在沙浴"], gain: 6, xp: 8, xpCooldown: 60000, text: "棉花糖跳进浴盆，在细细的浴粉里打了个滚。" },
};

function localDay(now) {
  const date = new Date(now);
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, "0")).join("-");
}

function awardXp(kind, now) {
  const interaction = care[kind];
  const lastTime = lastAward[kind];
  const coolingDown = Number.isFinite(lastTime) && now - lastTime < interaction.xpCooldown;
  let earned = 0;
  if (interaction.xp && !coolingDown) {
    lastAward[kind] = now;
    earned = interaction.xp;
  }
  const today = localDay(now);
  const dailyBonus = today > lastDailyDay;
  if (dailyBonus) {
    lastDailyDay = today;
    earned += 15;
  }
  xp = Math.min(Number.MAX_SAFE_INTEGER, xp + earned);
  if (dailyBonus) return " 今日首次互动 +15 XP。";
  if (coolingDown) return " 经验冷却中。";
  return "";
}

function applyCare(kind) {
  if (busy) return;
  const previousLevel = levelForXp(xp);
  if (previousLevel < (requiredLevel[kind] ?? 1)) return;

  busy = true;
  lastInteraction = Date.now();
  const interaction = care[kind];
  if (kind === "pet" && trust < 20) {
    showActivity("idle", "nest", "退到小窝旁");
    message.textContent = "棉花糖往后退了一点。等信任度达到 20，再试试轻轻抚摸。";
    showProgress();
    schedule(finishActivity, 2400);
    return;
  }

  trust = Math.min(100, trust + (interaction.gain ?? 0));
  const bonusMessage = awardXp(kind, lastInteraction);
  saveProgress();
  showActivity(...interaction.action);

  const level = levelForXp(xp);
  const feedback = Array.isArray(interaction.text) ? pick(interaction.text) : interaction.text;
  const unlocked = [
    previousLevel < 2 && level >= 2 ? "Toy 小球" : "",
    previousLevel < 3 && level >= 3 ? "Come Here 靠近" : "",
  ].filter(Boolean);
  const levelMessage = level > previousLevel
    ? "Level Up! 升到 Level " + level + (unlocked.length ? "，解锁 " + unlocked.join("、") : "") + "。 "
    : "";
  message.textContent = levelMessage + feedback + bonusMessage;
  showProgress();

  schedule(() => {
    if (level <= previousLevel) {
      finishActivity();
      return;
    }
    showActivity("celebrate", "floor", "开心地蹦起来！");
    schedule(finishActivity, actionDurations.celebrate);
  }, actionDurations[interaction.action[0]] ?? 2400);
}

reset.addEventListener("click", () => {
  if (!window.confirm("确定重置进度吗？经验和信任度都会归零。")) return;
  busy = false;
  lastActivity = undefined;
  lastInteraction = Date.now();
  xp = 0;
  trust = 0;
  saveProgress();
  showProgress();
  showActivity("idle", "floor", "观察四周");
  message.textContent = initialMessage;
  schedule(autonomousActivity, 4500);
});

buttons.forEach((button) => {
  button.addEventListener("click", () => applyCare(button.dataset.care));
});
window.addEventListener("storage", (event) => {
  if (event.key !== saveKey || event.storageArea !== localStorage || !event.newValue) return;
  loadProgress();
  showProgress();
});
document.addEventListener("visibilitychange", () => {
  if (busy) return;
  if (document.hidden) clearTimeout(activityTimer);
  else schedule(autonomousActivity, 4200);
});
if (loadProgress()) saveProgress();
showProgress();
schedule(autonomousActivity, 4500);
