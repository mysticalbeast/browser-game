const BASE_MAX_POTION_TIME_MS = 60 * 60 * 1000; // 1 hour

function expNeeded(level = state.level) {
  return Math.floor(
    35 +
    level * 12 +
    Math.pow(level, 2) * 2.5 +
    Math.pow(level, 2.35) * 1.15
  );
}

function currentZone() {
  return ZONES.find(z => z.id === state.zoneId) || ZONES[0];
}

function currentWeapon() {
  return WEAPONS.find(w => w.name === state.equippedWeapon) || WEAPONS[0];
}

function ownsWeapon(name) {
  return Array.isArray(state.ownedWeapons) && state.ownedWeapons.includes(name);
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function fmt(num) {
  if (num < 1000) return Math.floor(num).toString();

  const units = ["K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No"];
  let unitIndex = -1;
  let value = num;

  while (value >= 1000 && unitIndex < units.length - 1) {
    value /= 1000;
    unitIndex++;
  }

  // 1–9.9 → one decimal
  if (value < 10) {
    return `${value.toFixed(1)}${units[unitIndex]}`;
  }

  // 10+ → no decimals
  return `${Math.floor(value)}${units[unitIndex]}`;
}

function monsterMaxHp() {
  const zone = currentZone();

  const scaledBaseHp =
    zone.hp * getZoneHpMultiplier(zone);

  return Math.floor(
    scaledBaseHp *
    (1 + Math.max(0, state.level - zone.levelReq) * 0.025)
  );
}

function totalExpForLevel(level) {
  let total = 0;

  for (let lvl = 1; lvl < level; lvl++) {
    total += Math.floor(50 * Math.pow(1.22, lvl - 1));
  }

  return total;
}

function addLog(text, type = "system") {
  if (!Array.isArray(state.logMessages)) {
    state.logMessages = [];
  }

  state.logMessages.unshift({
    text,
    type,
    time: Date.now()
  });

  while (state.logMessages.length > 120) {
    state.logMessages.pop();
  }

  renderLog();
}

function renderLog() {
  const logEl = document.getElementById("log");
  if (!logEl) return;

  const filter = state.activeLogFilter || "all";

  const messages = filter === "all"
    ? state.logMessages
    : state.logMessages.filter(entry => entry.type === filter);

  logEl.innerHTML = "";

  messages.slice(0, 60).forEach(entry => {
    const line = document.createElement("div");
    line.className = `logLine log-${entry.type}`;
    line.textContent = entry.text;
    logEl.appendChild(line);
  });
}

function setLogFilter(filter) {
  state.activeLogFilter = filter;

  document.querySelectorAll("[data-log-filter]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.logFilter === filter);
  });

  renderLog();
  saveGame();
}

function formatCooldown(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));

  if (seconds <= 0) return "Ready";

  if (seconds < 60) {
    return seconds + "s";
  }

  const minutes = Math.ceil(seconds / 60);

  if (minutes < 60) {
    return minutes + "min";
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes <= 0) {
    return hours + "h";
  }

  return hours + "h " + remainingMinutes + "min";
}

function getTotalStat(statKey) {
  let total = 0;

  Object.values(state.equipment).forEach(item => {
    if (!item || !item.stats) return;

    total += item.stats[statKey] || 0;
  });

  return total;
}

function getEnhancedItemStatValue(item, statKey, baseValue) {
  const enhance = item.enhanceLevel || 0;

  if (statKey === "critChance") {
    return Number(
      (baseValue + (baseValue * enhance * 0.33)).toFixed(2)
    );
  }

  if (statKey.toLowerCase().includes("skill")) {
    return baseValue + Math.floor(enhance * 0.75);
  }

  return Math.floor(baseValue * (1 + enhance * 0.33));
}

function getTotalEquipmentStat(statKey) {
  let total = 0;

  Object.values(state.equipment || {}).forEach(item => {
    if (!item || !item.stats) return;

    if (item.enhanceLevel === undefined) item.enhanceLevel = 0;

    const baseValue = item.stats[statKey] || 0;
    if (!baseValue) return;

    total += getEnhancedItemStatValue(item, statKey, baseValue);
  });

  return Math.floor(total);
}

function setupOfflineGainTracking() {
  function markAway() {
    if (window.gamePausedForAuth) return;
    if (window.isAwayForOffline) return;

    window.isAwayForOffline = true;
    state.lastSeenAt = Date.now();

    const save = getSerializableSave();
    localStorage.setItem(getCurrentSaveKey(), JSON.stringify(save));

    if (pendingCloudSave) {
      uploadCloudSave(pendingCloudSave);
      pendingCloudSave = null;
    }
  }

  function returnFromAway() {
    if (!window.isAwayForOffline) return;

    window.isAwayForOffline = false;
    window.offlineGainProcessing = true;

    calculateOfflineGains();
    renderOfflinePopup?.();
    updateUI?.();

    window.offlineGainProcessing = false;

    saveGame();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      markAway();
    } else {
      returnFromAway();
    }
  });

  window.addEventListener("blur", markAway);
  window.addEventListener("focus", returnFromAway);

  window.addEventListener("beforeunload", () => {
    markAway();
  });
}

