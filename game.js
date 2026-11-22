"use strict";

const saveKey = "little-chinchilla:v1";
const pet = document.querySelector("#pet");
const feedingDuration = 3000;
pet.style.setProperty("--feeding-duration", feedingDuration + "ms");
const ball = document.querySelector(".toy-ball");
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
    xp: 0, name: "Shy（害羞）",
    activities: [
      ["idle", "nest", "躲在小窝旁偷偷张望"],
      ["sleep", "nest", "缩在小窝里打盹"],
      ["idle", "floor", "竖起耳朵听动静"],
    ],
  },
  {
    xp: 5, name: "Curious（好奇）",
    activities: [
      ["jump", "ledge", "跳上木台看看"],
      ["groom", "ledge", "在木台上梳理毛发"],
      ["idle", "floor", "沿着地板嗅来嗅去"],
    ],
  },
  {
    xp: 10, name: "Friendly（亲近）",
    activities: [
      ["idle", "near", "主动凑过来看看你"],
      ["pet", "near", "在你身边舒服地伸懒腰"],
      ["sleep", "nest", "回窝安心打个盹"],
      ["jump", "ledge", "轻快地跳上木台"],
    ],
  },
];
const requiredLevel = { toy: 2, come: 3 };
const initialMessage = message.textContent;
let trust = 0;
let xp = 0;
try {
  const saved = JSON.parse(localStorage.getItem(saveKey));
  if (Number.isSafeInteger(saved?.xp) && saved.xp >= 0) xp = saved.xp;
  if (Number.isInteger(saved?.trust)) trust = Math.max(0, Math.min(100, saved.trust));
} catch {
  warning.hidden = false;
}

function currentLevel() {
  if (xp >= stages[2].xp) return 3;
  return xp >= stages[1].xp ? 2 : 1;
}

function saveProgress() {
  const level = currentLevel();
  try {
    localStorage.setItem(saveKey, JSON.stringify({
      trust,
      xp,
      level,
      unlocked: { feed: true, toy: level >= 2, come: level >= 3 },
    }));
    warning.hidden = true;
  } catch {
    warning.hidden = false;
  }
}

function showProgress() {
  const level = currentLevel();
  const stage = stages[level - 1];
  const next = stages[level];
  levelLabel.textContent = "Level " + level + " · " + stage.name;
  xpLabel.textContent = next ? xp + " / " + next.xp + " XP" : xp + " XP · 最高等级";
  progress.max = next ? next.xp - stage.xp : 1;
  progress.value = next ? xp - stage.xp : 1;
  updateButtons();


  meter.value = trust;
  score.textContent = trust + " / 100";
  bond.textContent = trust >= 60 ? "愿意主动靠近" : trust >= 20 ? "渐渐放松了" : "还在熟悉你";
}

function showActivity(action, place, label) {
  pet.dataset.action = action;
  pet.dataset.place = place;
  activity.textContent = label;
  ball.hidden = action !== "toy";
  bathProps.forEach((prop) => { prop.hidden = action !== "bath"; });
}

let timer;
let cooldown;
let busy = false;
let lastActivity;

function updateButtons() {
  buttons.forEach((button) => {
    const locked = currentLevel() < (requiredLevel[button.dataset.care] ?? 1);
    button.disabled = locked || busy;
    const lock = button.querySelector(".lock");
    if (lock) lock.hidden = !locked;
  });
}

function scheduleActivity(delay) {
  clearTimeout(timer);
  timer = setTimeout(autonomousActivity, delay);
}

function pick(options) {
  return options[Math.floor(Math.random() * options.length)];
}

function autonomousActivity() {
  if (document.hidden) return;
  const options = stages[currentLevel() - 1].activities;
  lastActivity = pick(options.filter((option) => option !== lastActivity));
  showActivity(...lastActivity);
  scheduleActivity(pet.dataset.action === "sleep" ? 8500 : 5500);
}

const care = {
  feed: { action: ["feed", "hay", "吃提摩西草"], gain: 8, xp: 1, text: "小银捧起提摩西草，慢慢嚼了起来。" },
  pet: { action: ["pet", "near", "接受轻抚"], gain: 10, text: "小银放松下来，轻轻向你的手靠近。" },
  toy: { action: ["toy", "floor", "研究小球"], gain: 0, xp: 1, text: "小银用鼻尖轻轻推了一下小球。" },
  come: { action: ["pet", "near", "主动靠近"], gain: 0, text: [
    "小银小跑过来，停在你身边。",
    "小银凑近嗅了嗅，在你旁边坐了下来。",
    "小银来到你跟前，放松地伸了个懒腰。",
  ] },
  bath: { action: ["bath", "sand", "正在沙浴"], gain: 6, text: "小银跳进浴盆，在细细的浴粉里打了个滚。" },
};

function applyCare(kind) {
  const previousLevel = currentLevel();
  if (busy || previousLevel < (requiredLevel[kind] ?? 1)) return;

  const interaction = care[kind];
  if (kind !== "pet" || trust >= 20) {
    trust = Math.min(100, trust + interaction.gain);
    xp = Math.min(Number.MAX_SAFE_INTEGER, xp + (interaction.xp ?? 0));
    saveProgress();
    showActivity(...interaction.action);
    const feedback = Array.isArray(interaction.text) ? pick(interaction.text) : interaction.text;
    const level = currentLevel();
    message.textContent = level > previousLevel
      ? "Level Up! 升到 Level " + level + "，解锁 " + (level === 2 ? "Toy 小球" : "Come Here 靠近") + "。 " + feedback
      : feedback;
  } else {
    showActivity("idle", "nest", "退到小窝旁");
    message.textContent = "小银往后退了一点。等信任度达到 20，再试试轻轻抚摸。";
  }

  busy = true;
  showProgress();
  clearTimeout(timer);
  cooldown = setTimeout(() => {
    busy = false;
    updateButtons();
    showActivity("idle", pet.dataset.place, "休息一下");
    scheduleActivity(1800);
  }, kind === "feed" ? feedingDuration : 2400);
}

reset.addEventListener("click", () => {
  if (!window.confirm("确定重置进度吗？经验和信任度都会归零。")) return;
  clearTimeout(cooldown);
  busy = false;
  lastActivity = undefined;
  xp = 0;
  trust = 0;
  saveProgress();
  showProgress();
  showActivity("idle", "floor", "观察四周");
  message.textContent = initialMessage;
  scheduleActivity(4500);
});

buttons.forEach((button) => {
  button.addEventListener("click", () => applyCare(button.dataset.care));
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearTimeout(timer);
  else if (!busy) scheduleActivity(4200);
});
showProgress();
scheduleActivity(4500);
