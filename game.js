"use strict";

const saveKey = "little-chinchilla:v1";
const pet = document.querySelector("#pet");
const hay = document.querySelector(".hay");
const bathProps = document.querySelectorAll(".bath, .bath-rim, .dust");
const activity = document.querySelector("#activity");
const meter = document.querySelector("#trust");
const score = document.querySelector("#score");
const bond = document.querySelector("#bond");
const message = document.querySelector("#message");
const warning = document.querySelector("#save-warning");
const buttons = [...document.querySelectorAll("[data-care]")];

let trust = 0;
try {
  const saved = JSON.parse(localStorage.getItem(saveKey));
  if (Number.isInteger(saved?.trust)) trust = Math.max(0, Math.min(100, saved.trust));
} catch {
  warning.hidden = false;
}

function showTrust() {
  meter.value = trust;
  score.textContent = trust + " / 100";
  bond.textContent = trust >= 60 ? "愿意主动靠近" : trust >= 20 ? "渐渐放松了" : "还在熟悉你";
}

function showActivity(action, place, label) {
  pet.dataset.action = action;
  pet.dataset.place = place;
  activity.textContent = label;
  hay.hidden = action !== "feed";
  bathProps.forEach((prop) => { prop.hidden = action !== "bath"; });
}

let timer;
let nextActivity = 0;
function scheduleActivity(delay) {
  clearTimeout(timer);
  timer = setTimeout(autonomousActivity, delay);
}

function autonomousActivity() {
  if (document.hidden) return;
  const activities = [
    ["jump", "ledge", "跳上木台"],
    ["groom", "ledge", "梳理毛发"],
    ["sleep", "nest", "在小窝打盹"],
    ["idle", trust >= 60 ? "near" : "floor", trust >= 60 ? "凑过来看看你" : "观察四周"],
  ];
  showActivity(...activities[nextActivity]);
  nextActivity = (nextActivity + 1) % activities.length;
  scheduleActivity(pet.dataset.action === "sleep" ? 8500 : 5500);
}

const care = {
  feed: { action: ["feed", "hay", "吃提摩西草"], gain: 8, text: "小银捧起提摩西草，慢慢嚼了起来。" },
  pet: { action: ["pet", "near", "接受轻抚"], gain: 10, text: "小银放松下来，轻轻向你的手靠近。" },
  bath: { action: ["bath", "sand", "正在沙浴"], gain: 6, text: "小银跳进浴盆，在细细的浴粉里打了个滚。" },
};

function applyCare(kind) {
  const welcome = kind !== "pet" || trust >= 20;
  const interaction = care[kind];
  if (welcome) {
    trust = Math.min(100, trust + interaction.gain);
    try {
      localStorage.setItem(saveKey, JSON.stringify({ trust }));
      warning.hidden = true;
    } catch {
      warning.hidden = false;
    }
    showTrust();
    showActivity(...interaction.action);
    message.textContent = interaction.text;
  } else {
    showActivity("idle", "nest", "退到小窝旁");
    message.textContent = "小银往后退了一点。等信任度达到 20，再试试轻轻抚摸。";
  }

  buttons.forEach((button) => { button.disabled = true; });
  setTimeout(() => {
    buttons.forEach((button) => { button.disabled = false; });
  }, 2400);
  scheduleActivity(4200);
}

buttons.forEach((button) => {
  button.addEventListener("click", () => applyCare(button.dataset.care));
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearTimeout(timer);
  else scheduleActivity(4200);
});
showTrust();
scheduleActivity(4500);