function calculateOfflineGains() {
  if (!state.lastSeenAt) {
    state.lastSeenAt = Date.now();
    return;
  }

  const now = Date.now();
  const elapsedMs = now - state.lastSeenAt;

  const maxOfflineMs = 8 * 60 * 60 * 1000;
  const cappedMs = Math.min(elapsedMs, maxOfflineMs);

  const minutes = cappedMs / 60000;

const minOfflineMs = 10 * 1000;
if (cappedMs < minOfflineMs) return;

  const zone = currentZone();

  const killsPerMinute = 20;
  const efficiency = 0.35;

  const kills = Math.floor(minutes * killsPerMinute * efficiency);
  if (kills <= 0) return;

  let totalGold = 0;
  let totalExp = 0;
  let equipmentDrops = 0;
  let whetstones = 0;

  const essenceGains = {
    greenEssence: 0,
    blueEssence: 0,
    yellowEssence: 0,
    redEssence: 0
  };

  const salvageGains = {
    commonMaterial: 0,
    uncommonMaterial: 0,
    rareMaterial: 0,
    legendaryMaterial: 0
  };

  for (let i = 0; i < kills; i++) {
    // GOLD / EXP
    totalGold += rand(zone.gold[0], zone.gold[1]);
    totalExp += rand(zone.exp[0], zone.exp[1]);

    // ESSENCE (reuse your logic simplified)
    if (Math.random() < 0.25) essenceGains.greenEssence++;
    if (Math.random() < 0.15) essenceGains.blueEssence++;
    if (Math.random() < 0.10) essenceGains.yellowEssence++;
    if (Math.random() < 0.05) essenceGains.redEssence++;

    // EQUIPMENT
    const dropChance = 0.005;
    if (Math.random() < dropChance) {
      equipmentDrops++;

      // simulate salvage instead of storing items
      const rarityRoll = Math.random();
      if (rarityRoll < 0.6) salvageGains.commonMaterial++;
      else if (rarityRoll < 0.85) salvageGains.uncommonMaterial++;
      else if (rarityRoll < 0.97) salvageGains.rareMaterial++;
      else salvageGains.legendaryMaterial++;
    }

    // WHETSTONE
    const whetChance = (0.005 + zone.id * 0.0005) / 25;
    if (Math.random() < whetChance) whetstones++;
  }

  // APPLY REWARDS
  state.gold += totalGold;
  state.exp += totalExp;

  Object.keys(essenceGains).forEach(k => {
    state.materials[k] = (state.materials[k] || 0) + essenceGains[k];
  });

  Object.keys(salvageGains).forEach(k => {
    state.salvageMaterials[k] = (state.salvageMaterials[k] || 0) + salvageGains[k];
  });

  state.materials.whetstones = (state.materials.whetstones || 0) + whetstones;

  const startLevel = state.level;
  checkLevelUp();
  const gainedLevels = state.level - startLevel;

  // STORE RESULT FOR UI
  state.offlineSummary = {
    minutes,
    gainedLevels,
    totalGold,
    totalExp,
    equipmentDrops,
    whetstones,
    essenceGains,
    salvageGains
  };

  state.lastSeenAt = now;
  saveGame();
}

function renderOfflinePopup() {
  const data = state.offlineSummary;
  if (!data) return;

  const el = document.getElementById("offlinePopup");
  if (!el) return;

  el.style.display = "block";

  el.innerHTML = `
    <div class="afkBox">
      <div class="afkTitle">⏳ AFK Progress</div>

      <div>+${data.gainedLevels} Levels</div>
      <div>+${fmt(data.totalExp)} EXP</div>
      <div>+${fmt(data.totalGold)} Gold</div>
      <div>+${data.equipmentDrops} Equipment</div>
      <div>+${data.whetstones} Whetstones</div>

      <div style="margin-top:10px;">
        Green: +${data.essenceGains.greenEssence}
        Blue: +${data.essenceGains.blueEssence}
        Yellow: +${data.essenceGains.yellowEssence}
        Red: +${data.essenceGains.redEssence}
      </div>

      <button onclick="closeOfflinePopup()">Continue</button>
    </div>
  `;
}

function closeOfflinePopup() {
  const el = document.getElementById("offlinePopup");
  if (el) el.style.display = "none";

  state.offlineSummary = null;
}