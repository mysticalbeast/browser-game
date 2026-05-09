let currentSkillTreeOrigin = { x: 0, y: 0 };

function getMaxPotionTimeMs() {
  const bonusLevels = state.rebirthUpgrades?.potionLimit || 0;
  return BASE_MAX_POTION_TIME_MS + bonusLevels * 60 * 60 * 1000;
}

const RESEARCH_BREAKTHROUGH_DURATION_MS = 15 * 60 * 1000;
const RESEARCH_BREAKTHROUGH_CHECK_MS = 60 * 1000;
const RESEARCH_BREAKTHROUGH_OPEN_CHANCE = 0.03;

const OBSERVATORY_DURATION_MS = 15 * 60 * 1000;      // open for 15 min
const OBSERVATORY_CHECK_MS = 60 * 1000;             // roll once per minute
const OBSERVATORY_OPEN_CHANCE = 0.03;               // 3% per minute
const OBSERVATORY_ZONE_ID = 9999;

const STAR_ZONE_DURATION_MS = 15 * 60 * 1000;
const STAR_SPAWN_CHECK_MS = 1000;

let saveGameTimeout = null;

function queueSaveGame(delay = 300) {
  clearTimeout(saveGameTimeout);

  saveGameTimeout = setTimeout(() => {
    saveGame();
  }, delay);
}

function isResearchBreakthroughActive() {
  return state.researchBreakthrough?.active === true &&
    Date.now() < (state.researchBreakthrough?.closesAt || 0);
}

function getResearchBreakthroughTimeLeftText() {
  if (!isResearchBreakthroughActive()) return "Closed";

  const msLeft = Math.max(0, state.researchBreakthrough.closesAt - Date.now());
  const minutes = Math.floor(msLeft / 60000);
  const seconds = Math.floor((msLeft % 60000) / 1000);

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function openResearchBreakthrough(now = Date.now()) {
  if (!state.researchBreakthrough) state.researchBreakthrough = {};

  state.researchBreakthrough.active = true;
  state.researchBreakthrough.closesAt = now + RESEARCH_BREAKTHROUGH_DURATION_MS;
  state.researchBreakthrough.nextCheckAt =
    state.researchBreakthrough.closesAt + RESEARCH_BREAKTHROUGH_CHECK_MS;

  showFilterNotification(
    "system",
    "📖 Research Breakthrough started! Monster kills count as 3 for research."
  );

  updateResearchBreakthroughNotification();
  queueSaveGame?.() || saveGame();
}

function closeResearchBreakthrough(now = Date.now()) {
  if (!state.researchBreakthrough) state.researchBreakthrough = {};

  state.researchBreakthrough.active = false;
  state.researchBreakthrough.closesAt = 0;
  state.researchBreakthrough.nextCheckAt = now + RESEARCH_BREAKTHROUGH_CHECK_MS;

  showFilterNotification(
    "system",
    "📖 Research Breakthrough has ended."
  );

  updateResearchBreakthroughNotification();
  queueSaveGame?.() || saveGame();
}

function getEventNotificationRow() {
  let row = document.getElementById("eventNotificationRow");

  if (!row) {
    row = document.createElement("div");
    row.id = "eventNotificationRow";
    document.getElementById("arena")?.appendChild(row);
  }

  return row;
}

function updateResearchBreakthroughNotification() {
  let box = document.getElementById("researchBreakthroughNotification");

  if (!box) {
    box = document.createElement("div");
    box.id = "researchBreakthroughNotification";
    getEventNotificationRow()?.appendChild(box);
  }

  if (!isResearchBreakthroughActive()) {
    box.style.display = "none";
    return;
  }

  box.style.display = "block";
  box.innerHTML = `
    📖 <b>Research Breakthrough!</b><br>
    Monster kills count as x3 for research.<br>
    Ends in: <b>${getResearchBreakthroughTimeLeftText()}</b>
  `;
}

function updateResearchBreakthroughEvent(now = Date.now()) {
  if (!state.researchBreakthrough) {
    state.researchBreakthrough = {
      active: false,
      closesAt: 0,
      nextCheckAt: now + RESEARCH_BREAKTHROUGH_CHECK_MS
    };
  }

  if (state.researchBreakthrough.active) {
    if (now >= state.researchBreakthrough.closesAt) {
      closeResearchBreakthrough(now);
    }
    return;
  }

  if (now < state.researchBreakthrough.nextCheckAt) return;

  state.researchBreakthrough.nextCheckAt = now + RESEARCH_BREAKTHROUGH_CHECK_MS;

  if (Math.random() < RESEARCH_BREAKTHROUGH_OPEN_CHANCE) {
    openResearchBreakthrough(now);
  }
}

let starGainHistory = [];

function recordStarGain(amount) {
  const now = Date.now();
  starGainHistory.push({ time: now, amount });

  // keep last 10 seconds
  starGainHistory = starGainHistory.filter(e => now - e.time <= 10000);
}

function getRecentStarsPerSecond() {
  const now = Date.now();

  const recent = starGainHistory.filter(e => now - e.time <= 5000);
  const total = recent.reduce((sum, e) => sum + e.amount, 0);

  return total / 5;
}

function refreshStarforgeCurrentTab() {
  updateStarCurrencyUI();

  if (typeof switchStarforgeTab === "function") {
    switchStarforgeTab(state.activeStarforgeTab || "stars");
    return;
  }

  renderStarforgePanel(state.activeStarforgeTab || "stars");
}

function switchStarforgeTab(tab) {
  state.activeStarforgeTab = tab;

  document.querySelectorAll("[data-starforge-tab]").forEach(button => {
    button.classList.toggle("active", button.dataset.starforgeTab === tab);
  });

  if (tab === "weapon") {
    renderWeaponStarTab();
  } else if (tab === "constellations") {
    renderConstellationTab();
  } else {
    renderStarUpgradeTab();
  }
}

function getAverageStarYieldMultiplier() {
  const cosmicWorth = 1 + getStarUpgradeLevel("cosmicWorth") * 0.10;
  const stellarYield = 1 + getStarUpgradeLevel("stellarYield") * 0.25;

  const supernovaChance = getStarUpgradeLevel("supernovas") * 0.001;
  const supergiantChance = getStarUpgradeLevel("supergiants") * 0.001;

  const novaMultiplier = 2 + getStarUpgradeLevel("novaYields") * 0.25;
  const giantMultiplier = 3 + getStarUpgradeLevel("giantYields") * 0.25;

  const averageNovaBonus =
    (1 - supernovaChance) * 1 +
    supernovaChance * novaMultiplier;

  const averageGiantBonus =
    (1 - supergiantChance) * 1 +
    supergiantChance * giantMultiplier;

  return cosmicWorth * stellarYield * averageNovaBonus * averageGiantBonus;
}

function getAverageStarSpawnCountForCatchup() {
  const starfallChance = getStarUpgradeLevel("starfall") * 0.10;

  const guaranteed = Math.floor(starfallChance);
  const extraChance = starfallChance - guaranteed;

  return guaranteed + extraChance;
}

function getAverageStarAmountMultiplier() {
  const starShowerChance = getStarUpgradeLevel("starShower") * 0.003;
  const astralShowerChance = getStarUpgradeLevel("astralShower") * 0.001;

  const averageFromStarShower =
    (1 - starShowerChance) * 1 +
    starShowerChance * 3;

  const averageFromAstralShower =
    (1 - astralShowerChance) * 1 +
    astralShowerChance * 10;

  return averageFromStarShower * averageFromAstralShower;
}

let lastStarInactiveAt = Date.now();

function getStarCatchupRatePerSecond() {
  const secondsPerCheck = STAR_SPAWN_CHECK_MS / 1000;
  if (secondsPerCheck <= 0) return 0;

  const spawnCount = getAverageStarSpawnCountForCatchup();
  const amountMultiplier = getAverageStarAmountMultiplier();
  const yieldMultiplier = getAverageStarYieldMultiplier();

  const observatoryMultiplier =
    isObservatoryActive() && isInObservatory() ? 3 : 1;

  return (
    spawnCount *
    amountMultiplier *
    yieldMultiplier *
    observatoryMultiplier
  ) / secondsPerCheck;
}

function handleStarCatchup() {
  const now = Date.now();
  const missedSeconds = Math.floor((now - lastStarInactiveAt) / 1000);

  if (missedSeconds < 3) {
    lastStarInactiveAt = now;
    return;
  }

  const rate = getStarCatchupRatePerSecond();
  const gained = Math.floor(rate * missedSeconds);

  if (gained <= 0) {
    lastStarInactiveAt = now;
    return;
  }

  state.stars = (state.stars || 0) + gained;

  if (!state.stats) state.stats = {};

  state.stats.starsCollected = (state.stats.starsCollected || 0) + gained;
  state.stats.starsEarned = (state.stats.starsEarned || 0) + gained;

  recordStarGain?.(gained);

  showFilterNotification(
    "system",
    `⭐ Star catch-up: +${fmt(gained)} Stars for ${missedSeconds}s away.`
  );

  updateUI();

  if (document.getElementById("scorePanel")?.style.display === "block") {
    renderScorePanel();
  }

  if (document.getElementById("starforgePanel")?.style.display === "block") {
    renderStarforgePanel(state.activeStarforgeTab || "stars");
  }

  saveGame();

  lastStarInactiveAt = now;
}

window.addEventListener("blur", () => {
  lastStarInactiveAt = Date.now();
});

window.addEventListener("focus", () => {
  handleStarCatchup();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    lastStarInactiveAt = Date.now();
  } else {
    handleStarCatchup();
  }
});

function getWeaponStarUpgradeCost() {
  const level = state.weaponStarLevel || 0;

  return Math.floor(250_000_000 * Math.pow(1.12, level));
}

function toggleAutoCollectStars() {
  state.settings.autoCollectStars = !state.settings.autoCollectStars;

  addLog(
    `⭐ Auto Collect Stars ${state.settings.autoCollectStars ? "enabled" : "disabled"}.`
  );

  renderSettingsPanel?.();
  saveGame();
}

function getWeaponStarDamageMultiplier() {
  return 1 + (state.weaponStarLevel || 0) * 0.01;
}

function showFloatingText(text, x, y, kind = "normal") {
  const arenaEl = document.getElementById("arena");
  if (!arenaEl) return;

  const el = document.createElement("div");
  el.className = `damageText ${kind}`;
  el.textContent = text;

  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  arenaEl.appendChild(el);

  setTimeout(() => {
    el.remove();
  }, 900);
}

function getStarPickupRadius() {
  const baseRadius = 45;
  const starHoleLevel = state.starUpgrades?.starHole || 0;

  return baseRadius * (1 + starHoleLevel * 0.05);
}

function buyWeaponStarUpgrade() {
  if (!state.weaponStarLevel) state.weaponStarLevel = 0;

  if (state.weaponStarLevel >= 100) {
    addLog("Weapon Star Level is already maxed.");
    return;
  }

  const cost = getWeaponStarUpgradeCost();

  if ((state.stars || 0) < cost) {
    addLog("Not enough Stars.");
    return;
  }

  state.stars -= cost;
  state.weaponStarLevel++;

  addLog(`Weapon Star Level upgraded to +${state.weaponStarLevel}.`);

  updateUI();
  refreshStarforgeCurrentTab();
  queueSaveGame();
}

function getCurrentZoneId() {
  const zone = currentZone?.();

  if (zone?.id !== undefined) return zone.id;

  if (state.currentZoneId !== undefined) return state.currentZoneId;
  if (state.zoneId !== undefined) return state.zoneId;
  if (state.currentZone !== undefined) return state.currentZone;

  return 0;
}

function getZoneById(zoneId) {
  return ZONES.find(zone => zone.id === zoneId) || ZONES[zoneId] || null;
}

function getRandomUnlockedZoneId() {
  const unlockedZones = ZONES.filter(zone => {
    const requiredLevel = zone.level || zone.requiredLevel || 1;
    return state.level >= requiredLevel;
  });

  const pool = unlockedZones.length > 0 ? unlockedZones : ZONES;
  const zone = pool[Math.floor(Math.random() * pool.length)];

  return zone.id ?? ZONES.indexOf(zone);
}

function getPhoenixBonusMultiplier() {
  const phoenixLevel = state.constellations?.phoenix || 0;

  if (phoenixLevel <= 0) return 1;
  if ((state.level || 1) > 100) return 1;

  return 1 + phoenixLevel * 0.05;
}

function isPhoenixBoostActive() {
  return getPhoenixBonusMultiplier() > 1;
}

function getStarUpgradeLevel(key) {
  return state.starUpgrades?.[key] || 0;
}

function getConstellationLevel(key) {
  return state.constellations?.[key] || 0;
}

function initializeStarSystem() {
  if (!state.starSystem) {
    state.starSystem = {
      activeZoneId: null,
      nextZoneSwapAt: 0,
      nextSpawnCheckAt: 0
    };
  }

  const now = Date.now();

  if (state.starSystem.activeZoneId === null || !state.starSystem.nextZoneSwapAt) {
    rotateStarZone(now);
  }
}

function rotateStarZone(now = Date.now()) {
  const newZoneId = getRandomUnlockedZoneId();

  state.starSystem.activeZoneId = newZoneId;
  state.starSystem.nextZoneSwapAt = now + STAR_ZONE_DURATION_MS;
  state.starSystem.nextSpawnCheckAt = now + STAR_SPAWN_CHECK_MS;

  const zone = getZoneById(newZoneId);
  addLog(`✨ Stars are now falling in ${zone?.name || "an unknown zone"}!`);

  if (
    hasAquariusUnlocked() &&
    state.settings?.followStars === true &&
    getCurrentZoneId() !== newZoneId
  ) {
    setTimeout(() => {
      travelToStarZone(newZoneId);
    }, 2500);
  }

  saveGame();
}

function travelToStarZone(zoneId) {
  const zone = getZoneById(zoneId);
  if (!zone) return;

  if (typeof travelToZone === "function") {
    travelToZone(zoneId);
  } else {
    state.currentZoneId = zoneId;
    state.zoneId = zoneId;
    state.currentZone = zoneId;
    state.monsters = [];
    updateUI();
  }

  addLog(`♒ Follow Stars moved you to ${zone.name}.`);
  saveGame();
}

function updateStarZoneRotation(now = Date.now()) {
  initializeStarSystem();

  if (isObservatoryActive()) return;

  if (now >= state.starSystem.nextZoneSwapAt) {
    rotateStarZone(now);
  }
}

function getStarSpawnCount() {
  const spawnRate = getStarSpawnChance();

  const guaranteedStars = Math.floor(spawnRate);
  const extraChance = spawnRate - guaranteedStars;

  let count = guaranteedStars;

  if (Math.random() < extraChance) {
    count++;
  }

  return count;
}

function getStarSpawnChance() {
  const baseChance = 0.10; // 10%
  const starfallBonus = getStarUpgradeLevel("starfall") * 0.10; // +10% per point

  return baseChance + starfallBonus;
}

function rollStarAmount() {
  let amount = 1;

  const starShowerChance = getStarUpgradeLevel("starShower") * 0.003;
  const astralShowerChance = getStarUpgradeLevel("astralShower") * 0.005;

  if (Math.random() < starShowerChance) {
    amount *= 3;
  }

  if (Math.random() < astralShowerChance) {
    amount *= 10;
  }

  return amount;
}

function rollStarYieldMultiplier() {
  let multiplier = 1;

  const supernovaChance = getStarUpgradeLevel("supernovas") * 0.001;
  const supergiantChance = getStarUpgradeLevel("supergiants") * 0.001;

  const isSupernova = Math.random() < supernovaChance;
  const isSupergiant = Math.random() < supergiantChance;

  // MUCH stronger scaling
  if (isSupernova) {
    const novaBonus = 2 + getStarUpgradeLevel("novaYields") * 0.25; // +25% per level
    multiplier *= novaBonus;
  }

  if (isSupergiant) {
    const giantBonus = 3 + getStarUpgradeLevel("giantYields") * 0.25; // +25% per level
    multiplier *= giantBonus;
  }

  // Strong base scaling
  const cosmicWorth = 1 + getStarUpgradeLevel("cosmicWorth") * 0.10;
  multiplier *= cosmicWorth;

  // NEW: global multiplier (this is what pushes billions)
  const stellarYield = 1 + getStarUpgradeLevel("stellarYield") * 0.25;
  multiplier *= stellarYield;

  return {
    multiplier,
    isSupernova,
    isSupergiant
  };
}

let lastStarFocusTime = Date.now();

window.addEventListener("blur", () => {
  lastStarFocusTime = Date.now();
});

window.addEventListener("focus", () => {
  const now = Date.now();
  const missedSeconds = Math.floor((now - lastStarFocusTime) / 1000);

  if (missedSeconds <= 2) return;

  const starsPerSecond = getRecentStarsPerSecond?.() || 0;
  const gained = Math.floor(starsPerSecond * missedSeconds);

  if (gained > 0) {
    state.stars = (state.stars || 0) + gained;

    if (!state.stats) state.stats = {};
    state.stats.starsCollected = (state.stats.starsCollected || 0) + gained;
    state.stats.starsEarned = (state.stats.starsEarned || 0) + gained;

    showFilterNotification(
      "system",
      `⭐ Background star catch-up: +${fmt(gained)} Stars.`
    );

    updateUI();

    if (document.getElementById("scorePanel")?.style.display === "block") {
      renderScorePanel();
    }

    saveGame();
  }

  lastStarFocusTime = now;
});

function spawnFallingStar() {
  const currentZoneId = getCurrentZoneId();

  if (currentZoneId !== state.starSystem.activeZoneId) {
    return;
  }

  const arenaEl = document.getElementById("arena");
  if (!arenaEl) return;

  const amount = rollStarAmount();
  const yieldRoll = rollStarYieldMultiplier();

  let variantName = "Star";
  let sprite = "assets/stars/star.png";

  if (yieldRoll.isSupernova && yieldRoll.isSupergiant) {
    variantName = "Supergiant Supernova";
    sprite = "assets/stars/super_combo_star.png";
  } else if (yieldRoll.isSupernova) {
    variantName = "Supernova";
    sprite = "assets/stars/supernova_star.png";
  } else if (yieldRoll.isSupergiant) {
    variantName = "Supergiant";
    sprite = "assets/stars/supergiant_star.png";
  }

  const star = document.createElement("div");
  star.className = "fallingStar";

  const img = document.createElement("div");
  img.className = "starSprite";
  img.style.backgroundImage = `url("${sprite}")`;
  img.style.backgroundSize = "contain";
  img.style.backgroundRepeat = "no-repeat";
  img.style.backgroundPosition = "center";
  img.style.animationDuration = `${2 + Math.random() * 2}s`;

  if (Math.random() < 0.5) {
    img.style.animationDirection = "reverse";
  }

  const hitbox = document.createElement("div");
  hitbox.className = "starHitbox";

  const pickupRadius = getStarPickupRadius();
  hitbox.style.width = `${pickupRadius * 2}px`;
  hitbox.style.height = `${pickupRadius * 2}px`;

  star.appendChild(img);
  star.appendChild(hitbox);

  if (yieldRoll.isSupernova) star.classList.add("supernova");
  if (yieldRoll.isSupergiant) star.classList.add("supergiant");
  if (yieldRoll.isSupernova && yieldRoll.isSupergiant) star.classList.add("superCombo");

  if (yieldRoll.isSupergiant) {
    star.style.width = "56px";
    star.style.height = "56px";
  }

  if (yieldRoll.isSupernova && yieldRoll.isSupergiant) {
    star.style.width = "64px";
    star.style.height = "64px";
  }

  const visibleWidth = arenaEl.clientWidth;
  const starSize = parseInt(star.style.width, 10) || 48;
  const x = rand(starSize, visibleWidth - starSize);

  star.style.left = `${x}px`;
  star.style.top = `-80px`;

  const trajectoryRoll = Math.random();
  const driftAmount = rand(40, 180);
  const driftDirection = Math.random() < 0.5 ? -1 : 1;
  const driftX = driftAmount * driftDirection;

  star.style.setProperty("--star-drift-x", `${driftX}px`);

  if (trajectoryRoll < 0.25) {
    // straight down
  } else if (trajectoryRoll < 0.50) {
    star.classList.add(driftDirection < 0 ? "driftLeft" : "driftRight");
  } else if (trajectoryRoll < 0.75) {
    star.classList.add("curveLeft");
    star.style.setProperty("--star-drift-x", `${-driftAmount}px`);
  } else {
    star.classList.add("curveRight");
    star.style.setProperty("--star-drift-x", `${driftAmount}px`);
  }

  const fallDuration = 6500;
  const finalY = arenaEl.clientHeight + 100;

  let collected = false;

  function cleanupStar() {
    if (document.body.contains(star)) {
      star.remove();
    }
  }

  function collectStar() {
    if (collected) return;
    collected = true;

    const starRect = star.getBoundingClientRect();
    const arenaRect = arenaEl.getBoundingClientRect();

    const displayX = starRect.left - arenaRect.left + starRect.width / 2;
    const displayY = starRect.top - arenaRect.top + starRect.height / 2;

    const observatoryMultiplier = isObservatoryActive() && isInObservatory() ? 3 : 1;
	
	const skinStarBonus =
  1 + (getActiveMinotaurSkinBonus?.("starValue") || 0);

const gained = Math.max(
  1,
  Math.floor(
    amount *
    yieldRoll.multiplier *
    observatoryMultiplier *
    skinStarBonus
  )
);

    state.stars = (state.stars || 0) + gained;
	
	addSkinProgress?.("manualStars", 1);
	
	if (!state.stats) state.stats = {};
state.stats.starsCollected = (state.stats.starsCollected || 0) + gained;
	
	recordStarGain(gained);
	
	if (!state.stats) state.stats = {};
    state.stats.starsEarned = (state.stats.starsEarned || 0) + gained;

    applyOrionBurst();

    addLog(`⭐ Collected ${variantName}: +${fmt(gained)} Stars.`);

    showFloatingText(
      `${variantName} +${fmt(gained)} ⭐`,
      displayX,
      displayY,
      yieldRoll.isSupernova || yieldRoll.isSupergiant ? "crit" : "spell"
    );

    cleanupStar();
    updateUI();

    if (document.getElementById("starforgePanel")?.style.display === "block") {
      const starsAmount = document.getElementById("starforgeStarsAmount");
      if (starsAmount) starsAmount.textContent = fmt(state.stars || 0);

      switchStarforgeTab(state.activeStarforgeTab || "stars");
    }

const scorePanel = document.getElementById("scorePanel");

if (scorePanel && scorePanel.style.display === "block") {
  renderScorePanel();
}

    saveGame();
  }

  hitbox.onmouseenter = () => {
    collectStar();
  };

  star.onclick = event => {
    event.stopPropagation();
    collectStar();
  };

  arenaEl.appendChild(star);

  const autoCatchChance = Math.min(1, getConstellationLevel("taurus") * 0.01);
  const autoCollectEnabled = state.settings?.autoCollectStars;

  if (autoCollectEnabled && autoCatchChance > 0 && Math.random() < autoCatchChance) {
    setTimeout(() => {
      if (document.body.contains(star)) {
        collectStar();
        addLog("♉ Taurus auto-caught a falling star.");
      }
    }, 350);
  }

  requestAnimationFrame(() => {
    star.style.top = `${finalY}px`;
  });

  setTimeout(() => {
    cleanupStar();
  }, fallDuration);
}

function hasAquariusUnlocked() {
  return (state.constellations?.aquarius || 0) > 0;
}

function toggleFollowStars() {
  if (!hasAquariusUnlocked()) {
    addLog("Aquarius is required to use Follow Stars.");
    return;
  }

  if (!state.settings) state.settings = {};

  state.settings.followStars = !state.settings.followStars;

  addLog(
    state.settings.followStars
      ? "Follow Stars enabled."
      : "Follow Stars disabled."
  );

  renderStarforgePanel("constellations");
  saveGame();
}

function updateStarCurrencyUI() {
  const starsText = document.getElementById("starsText");
  if (starsText) {
    starsText.textContent = fmt(state.stars || 0);
  }

  const starsAmount = document.getElementById("starforgeStarsAmount");
  if (starsAmount) {
    starsAmount.textContent = fmt(state.stars || 0);
  }
}

function getDracoLevel() {
  return state.constellations?.draco || 0;
}

function getDracoConversionCost() {
  const level = state.dracoWeaponScaling || 0;

  return Math.floor(500_000_000 * Math.pow(1.18, level));
}

function getDracoDamageMultiplier() {
  return 1 + (state.dracoWeaponScaling || 0) * 0.01;
}

function buyDracoWeaponScaling() {
  if ((state.weaponStarLevel || 0) < 100) {
    addLog("Celestial Weapon must be +100 before Draco scaling is available.");
    return;
  }

  if (getDracoLevel() <= 0) {
    addLog("Draco constellation is required.");
    return;
  }

  const cost = getDracoConversionCost();

  if ((state.stars || 0) < cost) {
    addLog("Not enough Stars.");
    return;
  }

  state.stars -= cost;
  state.dracoWeaponScaling = (state.dracoWeaponScaling || 0) + 1;

  addLog(`Draco scaling increased to +${state.dracoWeaponScaling}% weapon damage.`);

  updateUI();
  refreshStarforgeCurrentTab();
  queueSaveGame();
}

function renderOfflinePopup() {
  const summary = state.offlineSummary;
  if (!summary) return;

  const existing = document.getElementById("offlinePopupOverlay");
  if (existing) existing.remove();

  const essenceRows = Object.entries(summary.essenceGains || {})
    .filter(([, amount]) => amount > 0)
    .map(([key, amount]) => `
      <div class="offlineRewardRow">
        <span>${formatMaterialName(key)}</span>
        <b>+${fmt(amount)}</b>
      </div>
    `).join("");

  const salvageRows = Object.entries(summary.salvageGains || {})
    .filter(([, amount]) => amount > 0)
    .map(([key, amount]) => `
      <div class="offlineRewardRow">
        <span>${formatMaterialName(key)}</span>
        <b>+${fmt(amount)}</b>
      </div>
    `).join("");

  const overlay = document.createElement("div");
  overlay.id = "offlinePopupOverlay";

  overlay.innerHTML = `
    <div id="offlinePopupBox">
      <div class="offlinePopupTitle">🌙 Offline Gains</div>

      <div class="offlinePopupSub">
        You were away for ${formatOfflineDuration(summary.minutes)}.
      </div>

      <div class="offlineRewardGrid">
        <div class="offlineRewardRow">
          <span>Experience</span>
          <b>+${fmt(summary.totalExp)}</b>
        </div>

        <div class="offlineRewardRow">
          <span>Gold</span>
          <b>+${fmt(summary.totalGold)}</b>
        </div>

        <div class="offlineRewardRow">
          <span>Levels</span>
          <b>+${fmt(summary.gainedLevels || 0)}</b>
        </div>

        <div class="offlineRewardRow">
          <span>Equipment Drops</span>
          <b>+${fmt(summary.equipmentDrops || 0)}</b>
        </div>

        <div class="offlineRewardRow">
          <span>Whetstones</span>
          <b>+${fmt(summary.whetstones || 0)}</b>
        </div>

        ${essenceRows ? `
          <div class="offlineRewardSectionTitle">Essences</div>
          ${essenceRows}
        ` : ""}

        ${salvageRows ? `
          <div class="offlineRewardSectionTitle">Salvage Materials</div>
          ${salvageRows}
        ` : ""}
      </div>

      <button id="offlinePopupCloseBtn">Claim</button>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("offlinePopupCloseBtn").onclick = () => {
    state.offlineSummary = null;
    overlay.remove();
    saveGame();
  };
}

function formatOfflineDuration(minutes) {
  if (minutes < 60) {
    return `${Math.floor(minutes)} minute${Math.floor(minutes) === 1 ? "" : "s"}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.floor(minutes % 60);

  return `${hours}h ${remainingMinutes}m`;
}

function formatMaterialName(key) {
  return String(key)
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, char => char.toUpperCase());
}

function renderWeaponStarTab() {
  const container = document.getElementById("starforgeTabContent");
  if (!container) return;

  const weaponStarLevel = state.weaponStarLevel || 0;
  const weaponStarCost = getWeaponStarUpgradeCost();
  const weaponStarMaxed = weaponStarLevel >= 100;
  const canUpgradeWeaponStar = (state.stars || 0) >= weaponStarCost && !weaponStarMaxed;

  const showDracoScaling =
    weaponStarLevel >= 100 &&
    (state.constellations?.draco || 0) > 0;

  const dracoCost = getDracoConversionCost();
  const canBuyDraco = (state.stars || 0) >= dracoCost;

  container.innerHTML = `
    <div class="uiListCard active">
      <div class="uiListCardInner">
        <div class="uiListIcon">⚔️</div>

        <div class="uiListText">
          <div class="uiListTitle">Celestial Weapon</div>
          <div class="uiListSub">
            Permanently increases weapon damage by +1% per level.
          </div>
          <div class="skillPointsLine">
            Level +${weaponStarLevel}/100 • Current bonus: +${weaponStarLevel}%
          </div>
        </div>

        <div class="uiListAction rightAligned">
          <button
            class="uiButton ${canUpgradeWeaponStar ? "active" : ""}"
            ${canUpgradeWeaponStar ? "" : "disabled"}
            onclick="buyWeaponStarUpgrade()"
          >
            ${weaponStarMaxed ? "Maxed" : `${fmt(weaponStarCost)} ⭐`}
          </button>
        </div>
      </div>
    </div>

    ${
      showDracoScaling
        ? `
          <div class="uiListCard active">
            <div class="uiListCardInner">
              <div class="uiListIcon">🐉</div>

              <div class="uiListText">
                <div class="uiListTitle">Draco Weapon Scaling</div>
                <div class="uiListSub">
                  Convert excess Stars into permanent weapon damage after Celestial Weapon reaches +100.
                </div>
                <div class="skillPointsLine">
                  Bonus +${state.dracoWeaponScaling || 0}% weapon damage
                </div>
              </div>

              <div class="uiListAction rightAligned">
                <button
                  class="uiButton ${canBuyDraco ? "active" : ""}"
                  ${canBuyDraco ? "" : "disabled"}
                  onclick="buyDracoWeaponScaling()"
                >
                  ${fmt(dracoCost)} ⭐
                </button>
              </div>
            </div>
          </div>
        `
        : `
          <div class="uiListCard locked">
            <div class="uiListCardInner">
              <div class="uiListIcon">🐉</div>

              <div class="uiListText">
                <div class="uiListTitle">Draco Weapon Scaling</div>
                <div class="uiListSub">
                  Requires Celestial Weapon +100 and Draco constellation.
                </div>
              </div>
            </div>
          </div>
        `
    }
  `;
}

function getOrionBurstMultiplier() {
  const level = state.constellations?.orion || 0;
  if (level <= 0) return 1;

  // 1% faster Minotaur attacks per Orion level.
  // Orion 50/50 = 50% faster attacks.
  return 1 + level * 0.01;
}

function applyOrionBurst() {
  const level = state.constellations?.orion || 0;
  if (level <= 0) return;

  if (!state.temporaryBuffs) state.temporaryBuffs = {};

  state.temporaryBuffs.orionBurstUntil = Date.now() + 3000;

  addLog(`🏹 Orion Burst activated for 3 seconds.`);
}

function updateStarZoneVisual() {
  const arena = document.getElementById("arena");
  if (!arena) return;

  const isActive = getCurrentZoneId() === state.starSystem.activeZoneId;

  arena.classList.toggle("starActive", isActive);
}

function isOrionBurstActive() {
  return Date.now() < (state.temporaryBuffs?.orionBurstUntil || 0);
}

function getStarZoneTimeLeftText() {
  const nextSwap = state.starSystem?.nextZoneSwapAt || 0;
  const msLeft = Math.max(0, nextSwap - Date.now());

  const minutes = Math.floor(msLeft / 60000);
  const seconds = Math.floor((msLeft % 60000) / 1000);

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function updateStarSystem(now = Date.now()) {
  initializeStarSystem();
  updateStarZoneRotation(now);

  if (now < state.starSystem.nextSpawnCheckAt) return;

  state.starSystem.nextSpawnCheckAt = now + STAR_SPAWN_CHECK_MS;

  const spawnCount = getStarSpawnCount();

  for (let i = 0; i < spawnCount; i++) {
  const delay = Math.random() * 1000; // 0–1000ms

  setTimeout(() => {
    spawnFallingStar();
  }, delay);
}
}

function renderStarforgePanel(tab = state.activeStarforgeTab || "stars") {
  const container = document.getElementById("starforgeContent");
  if (!container) return;

  state.activeStarforgeTab = tab;

  const activeZone = getZoneById(state.starSystem?.activeZoneId);

  container.innerHTML = `
    <div class="rebirthHero ready">
      <div class="rebirthHeroTop">
        <div>
          <div class="rebirthTitle">⭐ Starforge</div>
          <div class="rebirthSub">
            Spend Stars on upgrades. Improve star generation, increase their value, or enhance your weapon.
          </div>
        </div>

        <div class="rebirthCoinBox">
          <div class="rebirthCoinAmount" id="starforgeStarsAmount">${fmt(state.stars || 0)}</div>
          <div class="rebirthCoinLabel">Stars</div>
        </div>
      </div>
    </div>

    <div class="depotTabs">
      <button class="depotTab" data-starforge-tab="stars">Star Upgrades</button>
      <button class="depotTab" data-starforge-tab="weapon">Weapon Upgrade</button>
      <button class="depotTab" data-starforge-tab="constellations">Constellations</button>
    </div>

    <div id="starforgeTabContent"></div>
  `;

  container.querySelectorAll("[data-starforge-tab]").forEach(button => {
    button.onclick = () => {
      switchStarforgeTab(button.dataset.starforgeTab);
    };
  });

  switchStarforgeTab(tab);
}

function renderStarUpgradeTab() {
  const container = document.getElementById("starforgeTabContent");
  if (!container) return;

const upgradeMap = {
  starfall: {
    name: "Starfall",
    max: 100,
    getDesc: lvl => `+${lvl * 10}% star spawn chance`,
    getNext: lvl => `+${(lvl + 1) * 10}%`
  },

  starShower: {
    name: "Star Shower",
    max: 100,
    getDesc: lvl => `${(lvl * 0.3).toFixed(1)}% chance to spawn 3 stars`,
    getNext: lvl => `${((lvl + 1) * 0.3).toFixed(1)}%`
  },

  astralShower: {
    name: "Astral Shower",
    max: 100,
    getDesc: lvl => `${(lvl * 0.1).toFixed(1)}% chance to spawn 10 stars`,
    getNext: lvl => `${((lvl + 1) * 0.1).toFixed(1)}%`
  },

  cosmicWorth: {
    name: "Cosmic Worth",
    max: 100,
    getDesc: lvl => `+${lvl * 10}% all star value`,
    getNext: lvl => `+${(lvl + 1) * 10}%`
  },

  stellarYield: {
  name: "Stellar Yield",
  max: 100,
  getDesc: lvl => `x${(1 + lvl * 0.25).toFixed(2)} all star yield`,
  getNext: lvl => `x${(1 + (lvl + 1) * 0.25).toFixed(2)}`
},

  supernovas: {
    name: "Supernovas",
    max: 100,
    getDesc: lvl => `${(lvl * 0.1).toFixed(1)}% chance for stars to be supernovas`,
    getNext: lvl => `${((lvl + 1) * 0.1).toFixed(1)}%`
  },

  supergiants: {
    name: "Supergiants",
    max: 100,
    getDesc: lvl => `${(lvl * 0.1).toFixed(1)}% chance for stars to be supergiants`,
    getNext: lvl => `${((lvl + 1) * 0.1).toFixed(1)}%`
  },

  novaYields: {
    name: "Nova Yields",
    max: 100,
    getDesc: lvl => `+${lvl * 25}% supernova value`,
    getNext: lvl => `+${(lvl + 1) * 25}%`
  },

  giantYields: {
    name: "Giant Yields",
    max: 100,
    getDesc: lvl => `+${lvl * 25}% supergiant value`,
    getNext: lvl => `+${(lvl + 1) * 25}%`
  },

  starHole: {
    name: "Star Hole",
    max: 100,
    getDesc: lvl => `+${lvl * 5}% pickup range`,
    getNext: lvl => `+${(lvl + 1) * 5}%`
  }
};

  const sections = [
    {
      title: "Spawn",
      upgrades: ["starfall", "starShower", "astralShower"]
    },
    {
      title: "Value",
      upgrades: ["cosmicWorth", "stellarYield", "novaYields", "giantYields"]
    },
    {
      title: "Star Types",
      upgrades: ["supernovas", "supergiants"]
    },
    {
      title: "Utility",
      upgrades: ["starHole"]
    }
  ];

  container.innerHTML = `
    ${sections.map(section => `
      <div class="starSection">
        <div class="starSectionTitle">${section.title}</div>

        <div class="uiGrid">
          ${section.upgrades.map(key => {
            const upg = upgradeMap[key];
            const level = state.starUpgrades?.[key] || 0;
            const cost = getStarUpgradeCost(key);
            const maxed = level >= upg.max;
            const canAfford = (state.stars || 0) >= cost && !maxed;

            const desc = upg.getDesc(level);
            const next = level < upg.max ? upg.getNext(level) : null;

            return `
              <div class="uiListCard ${maxed ? "active" : ""}">
                <div class="uiListCardInner">
                  <div class="uiListIcon">⭐</div>

                  <div class="uiListText">
                    <div class="uiListTitle">${upg.name}</div>
                    <div class="uiListSub">
                      Current: ${desc}
                      ${next ? `<br><span class="nextValue">Next: ${next}</span>` : ""}
                    </div>
                    <div class="skillPointsLine">Level ${level}/${upg.max}</div>
                  </div>

                  <div class="uiListAction rightAligned">
                    <button
                      class="uiButton ${canAfford ? "active" : ""}"
                      ${canAfford ? "" : "disabled"}
                      onclick="buyStarUpgrade('${key}')"
                    >
                      ${maxed ? "Maxed" : `${fmt(cost)} ⭐`}
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `).join("")}
  `;
}

function getConstellationConfig() {
  return [
    {
      key: "aries",
      name: "Aries",
      icon: "♈",
      max: 10,
      desc: "Increase max level of all skills by +1 per level."
    },
	{
  key: "taurus",
  name: "Taurus",
  icon: "♉",
  max: 100,
  desc: "Each level gives +1% chance to automatically catch falling stars."
},
{
  key: "cancer",
  name: "Cancer",
  icon: "♋",
  max: 7,
  desc: "Unlocks one additional depot tab per level."
},
{
  key: "orion",
  name: "Orion",
  icon: "🏹",
  max: 50,
  desc: "Collecting a star grants a short combat burst."
},
{
  key: "cetus",
  name: "Cetus",
  icon: "🐋",
  max: 10,
  desc: "Increases maximum monsters on screen by +1 per level."
},
    {
      key: "gemini",
      name: "Gemini",
      icon: "♊",
      max: 5,
      desc: "Each level allows one skill branch to use both modifiers."
    },
    {
      key: "sagittarius",
      name: "Sagittarius",
      icon: "♐",
      max: 20,
      desc: "Each level gives +5% chance for multi-hit attacks to also hit the primary target."
    },
    {
      key: "aquarius",
      name: "Aquarius",
      icon: "♒",
      max: 1,
      desc: "Unlocks Follow Stars toggle, automatically switching zone when stars move."
    },
    {
      key: "phoenix",
      name: "Phoenix",
      icon: "🔥",
      max: 100,
      desc: "Grants +5% damage, gold, and EXP per level during levels 1–100 after rebirth."
    },
    {
      key: "draco",
      name: "Draco",
      icon: "🐉",
      max: 1,
      desc: "Unlocks Draco Weapon Scaling after Celestial Weapon reaches +100."
    }
  ];
}

function getConstellationCost(key) {
  const level = state.constellations?.[key] || 0;

  const costTables = {
    cancer: [
      1_000_000,
      10_000_000,
      100_000_000,
      1_000_000_000,
      10_000_000_000,
      100_000_000_000,
      1_000_000_000_000
    ],

    aries: [
      10_000_000_000,
      50_000_000_000,
      250_000_000_000,
      1_000_000_000_000,
      5_000_000_000_000,
      25_000_000_000_000,
      100_000_000_000_000,
      500_000_000_000_000,
      2_500_000_000_000_000,
      10_000_000_000_000_000
    ],

    gemini: [
      5_000_000_000,
      25_000_000_000,
      100_000_000_000,
      500_000_000_000,
      2_500_000_000_000
    ],

    sagittarius: Array.from({ length: 20 }, (_, i) =>
      Math.floor(500_000_000 * Math.pow(1.45, i))
    ),

    taurus: Array.from({ length: 100 }, (_, i) =>
      Math.floor(100_000 * Math.pow(1.18, i))
    ),

    orion: Array.from({ length: 50 }, (_, i) =>
      Math.floor(5_000_000 * Math.pow(1.25, i))
    ),

    cetus: Array.from({ length: 10 }, (_, i) =>
      Math.floor(250_000_000 * Math.pow(2, i))
    ),

    aquarius: [
      2_500_000_000
    ],

    phoenix: Array.from({ length: 100 }, (_, i) =>
      Math.floor(25_000_000 * Math.pow(1.22, i))
    ),

    draco: [
      250_000_000_000
    ]
  };

  const table = costTables[key];

  if (table && table[level] !== undefined) {
    return table[level];
  }

  return Math.floor(1_000_000 * Math.pow(2, level));
}

function buyConstellationUpgrade(key) {
  if (!state.constellations) state.constellations = {};

  const config = getConstellationConfig().find(c => c.key === key);
  if (!config) return;

  const level = state.constellations[key] || 0;

  if (level >= config.max) {
    addLog(`${config.name} is already maxed.`);
    return;
  }

  const cost = getConstellationCost(key);

  if ((state.stars || 0) < cost) {
    addLog("Not enough Stars.");
    return;
  }

  state.stars -= cost;
  state.constellations[key] = level + 1;

  addLog(`Upgraded ${config.name} to ${level + 1}.`);

  updateStarCurrencyUI();

  // Refresh current Starforge tab first.
  refreshStarforgeCurrentTab();

  // Cancer-specific depot refresh.
  if (key === "cancer") {
    if (typeof renderDepotTabs === "function") renderDepotTabs();
    if (typeof renderDepot === "function") renderDepot();
  }

  queueSaveGame();
}

function renderConstellationTab() {
  const container = document.getElementById("starforgeTabContent");
  if (!container) return;

  const constellations = getConstellationConfig();

  let html = `
    <div class="uiGrid">
      ${constellations.map(c => {
        const level = state.constellations?.[c.key] || 0;
        const cost = getConstellationCost(c.key);
        const maxed = level >= c.max;
        const canAfford = (state.stars || 0) >= cost && !maxed;

        return `
          <div class="uiListCard ${maxed ? "active" : ""}">
            <div class="uiListCardInner">
              <div class="uiListIcon">${c.icon}</div>

              <div class="uiListText">
                <div class="uiListTitle">${c.name}</div>
                <div class="uiListSub">${c.desc}</div>
                <div class="skillPointsLine">Level ${level}/${c.max}</div>
              </div>

              <div class="uiListAction rightAligned">
                <button
                  class="uiButton ${canAfford ? "active" : ""}"
                  ${canAfford ? "" : "disabled"}
                  onclick="buyConstellationUpgrade('${c.key}')"
                >
                  ${maxed ? "Maxed" : `${fmt(cost)} ⭐`}
                </button>
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  container.innerHTML = html;
}

function resetSkillTreeView() {
  const WORLD_WIDTH = 3600;
  const WORLD_HEIGHT = 3600;

  const nodesArray = Object.values(SKILL_NODES);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  nodesArray.forEach(node => {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y);
  });

  const treeCenterX = minX + (maxX - minX) / 2;
  const treeCenterY = minY + (maxY - minY) / 2;

  const ORIGIN_X = WORLD_WIDTH / 2 - treeCenterX;
  const ORIGIN_Y = WORLD_HEIGHT / 2 - treeCenterY;

  centerSkillTreeOnNode("minotaur_category", ORIGIN_X, ORIGIN_Y);
}

function applyNodeEffect(node) {
  if (node.skill) {
    state.skills[node.skill] = (state.skills[node.skill] || 0) + (node.value || 1);
  }

  if (node.stat && node.stat !== "placeholder") {
    state.stats[node.stat] = (state.stats[node.stat] || 0) + (node.value || 1);
  }
}

function getPotionTimeLimitMs() {
  const bonusHours = state.rebirthUpgrades?.potionLimit || 0;
  return (1 + bonusHours) * 60 * 60 * 1000;
}

function getPotionTimeLimitHours() {
  return 1 + (state.rebirthUpgrades?.potionLimit || 0);
}

function renderMenuHero(icon, title, description, stats = []) {
  return `
    <div class="menuHeroInjected">
      <div class="rebirthHero ready">
        <div class="rebirthHeroTop">
          <div>
            <div class="rebirthTitle">${icon} ${title}</div>
            <div class="rebirthSub">${description}</div>
          </div>

          ${
            stats[0]
              ? `
                <div class="rebirthCoinBox">
                  <div class="rebirthCoinAmount">${stats[0].value}</div>
                  <div class="rebirthCoinLabel">${stats[0].label}</div>
                </div>
              `
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

function getPanelHeroConfig(id) {
  if (id === "upgradePanel") {
    return {
      icon: "⚡",
      title: "Skills",
      description: "Spend skill points to unlock attacks, bonuses and automation power.",
      stats: [
        { value: state.skillPoints || 0, label: "Points" },
        { value: Object.values(state.skills || {}).reduce((a, b) => a + b, 0), label: "Levels" },
        { value: state.rebirthUpgrades?.necromancer > 0 ? "Yes" : "No", label: "Necromancer" },
        { value: fmt(state.level), label: "Level" }
      ]
    };
  }

  if (id === "researchPanel") {
    const totalKills = Object.values(state.monsterResearch || {})
      .reduce((sum, m) => sum + (m.kills || 0), 0);

    return {
      icon: "📖",
      title: "Monster Research",
      description: "Kill monsters to unlock permanent account-wide bonuses.",
      stats: [
        { value: fmt(totalKills), label: "Kills" },
        { value: Object.keys(state.monsterResearch || {}).length, label: "Discovered" },
        { value: `${(getTotalResearchBonus("damage") * 100).toFixed(1)}%`, label: "Damage" },
        { value: `${(getTotalResearchBonus("gold") * 100).toFixed(1)}%`, label: "Gold" }
      ]
    };
  }

  if (id === "scorePanel") {
    return {
      icon: "🏆",
      title: "Leaderboards",
      description: "Compare your progress against other players.",
      stats: [
        { value: fmt(state.level), label: "Level" },
        { value: fmt(state.stats?.monstersKilled || 0), label: "Kills" },
        { value: fmt(state.stats?.goldEarned || 0), label: "Gold Earned" },
        { value: state.rebirth?.count || 0, label: "Rebirths" }
      ]
    };
  }

  if (id === "rewardsPanel") {
    return {
      icon: "🎁",
      title: "Rewards",
      description: "Use silver tokens to claim bonus rewards and special prizes.",
      stats: [
        { value: state.rewards?.slotCoins || 0, label: "Tokens" },
        { value: getSkinShards?.() || 0, label: "Skin Shards" },
        { value: formatCooldown(nextSlotCoinRemaining()), label: "Next Token" },
        { value: state.rewards?.slotOptions?.length || 0, label: "Choices" }
      ]
    };
  }

  if (id === "blacksmithPanel") {
    return {
      icon: "🛠",
      title: "Blacksmith",
      description: "Enhance equipped gear using gold, materials and whetstones.",
      stats: []
    };
  }

  if (id === "depotPanel") {
    const itemCount = (state.depot?.tabs || [])
      .flat()
      .filter(Boolean).length;

    const capacity = getUnlockedDepotTabs() * 40;

    return {
      icon: "📦",
      title: "Depot",
      description: "Store, equip, sell and salvage your collected gear.",
      stats: [
        { value: `${itemCount}/${capacity}`, label: "Items" },
        { value: (state.depot?.activeTab || 0) + 1, label: "Tab" },
        { value: state.filters?.equipmentAction || "none", label: "Filter" },
        { value: state.filters?.rarityLimit || "common", label: "Rarity" }
      ]
    };
  }

  if (id === "statsPanel") {
    return {
      icon: "📊",
      title: "Stats",
      description: "Overview of your power, bonuses and current run efficiency.",
      stats: [
        { value: fmt(state.level), label: "Level" },
        { value: `${fmt(getTotalEquipmentStat("damage"))}%`, label: "Gear DMG" },
        { value: `${fmt(getTotalEquipmentStat("gold"))}%`, label: "Gold %" },
        { value: `${fmt(getTotalEquipmentStat("exp"))}%`, label: "EXP %" }
      ]
    };
  }

  if (id === "rebirthShopPanel") {
    const bought = Object.values(state.rebirthUpgrades || {})
      .reduce((sum, value) => sum + value, 0);

    return {
      icon: "🪙",
      title: "Rebirth Shop",
      description: "Spend Rebirth Coins on permanent upgrades that survive every reset.",
      stats: [
        { value: state.rebirth?.coins || 0, label: "Coins" },
        { value: state.rebirth?.count || 0, label: "Rebirths" },
        { value: bought, label: "Upgrades" },
        { value: getLevelCap(), label: "Level Cap" }
      ]
    };
  }

  return null;
}

function injectPanelHero(id) {
  const panel = document.getElementById(id);
  if (!panel) return;

  const oldHero = panel.querySelector(".menuHeroInjected");
  if (oldHero) oldHero.remove();

  const config = getPanelHeroConfig(id);
  if (!config) return;

  const html = renderMenuHero(
    config.icon,
    config.title,
    config.description,
    config.stats
  );

  const header = panel.querySelector(".uiPanelHeader");

  if (header) {
    header.insertAdjacentHTML("afterend", html);
  } else {
    panel.insertAdjacentHTML("afterbegin", html);
  }
}

let researchPage = 0;
const RESEARCH_PER_PAGE = 15;
let researchSearch = "";

let ALL_MONSTER_NAMES = [];

const SLOT_COIN_INTERVAL_MS = 60 * 60 * 1000;

let slotRollInterval = null;

function initMonsterNameCache() {
  ALL_MONSTER_NAMES = [...new Set(
    ZONES.flatMap(zone => zone.monsters.map(monster => monster.name))
  )];
}

function getMonsterSpriteByName(monsterName) {
  for (const zone of ZONES) {
    const monster = zone.monsters.find(m => m.name === monsterName);
    if (monster) return monster.sprite;
  }

  return "";
}

function showWeaponTooltip(x, y) {
  const tooltip = document.getElementById("itemTooltip");
  if (!tooltip) return;

  const weapon = currentWeapon();
  const weaponRange = getModifiedWeaponDamageRange();
  const bonusPercent = weaponRange.bonuses.totalBonus || 0;

  tooltip.innerHTML = `
    <div class="tooltipTitle">${weapon.name}</div>
    <div>
      Damage:
      <span>
        ${fmt(weaponRange.min)}-${fmt(weaponRange.max)}
        ${bonusPercent > 0
          ? `<span class="greenText"> (+${fmt(bonusPercent)}%)</span>`
          : ""}
      </span>
    </div>
  `;

  tooltip.style.display = "block";
  moveItemTooltip(x, y);
}

function renderEquipmentSlots() {
  const grid = document.getElementById("equipmentGrid");
  if (!grid) return;

  grid.innerHTML = "";

  EQUIPMENT_SLOTS.forEach(slot => {
    let item = state.equipment[slot.key];

    const isWeaponSlot = slot.key === "weapon";

    if (isWeaponSlot) {
      const weapon = currentWeapon();

      item = {
        name: weapon.name,
        sprite: weapon.sprite,
        isWeaponDisplay: true
      };
    }

    const div = document.createElement("div");
    div.className = "equipmentSlot";
    div.dataset.slot = slot.key;
	
	if (!isWeaponSlot && item && item.stats) {
  ensureItemId(item);
  div.draggable = true;
  div.ondragstart = event => handleEquipmentItemDragStart(event, slot.key);
}

    if (item && (item.stats || item.isWeaponDisplay)) {
      div.classList.add("hasItem");
    }

    if (item && item.rarityColor) {
      div.style.borderColor = item.rarityColor;
      div.style.boxShadow = `0 0 8px ${item.rarityColor}`;
    }

    if (isWeaponSlot && item) {
      div.onmouseenter = e => showWeaponTooltip(e.clientX, e.clientY);
      div.onmousemove = e => moveItemTooltip(e.clientX, e.clientY);
      div.onmouseleave = hideItemTooltip;
    } else if (item && item.stats) {
      div.onmouseenter = e => showItemTooltip(item, e.clientX, e.clientY, false);
      div.onmousemove = e => moveItemTooltip(e.clientX, e.clientY);
      div.onmouseleave = hideItemTooltip;
    }

    const enhance = item?.enhanceLevel || 0;

    div.innerHTML = `
      <div class="equipmentSlotIcon" style="position:relative;width:100%;height:100%;">
        ${
          item && item.sprite
            ? `
              <img 
                class="equipmentSlotSprite" 
                src="${item.sprite}" 
                style="
                  position:absolute;
                  top:50%;
                  left:50%;
                  transform:translate(-50%, -50%);
                  width:90%;
                  height:90%;
                  object-fit:contain;
                  image-rendering:pixelated;
                "
                onerror="this.style.display='none';"
              >

              ${enhance > 0 ? `
                <div style="
                  position:absolute;
                  bottom:2px;
                  right:4px;
                  font-size:11px;
                  font-weight:bold;
                  color:#4cff9a;
                  text-shadow:0 0 4px #000;
                  pointer-events:none;
                  z-index:2;
                ">
                  +${enhance}
                </div>
              ` : ""}
            `
            : ""
        }
      </div>
    `;

    grid.appendChild(div);
  });
}

const ESSENCE_COLORS = {
  greenEssence: "#35d66b",
  blueEssence: "#3aa7ff",
  yellowEssence: "#ffd43b",
  redEssence: "#ff4d4d"
};

function essenceDot(key) {
  return `<span style="
    display:inline-block;
    width:9px;
    height:9px;
    border-radius:50%;
    background:${ESSENCE_COLORS[key] || "#aaa"};
    box-shadow:0 0 5px ${ESSENCE_COLORS[key] || "#aaa"};
    margin-right:5px;
    vertical-align:middle;
  "></span>`;
}

function getRewardTier(reward) {
  if (reward.weight <= 5) {
    return { name: "Legendary", color: "#ff4d4d", glow: "rgba(255,77,77,.75)" };
  }

  if (reward.weight <= 15) {
    return { name: "Rare", color: "#c77dff", glow: "rgba(199,125,255,.75)" };
  }

  if (reward.weight <= 40) {
    return { name: "Uncommon", color: "#4dabf7", glow: "rgba(77,171,247,.65)" };
  }

  return { name: "Common", color: "#d9d9d9", glow: "rgba(255,255,255,.25)" };
}

function getTotalRewardWeight() {
  return SLOT_REWARD_POOL.reduce((sum, reward) => sum + reward.weight, 0);
}

function getRewardOddsPercent(reward) {
  const total = getTotalRewardWeight();
  return total > 0 ? ((reward.weight / total) * 100).toFixed(2) : "0.00";
}

function toggleRewardOddsList() {
  state.rewards.showOdds = !state.rewards.showOdds;
  renderRewardsPanel();
}

function updateRewardCoins() {
  const now = Date.now();

  if (!state.rewards.lastCoinAt) {
    state.rewards.lastCoinAt = now;
    return;
  }

  const elapsed = now - state.rewards.lastCoinAt;
  const coinsToAdd = Math.floor(elapsed / SLOT_COIN_INTERVAL_MS);

  if (coinsToAdd > 0) {
    state.rewards.slotCoins += coinsToAdd;
    state.rewards.lastCoinAt += coinsToAdd * SLOT_COIN_INTERVAL_MS;
    addLog(`⚪ You received ${coinsToAdd} Silver Token${coinsToAdd === 1 ? "" : "s"}.`);
    saveGame();
  }
}

function nextSlotCoinRemaining() {
  const now = Date.now();
  const nextAt = (state.rewards.lastCoinAt || now) + SLOT_COIN_INTERVAL_MS;
  return Math.max(0, nextAt - now);
}

function pickWeightedSlotReward() {
  const total = SLOT_REWARD_POOL.reduce((sum, reward) => sum + reward.weight, 0);
  let roll = Math.random() * total;

  for (const reward of SLOT_REWARD_POOL) {
    roll -= reward.weight;
    if (roll <= 0) return { ...reward };
  }

  return { ...SLOT_REWARD_POOL[0] };
}

function startSlotRollAnimation(finalRewards) {
  const slots = document.querySelectorAll(".slotReelIcon");
  if (!slots.length) return;

  const rewardIcons = SLOT_REWARD_POOL.map(reward => reward.icon);
  const stopped = [false, false, false];
  let tick = 0;

  if (slotRollInterval) {
    clearInterval(slotRollInterval);
    slotRollInterval = null;
  }

  slotRollInterval = setInterval(() => {
    tick++;

    slots.forEach((slot, index) => {
      if (stopped[index]) return;

      const randomIcon = rewardIcons[rand(0, rewardIcons.length - 1)];
      slot.textContent = randomIcon;
      slot.style.transform = `translateY(${tick % 2 === 0 ? "-3px" : "3px"}) scale(1.08)`;
    });
  }, 70);

  slots.forEach((slot, index) => {
    setTimeout(() => {
      stopped[index] = true;

      slot.textContent = finalRewards[index].icon;
      slot.style.transform = "translateY(0) scale(1)";
      slot.classList.add("slotReelStop");

      setTimeout(() => {
        slot.classList.remove("slotReelStop");
      }, 350);

      if (index === slots.length - 1) {
        if (slotRollInterval) {
          clearInterval(slotRollInterval);
          slotRollInterval = null;
        }

        state.rewards.slotOptions = finalRewards;
        state.rewards.slotSpinning = false;

        addLog("🎰 Slot machine stopped. Pick one reward.");

        renderRewardsPanel();
        updateMenuIndicators();
        saveGame();
      }
    }, 1100 + index * 500);
  });
}

function spinSlotMachine() {
  if (state.rewards.slotSpinning) return;

  if (state.rewards.slotCoins <= 0) {
    addLog("⚪ You need a Silver Token to spin.");
    return;
  }

  if (state.rewards.slotOptions.length > 0) {
    addLog("🎰 Pick one of your current slot rewards first.");
    return;
  }

  const finalRewards = [
    pickWeightedSlotReward(),
    pickWeightedSlotReward(),
    pickWeightedSlotReward()
  ];

  state.rewards.slotCoins--;
  state.rewards.slotSpinning = true;
  state.rewards.slotOptions = [];

  renderRewardsPanel();
  updateMenuIndicators();

  startSlotRollAnimation(finalRewards);
}

function addPotionTimeFromReward(potionKey, durationMs) {
  const potion = POTIONS.find(p => p.key === potionKey);
  if (!potion) return false;

  const now = Date.now();
  const currentUntil = state.potions[potion.activeKey] || 0;
  const currentRemaining = Math.max(0, currentUntil - now);

  if (currentRemaining >= getMaxPotionTimeMs()) {
    return false;
  }

  const addedDuration = Math.min(durationMs, getMaxPotionTimeMs() - currentRemaining);
  state.potions[potion.activeKey] = Math.max(now, currentUntil) + addedDuration;

  return addedDuration > 0;
}

function getNextAutoWeaponText() {
  if (!(state.rebirthUpgrades?.autoBuy > 0)) return null;
  if (!state.automationToggles?.autoBuy) return null;

  const nextWeapon = WEAPONS.find(w =>
    state.level >= w.levelReq &&
    !ownsWeapon(w.name)
  );

  if (!nextWeapon) return "All available weapons owned";

  return `Next: ${nextWeapon.name} (${fmt(nextWeapon.cost)}g)`;
}

function getNextAutoTravelText() {
  if (!(state.rebirthUpgrades?.autoTravel > 0)) return null;
  if (!state.automationToggles?.autoTravel) return null;

  const availableZones = ZONES
    .filter(zone => state.level >= zone.levelReq)
    .sort((a, b) => b.levelReq - a.levelReq);

  const bestZone = availableZones[0];

  if (!bestZone || bestZone.id === state.zoneId) {
    return "Current zone is best unlocked";
  }

  return `Target: ${bestZone.name} (Lv ${bestZone.levelReq})`;
}

function getNextAutoSkillText() {
  if (!(state.rebirthUpgrades?.autoSkills > 0)) return null;
  if (!state.automationToggles?.autoSkills) return null;

  const priority = [
    "sharpshooter",
    "powerBolt",
    "unlockFireball",
    "deepPockets",
    "experiencedHunter",
    "materialistic",
    "fireballDamage",
    "fireballCooldown",
    "doubleStrike",
    "tripleStrike",
    "headshot",
    "strongerBullets",
    "unlockLightMagic",
    "lightMagicDamage",
    "lightMagicCooldown",
    "unlockHeavyMagic",
    "heavyMagicDamage",
    "heavyMagicCooldown",
    "gearingUp",
    "likeABoss",
    "lootHungry",
    "uberDifficulty"
  ];

  const nextKey = priority.find(key => {
    const skill = Object.values(SKILLS).flat().find(s => s.key === key);
    if (!skill) return false;

    const current = state.skills[key] || 0;
    if (current >= skill.max) return false;
    if (!isSkillUnlocked(key)) return false;

    return true;
  });

  if (!nextKey) return "All priority skills maxed";

  const skill = Object.values(SKILLS).flat().find(s => s.key === nextKey);
  return `Next: ${skill.name}`;
}

function renderAutomationInfo() {
  const box = document.getElementById("automationInfo");
  if (!box) return;

  ensureAutomationToggles();

  const rows = [];

  const weaponText = getNextAutoWeaponText();
  const travelText = getNextAutoTravelText();
  const skillText = getNextAutoSkillText();

  if (weaponText) rows.push(`<div class="automationInfoLine">⚔ <b>Auto Weapons</b><br>${weaponText}</div>`);
  if (travelText) rows.push(`<div class="automationInfoLine">🌍 <b>Auto Travel</b><br>${travelText}</div>`);
  if (skillText) rows.push(`<div class="automationInfoLine">⚡ <b>Auto Skills</b><br>${skillText}</div>`);

  box.style.display = "block";

  if (!rows.length) {
    box.innerHTML = `
      <div class="automationInfoTitle">Automations</div>
      <div class="automationInfoLine">No active automations</div>
    `;
    return;
  }

  box.innerHTML = `
    <div class="automationInfoTitle">Automations</div>
    ${rows.join("")}
  `;
}

function claimSlotReward(index) {
  const reward = state.rewards.slotOptions[index];
  if (!reward) return;

  if (reward.type === "gold") {
    const amount = Math.floor(reward.amount * Math.max(1, state.level));
    state.gold += amount;

    if (!state.stats) state.stats = {};
    state.stats.goldEarned = (state.stats.goldEarned || 0) + amount;

    showFilterNotification("system", `🎁 ${reward.name}: +${fmt(amount)} gold.`);
  }

  if (reward.type === "exp") {
    const amount = Math.floor(reward.amount * Math.max(1, state.level));
    state.exp += amount;

    if (!state.stats) state.stats = {};
    state.stats.expEarned = (state.stats.expEarned || 0) + amount;

    showFilterNotification("system", `🎁 ${reward.name}: +${fmt(amount)} EXP.`);
    checkLevelUp();
  }

  if (reward.type === "material") {
    state.materials[reward.materialKey] += reward.amount;
    showFilterNotification(
      "system",
      `🎁 ${reward.name}: +${reward.amount} ${MATERIAL_NAMES[reward.materialKey]}.`
    );
  }

  if (reward.type === "potion") {
    const added = addPotionTimeFromReward(reward.potionKey, reward.durationMs);

    if (added) {
      showFilterNotification(
        "system",
        `🎁 ${reward.name}: +${formatCooldown(reward.durationMs)} potion time.`
      );
    } else {
      state.rewards.slotCoins++;
      showFilterNotification("system", `🎁 ${reward.name} is capped. Refunded 1 Silver Token.`);
    }
  }

  if (reward.type === "randomPotion") {
    const randomPotion = POTIONS[rand(0, POTIONS.length - 1)];
    const added = addPotionTimeFromReward(randomPotion.key, reward.durationMs);

    if (added) {
      showFilterNotification(
        "system",
        `🎁 ${reward.name}: +${formatCooldown(reward.durationMs)} ${randomPotion.name}.`
      );
    } else {
      state.rewards.slotCoins++;
      showFilterNotification("system", "🎁 Potion timers are capped. Refunded 1 Silver Token.");
    }
  }

  if (reward.type === "slotCoin") {
    state.rewards.slotCoins += reward.amount;
    showFilterNotification("system", `🎁 ${reward.name}: +${reward.amount} Silver Token.`);
  }

  if (reward.type === "skillPoint") {
    state.skillPoints += reward.amount;
    showFilterNotification("system", `🎁 ${reward.name}: +${reward.amount} skill point.`);
  }

  if (reward.type === "skinShard") {
    addSkinShards?.(reward.amount);
  }

  if (reward.type === "jackpot") {
    const goldAmount = Math.floor(5000 * Math.max(1, state.level));
    const expAmount = Math.floor(2500 * Math.max(1, state.level));

    state.gold += goldAmount;
    state.exp += expAmount;
    state.skillPoints += 1;
    state.materials.redEssence += 3;

    if (!state.stats) state.stats = {};
    state.stats.goldEarned = (state.stats.goldEarned || 0) + goldAmount;
    state.stats.expEarned = (state.stats.expEarned || 0) + expAmount;

    addSkinShards?.(25);

    showFilterNotification(
      "system",
      `💎 Jackpot! +${fmt(goldAmount)} gold, +${fmt(expAmount)} EXP, +1 skill point, +3 Red Essence, +25 Skin Shards.`
    );

    checkLevelUp();
  }

  state.rewards.slotOptions = [];

  renderRewardsPanel();
  renderLeftSpellBox();
  renderAutomationBox();
  renderAutomationInfo();
  updateMenuIndicators();
  updateUI();
  saveGame();
}

function updateMenuIndicators() {
  const skillsBtn = document.getElementById("skillsBtn");
  const weaponsBtn = document.getElementById("weaponsBtn");
  const travelBtn = document.getElementById("travelBtn");
  const rewardsBtn = document.getElementById("rewardsBtn");
  const rebirthBtn = document.getElementById("rebirthBtn");

  if (rebirthBtn) {
    rebirthBtn.classList.toggle("pulse", calculateRebirthReward() > 0);
  }

  if (skillsBtn) {
    skillsBtn.classList.remove("active");

    if ((state.skillPoints || 0) > 0) {
      skillsBtn.innerHTML = `⚡<br>Skills (${state.skillPoints})`;
      skillsBtn.classList.add("glow");
    } else {
      skillsBtn.innerHTML = "⚡<br>Skills";
      skillsBtn.classList.remove("glow");
    }
  }

  if (weaponsBtn) {
    const hasNewWeapon = WEAPONS.some(w =>
      state.level >= w.levelReq &&
      !ownsWeapon(w.name)
    );

    weaponsBtn.classList.remove("active");
    weaponsBtn.classList.toggle("glow", hasNewWeapon);
  }

  if (travelBtn) {
    if (!Array.isArray(state.visitedZones)) {
      state.visitedZones = [];
    }

    const hasNewZone = ZONES.some(zone => {
      if (zone.isEventZone) return false;
      if (zone.id === OBSERVATORY_ZONE_ID) return false;
      if (zone.id === SIEGE_ZONE_ID) return false;

      return state.level >= zone.levelReq &&
        !state.visitedZones.includes(zone.id);
    });

    travelBtn.classList.remove("active");
    travelBtn.classList.toggle("glow", hasNewZone);
  }

  if (rewardsBtn) {
    rewardsBtn.classList.remove("active");
    rewardsBtn.classList.toggle(
      "glow",
      (state.rewards?.slotCoins || 0) > 0 ||
      (state.rewards?.slotOptions?.length || 0) > 0
    );
  }
}

function updateSkillIndicator() {
  updateMenuIndicators();
}

function updateUI() {
  updateRewardCoins();
  
  renderEquipmentSlots();

  const weapon = currentWeapon();

  const gearMinDamage = getTotalEquipmentStat("minDamage");
const gearMaxDamage = getTotalEquipmentStat("maxDamage");

state.minDamage = weapon.min + state.damageUpgradeLevel * 4 + gearMinDamage;
state.maxDamage = weapon.max + state.damageUpgradeLevel * 8 + gearMaxDamage;

const levelEl = document.getElementById("levelText");

levelEl.textContent = state.level;
levelEl.style.color = "";

  document.getElementById("expText").textContent = `${fmt(state.exp)} / ${fmt(expNeeded())}`;
  document.getElementById("goldText").textContent = fmt(state.gold);
  document.getElementById("zoneText").textContent = currentZone().name;
  
  const arena = document.getElementById("arena");
const zone = currentZone();

if (arena) {
  if (zone.background) {
    arena.style.backgroundImage = `url("${zone.background}")`;
    arena.style.backgroundSize = "cover";
    arena.style.backgroundPosition = "center";
    arena.style.imageRendering = "pixelated";
  } else {
    arena.style.backgroundImage = "";
  }
}
  
  document.getElementById("weaponName").textContent = weapon.name;
  
const weaponRange = getModifiedWeaponDamageRange();
const bonusPercent = weaponRange.bonuses.totalBonus || 0;

document.getElementById("damageText").innerHTML = `
  ${fmt(weaponRange.min)}-${fmt(weaponRange.max)}
  ${bonusPercent > 0
    ? `<span class="greenText"> (+${fmt(bonusPercent)}%)</span>`
    : ""
  } dmg
`;
  
  document.getElementById("weaponImg").src = weapon.sprite;
  document.getElementById("expBar").style.width = Math.min(100, state.exp / expNeeded() * 100) + "%";
  document.getElementById("rebirthCoinsText").textContent = state.rebirth?.coins || 0;
  document.getElementById("starsText").textContent = `${fmt(state.stars || 0)}`;
  

  renderLeftSpellBox();
  renderAutomationBox();
  renderAutomationInfo();
  updateMenuIndicators();
  renderSpawnInfo();
  renderNecromancerVisual();
  
const statsPanel = document.getElementById("statsPanel");

if (statsPanel && statsPanel.style.display === "block") {
  renderStatsPanel();
}
  
}

function potionRemaining(activeKey) {
  return Math.max(0, (state.potions[activeKey] || 0) - Date.now());
}

function renderSummonInfo() {
  // Summon stats are now shown in the Stats panel.
}

function renderSpellInfo() {
  // Spell timers are now shown only in the left-side SPELLS box.
}

function getSpellCooldownMs(spellKey) {
  if (spellKey === "fireball") {
    return fireballCooldownMs();
  }

  if (spellKey === "lightMagic") {
    return lightMagicCooldownMs();
  }

  if (spellKey === "heavyMagic") {
    return heavyMagicCooldownMs();
  }

  return 0;
}

function getCooldownProgress(key) {
  const now = Date.now();

  const cooldowns = {
    fireball: fireballCooldownMs(),
    lightMagic: lightMagicCooldownMs(),
    heavyMagic: heavyMagicCooldownMs()
  };

  const cooldown = cooldowns[key];
  if (!cooldown) return 0;

  const lastCast = state.lastSpellCast?.[key] || 0;
  const elapsed = now - lastCast;

  return Math.min(100, Math.max(0, (elapsed / cooldown) * 100));
}

function getSpellCooldownMs(spellKey) {
  if (spellKey === "fireball") return fireballCooldownMs();
  if (spellKey === "lightMagic") return lightMagicCooldownMs();
  if (spellKey === "heavyMagic") return heavyMagicCooldownMs();

  return 0;
}

function renderLeftSpellBox() {
  const box = document.getElementById("leftSpellBox");
  if (!box) return;

  const rows = [];

  if ((state.skills?.unlockFireball || 0) > 0) {
    rows.push({
      name: "Fireball",
      type: "cooldown",
      key: "fireball",
      color: "#ff3b30"
    });
  }

  if ((state.skills?.unlockLightMagic || 0) > 0) {
    rows.push({
      name: "Light Magic",
      type: "cooldown",
      key: "lightMagic",
      color: "#66d9ff"
    });
  }

  if ((state.skills?.unlockHeavyMagic || 0) > 0) {
    rows.push({
      name: "Heavy Magic",
      type: "cooldown",
      key: "heavyMagic",
      color: "#b06cff"
    });
  }

  if (isPotionActive("wealthUntil")) {
    rows.push({
      name: "Wealth",
      type: "potion",
      activeKey: "wealthUntil",
      durationMs: 5 * 60 * 1000,
      color: "#ffd43b"
    });
  }

  if (isPotionActive("wisdomUntil")) {
    rows.push({
      name: "Wisdom",
      type: "potion",
      activeKey: "wisdomUntil",
      durationMs: 5 * 60 * 1000,
      color: "#4dabf7"
    });
  }

  if (isPotionActive("swiftnessUntil")) {
    rows.push({
      name: "Swiftness",
      type: "potion",
      activeKey: "swiftnessUntil",
      durationMs: 5 * 60 * 1000,
      color: "#53ff7a"
    });
  }

  if (rows.length === 0) {
    box.innerHTML = '<div class="leftSpellLine muted">No cooldowns active</div>';
    return;
  }

  box.innerHTML = rows.map(row => {
    const progress = row.type === "cooldown"
      ? getCooldownProgress(row.key)
      : getPotionProgress(row.activeKey, row.durationMs);

    return `
      <div class="cooldownRow">
        <div class="cooldownLabel">${row.name}</div>
        <div class="cooldownBar">
          <div class="cooldownFill" style="width:${progress}%;background:${row.color};box-shadow:0 0 6px ${row.color};"></div>
        </div>
      </div>
    `;
  }).join("");
}

function getPotionProgress(activeKey, durationMs) {
  const now = Date.now();
  const until = state.potions?.[activeKey] || state[activeKey] || 0;

  if (!until || until <= now) return 0;

  const remaining = until - now;
  const elapsed = durationMs - remaining;

  return Math.max(0, Math.min(100, (elapsed / durationMs) * 100));
}

function hasPotionMaterials(potion) {
  return Object.entries(potion.costs).every(([key, amount]) => {
    return (state.materials[key] || 0) >= amount;
  });
}

function getPotionTimeLimitHours() {
  return 1 + (state.rebirthUpgrades?.potionLimit || 0);
}

function canAddPotionTime(potion) {
  const now = Date.now();
  const currentUntil = state.potions[potion.activeKey] || 0;
  const currentRemaining = Math.max(0, currentUntil - now);

  return currentRemaining + potion.durationMs <= getMaxPotionTimeMs();
}

function canCraftPotion(potion) {
  return hasPotionMaterials(potion) && canAddPotionTime(potion);
}

function craftPotion(potionKey) {
  const potion = POTIONS.find(p => p.key === potionKey);
  if (!potion) return;

  if (!hasPotionMaterials(potion)) {
    showFilterNotification("sell", `🧪 Not enough essences for ${potion.name}.`);
    return;
  }

  if (!canAddPotionTime(potion)) {
    showFilterNotification(
      "sell",
      `🧪 ${potion.name} cannot exceed the ${getPotionTimeLimitHours()}h active-time limit.`
    );
    return;
  }

  Object.entries(potion.costs).forEach(([key, amount]) => {
    state.materials[key] -= amount;
  });

  const now = Date.now();
  const currentUntil = state.potions[potion.activeKey] || 0;
  state.potions[potion.activeKey] = Math.max(now, currentUntil) + potion.durationMs;

  showFilterNotification("salvage", `🧪 Crafted ${potion.name}.`);

  updateUI();
  renderCraftingPanel();
  renderLeftSpellBox();
  saveGame();
}

function renderCraftingPanel() {
  const materialList = document.getElementById("materialList");
  const potionList = document.getElementById("potionList");

  if (!materialList || !potionList) return;

  const totalEssences = Object.keys(MATERIAL_NAMES).reduce((sum, key) => {
    return sum + (state.materials[key] || 0);
  }, 0);

  const activePotions = POTIONS.filter(potion => potionRemaining(potion.activeKey) > 0).length;

  materialList.innerHTML = `
    <div class="rebirthHero ready">
      <div class="rebirthHeroTop">
        <div>
          <div class="rebirthTitle">⚒ Crafting</div>
          <div class="rebirthSub">
            Use essences from monsters and bosses to craft temporary potion boosts.
          </div>
        </div>

        <div class="rebirthCoinBox">
          <div class="rebirthCoinAmount">${fmt(totalEssences)}</div>
          <div class="rebirthCoinLabel">Essences</div>
        </div>
      </div>
    </div>

    <div class="rebirthShopHeader">
      <div>
        <b>Materials</b>
      </div>
    </div>

    <div class="blacksmithMaterialsGrid">
      ${Object.entries(MATERIAL_NAMES).map(([key, name]) => `
        <div class="uiListCard compact">
          <div class="uiListCardInner">
            <div class="uiListIcon">
              ${essenceDot(key)}
            </div>

            <div class="uiListText">
              <div class="uiListTitle">
                ${name.replace(" Essence", "")}
              </div>
            </div>

            <div class="rebirthBuyBtn uiListAction rightAligned" style="cursor:default;">
              ${fmt(state.materials[key] || 0)}
            </div>
          </div>
        </div>
      `).join("")}
    </div>
  `;

  potionList.innerHTML = `
    <div class="rebirthShopHeader">
      <div>
        <b>Potions</b>
        <span>Craft boosts using essences.</span>
      </div>
    </div>

    ${POTIONS.map(potion => {
      const hasMaterials = hasPotionMaterials(potion);
      const underLimit = canAddPotionTime(potion);
      const craftable = hasMaterials && underLimit;
      const activeTime = potionRemaining(potion.activeKey);

      const costs = Object.entries(potion.costs)
        .map(([key, amount]) => {
          const owned = state.materials[key] || 0;
          const enough = owned >= amount;

          return `
            <span style="
              display:inline-flex;
              align-items:center;
              gap:3px;
              margin-right:8px;
              color:${enough ? "#d9f7c7" : "#ff8c8c"};
              white-space:nowrap;
            ">
              ${essenceDot(key)}${amount}
            </span>
          `;
        })
        .join("");

      let statusText = "Ready";
      let buttonText = "Craft";

      if (!hasMaterials) {
        statusText = "Missing materials";
        buttonText = "Missing";
      } else if (!underLimit) {
        statusText = "Time limit reached";
        buttonText = "Limit";
      } else if (activeTime > 0) {
        statusText = `Active: ${formatCooldown(activeTime)}`;
      }

      return `
        <div class="uiListCard ${craftable ? "" : "locked"}">
          <div class="uiListCardInner">
            <div class="uiListIcon">
              🧪
            </div>

            <div class="uiListText">
              <div class="uiListTitle">${potion.name}</div>
              <div class="uiListSub">${potion.desc}</div>
              <div class="uiListSub">${costs}</div>
              <div class="uiListSub" style="color:${activeTime > 0 ? "#4cff9a" : "#bda76a"};">
                ${statusText}
              </div>
            </div>

            <button
              class="rebirthBuyBtn uiListAction"
              ${craftable ? "" : "disabled"}
              onclick="craftPotion('${potion.key}')"
            >
              ${buttonText}
            </button>
          </div>
        </div>
      `;
    }).join("")}
  `;
}

function renderRewardsPanel() {
  const box = document.getElementById("rewardsContent");
  if (!box) return;

  updateRewardCoins();

  const spinning = state.rewards.slotSpinning;
  const options = state.rewards.slotOptions || [];

  const slotDisplay = spinning
    ? ["❓", "❓", "❓"]
    : options.length
      ? options.map(r => r.icon)
      : ["🍒", "⭐", "💎"];

  box.innerHTML = `
    <div style="background:#171006;border:1px solid #76530f;border-radius:8px;padding:10px;margin-top:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="color:#fff;font-weight:bold;">Slot Machine</div>
          <small>Earn 1 Silver Token every hour. Spin, then pick one of the three rewards.</small>
        </div>
        <div style="text-align:right;">
          <div style="color:#d9d9d9;font-weight:bold;text-shadow:0 0 6px #ffffff;">⚪ ${state.rewards.slotCoins}</div>
          <small>Next: ${formatCooldown(nextSlotCoinRemaining())}</small>
        </div>
      </div>

      <div style="margin-top:8px;font-size:11px;color:#c7a044;">
        Skin Shards: <span style="color:#fff;">${fmt(getSkinShards?.() || 0)}</span>
      </div>

      <div style="margin:12px auto 8px;width:230px;background:#080603;border:2px solid #8b650f;border-radius:10px;padding:10px;box-shadow:inset 0 0 12px #000;">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
          ${slotDisplay.map(icon => `
            <div class="slotReelBox">
              <span class="slotReelIcon">${icon}</span>
            </div>
          `).join("")}
        </div>

        <button class="upgradeBtn" style="margin-top:10px;text-align:center;font-size:13px;" ${state.rewards.slotCoins > 0 && !spinning && options.length === 0 ? "" : "disabled"} onclick="spinSlotMachine()">
          🎰 Pull Lever
        </button>
      </div>

      ${
        options.length > 0
          ? `<div style="margin-top:10px;">
              <div style="color:#ffcf4a;font-weight:bold;margin-bottom:6px;">Pick one reward:</div>
              ${options.map((reward, index) => {
                const tier = getRewardTier(reward);

                return `
                  <button class="upgradeBtn" style="
                    display:flex;
                    align-items:center;
                    gap:8px;
                    padding:7px;
                    margin-top:6px;
                    border-color:${tier.color};
                    box-shadow:0 0 8px ${tier.glow};
                  " onclick="claimSlotReward(${index})">
                    <span style="
                      font-size:24px;
                      width:32px;
                      text-align:center;
                      filter:drop-shadow(0 0 5px ${tier.color});
                    ">${reward.icon}</span>

                    <span style="flex:1;">
                      <span style="color:${tier.color};font-weight:bold;">${reward.name}</span>
                      <span style="
                        font-size:9px;
                        color:${tier.color};
                        margin-left:4px;
                        text-transform:uppercase;
                      ">${tier.name}</span><br>
                      <small>${reward.desc}</small>
                    </span>
                  </button>
                `;
              }).join("")}
            </div>`
          : ""
      }

      <div style="margin-top:12px;border-top:1px solid rgba(139,101,15,.45);padding-top:8px;">
        <button class="upgradeBtn" style="
          text-align:center;
          padding:6px;
          font-size:12px;
          border-color:#bfc7d5;
          color:#e6edf7;
          background:linear-gradient(#272d35, #11151a);
        " onclick="toggleRewardOddsList()">
          ${state.rewards.showOdds ? "Hide Reward Odds" : "Show Reward Odds"}
        </button>

        ${state.rewards.showOdds ? `
          <div style="
            margin-top:8px;
            background:#0b0905;
            border:1px solid #6d4e0d;
            border-radius:8px;
            padding:8px;
            max-height:260px;
            overflow-y:auto;
          ">
            <div style="
              color:#ffcf4a;
              font-weight:bold;
              margin-bottom:6px;
              text-align:center;
            ">
              Possible Rewards
            </div>

            ${SLOT_REWARD_POOL
              .slice()
              .sort((a, b) => a.weight - b.weight)
              .map(reward => {
                const tier = getRewardTier(reward);
                const odds = getRewardOddsPercent(reward);

                return `
                  <div style="
                    display:flex;
                    align-items:center;
                    gap:8px;
                    padding:6px;
                    margin-top:5px;
                    border:1px solid ${tier.color};
                    border-radius:7px;
                    background:linear-gradient(90deg, rgba(255,255,255,.04), rgba(0,0,0,.25));
                    box-shadow:0 0 6px ${tier.glow};
                  ">
                    <div style="
                      width:32px;
                      height:32px;
                      display:grid;
                      place-items:center;
                      border-radius:6px;
                      background:#171006;
                      font-size:22px;
                      filter:drop-shadow(0 0 4px ${tier.color});
                    ">
                      ${reward.icon}
                    </div>

                    <div style="flex:1;min-width:0;">
                      <div style="
                        color:${tier.color};
                        font-size:12px;
                        font-weight:bold;
                        white-space:nowrap;
                        overflow:hidden;
                        text-overflow:ellipsis;
                      ">
                        ${reward.name}
                      </div>
                      <small>${reward.desc}</small>
                    </div>

                    <div style="
                      min-width:54px;
                      text-align:right;
                      color:#fff;
                      font-size:12px;
                      font-weight:bold;
                    ">
                      ${odds}%
                    </div>
                  </div>
                `;
              }).join("")}
          </div>
        ` : ""}
      </div>
    </div>
  `;
}

function renderWeaponList() {
  const list = document.getElementById("weaponList");
  if (!list) return;

  const current = currentWeapon();
  const nextWeapon = WEAPONS.find(w => !ownsWeapon(w.name));
  const ownedCount = WEAPONS.filter(w => ownsWeapon(w.name)).length;

  list.innerHTML = `
    <div class="rebirthHero ready">
      <div class="rebirthHeroTop">
        <div>
          <div class="rebirthTitle">⚔ Weapons</div>
          <div class="rebirthSub">Buy stronger weapons to increase your base damage.</div>
        </div>

        <div class="rebirthCoinBox">
          <div class="rebirthCoinAmount">${ownedCount}/${WEAPONS.length}</div>
          <div class="rebirthCoinLabel">Owned</div>
        </div>
      </div>
    </div>

    ${WEAPONS.map(weapon => {
      const levelUnlocked = state.level >= weapon.levelReq;
      const owned = ownsWeapon(weapon.name);
      const equipped = state.equippedWeapon === weapon.name;
      const affordable = state.gold >= weapon.cost;
      const locked = !levelUnlocked && !owned;

      return `
        <div class="uiListCard ${equipped ? "active" : locked ? "locked" : ""}">
          <div class="uiListCardInner">
            <div class="uiListIcon">
              <img src="${weapon.sprite}" onerror="this.style.display='none';">
            </div>

            <div class="uiListText">
              <div class="uiListTitle">${weapon.name}</div>
              <div class="uiListSub">Damage ${fmt(weapon.min)}-${fmt(weapon.max)}</div>
              <div class="uiListSub">Cost ${fmt(weapon.cost)} gold</div>
              <div class="uiListSub">${levelUnlocked ? `Level ${weapon.levelReq}` : `Requires ${weapon.levelReq}`}</div>
            </div>

            <button
              class="rebirthBuyBtn uiListAction"
              ${locked || equipped ? "disabled" : ""}
              onclick="${owned ? `equipWeapon('${weapon.name}')` : `buyWeapon('${weapon.name}')`}"
            >
              ${equipped ? "Equipped" : owned ? "Equip" : affordable ? "Buy" : "Need Gold"}
            </button>
          </div>
        </div>
      `;
    }).join("")}
  `;
}

function renderZoneList() {
  const list = document.getElementById("zoneList");
  if (!list) return;

  const unlockedZones = ZONES.filter(zone =>
    !zone.isEventZone && state.level >= zone.levelReq
  ).length;

  const totalZones = ZONES.filter(zone => !zone.isEventZone).length;
  const activeStarZoneId = state.starSystem?.activeZoneId;

  list.innerHTML = `
    <div class="rebirthHero ready">
      <div class="rebirthHeroTop">
        <div>
          <div class="rebirthTitle">🗺 Travel</div>
          <div class="rebirthSub">
            Move between hunting zones. Higher zones give better gold, EXP and stronger monsters.
          </div>
        </div>

        <div class="rebirthCoinBox">
          <div class="rebirthCoinAmount">${unlockedZones}/${totalZones}</div>
          <div class="rebirthCoinLabel">Unlocked</div>
        </div>
      </div>
    </div>

    ${ZONES
      .filter(zone => {
        if (zone.id === OBSERVATORY_ZONE_ID) {
          return isObservatoryActive();
        }

        if (zone.id === SIEGE_ZONE_ID) {
          return isSiegeEventActive();
        }

        return true;
      })
      .sort((a, b) => {
        const aEventZone =
          a.id === OBSERVATORY_ZONE_ID ||
          a.id === SIEGE_ZONE_ID;

        const bEventZone =
          b.id === OBSERVATORY_ZONE_ID ||
          b.id === SIEGE_ZONE_ID;

        if (aEventZone && !bEventZone) return -1;
        if (!aEventZone && bEventZone) return 1;

        return a.id - b.id;
      })
      .map(zone => {
        const unlocked =
          state.level >= zone.levelReq;

        const current =
          zone.id === state.zoneId;

        const isStarZone =
          zone.id === activeStarZoneId;

        const golemsPlacedHere =
          state.fishing?.golems?.placedByZone?.[zone.id] || 0;

        const canPlaceGolem =
          !zone.isEventZone &&
          !zone.noMonsters;

        const noAvailableGolems =
          (getTotalPlacedFishingGolems?.() || 0) >=
          (state.fishing?.golems?.owned || 0);

        const mainMonster =
          zone.monsters?.length
            ? [...zone.monsters].sort((a, b) => b.weight - a.weight)[0]
            : {
                name: "No monsters",
                sprite: ""
              };

        return `
          <div class="uiListCard ${current ? "active" : unlocked ? "" : "locked"}">
            <div class="uiListCardInner">

              <div class="uiListIcon">
                <img
                  src="${mainMonster.sprite}"
                  onerror="this.style.display='none';"
                >
              </div>

              <div class="uiListText">

                <div class="uiListTitle">
                  ${zone.name}
                </div>

                <div class="uiListSub">
                  Main: ${mainMonster.name}
                </div>

                <div class="uiListSub">
                  Gold ${fmt(zone.gold?.[0] || 0)}-${fmt(zone.gold?.[1] || 0)}
                  •
                  EXP ${fmt(zone.exp?.[0] || 0)}-${fmt(zone.exp?.[1] || 0)}
                </div>

                <div class="uiListSub">
                  ${
                    zone.isEventZone
                      ? "Event Zone"
                      : unlocked
                        ? `Level ${zone.levelReq}`
                        : `Requires ${zone.levelReq}`
                  }
                </div>

              </div>

              <div class="uiListAction rightAligned">

  <div class="travelActionRow">

    ${isStarZone ? `
      <span class="travelStarTimer">
        ${getStarZoneTimeLeftText()}
      </span>

      <span
        class="travelStarIcon"
        title="Stars are falling here"
      >
        ⭐
      </span>
    ` : ""}

                  <button
                    class="rebirthBuyBtn"
                    ${(!unlocked && !zone.isEventZone) || current ? "disabled" : ""}
                    onclick="travelToZone(${zone.id})"
                  >
                    ${
                      current
                        ? "Current"
                        : unlocked || zone.isEventZone
                          ? "Travel"
                          : "Locked"
                    }
                  </button>

                  ${
                    canPlaceGolem
                      ? `
                        <div class="travelGolemControl compact">

                          <div class="travelGolemIcon">
                            🤖
                          </div>

                          <div class="travelGolemCount">
                            ${fmt(golemsPlacedHere)}
                          </div>

                          <div class="travelGolemButtons">

                            <button
                              onclick="event.stopPropagation(); placeFishingGolemInZone(${zone.id})"
                              ${noAvailableGolems ? "disabled" : ""}
                            >
                              +
                            </button>

                            <button
                              onclick="event.stopPropagation(); removeFishingGolemFromZone(${zone.id})"
                              ${golemsPlacedHere <= 0 ? "disabled" : ""}
                            >
                              -
                            </button>

                          </div>

                        </div>
                      `
                      : ""
                  }

                </div>

              </div>

            </div>
          </div>
        `;
      }).join("")}
  `;
}

// =====================
// STARFORGE SYSTEM
// =====================

function getStarUpgradeCost(key) {
  const level = state.starUpgrades?.[key] || 0;

  const baseCosts = {
    starfall: 5,
    starShower: 10,
    astralShower: 25,

    cosmicWorth: 15,
    stellarYield: 50,
    novaYields: 25,
    giantYields: 25,

    supernovas: 20,
    supergiants: 20,

    starHole: 10
  };

  const growthRates = {
    starfall: 1.17,
    starShower: 1.17,
    astralShower: 1.19,

    cosmicWorth: 1.18,
    stellarYield: 1.21,
    novaYields: 1.18,
    giantYields: 1.18,

    supernovas: 1.17,
    supergiants: 1.17,

    starHole: 1.16
  };

  const base = baseCosts[key] || 10;
  const growth = growthRates[key] || 1.17;

  return Math.floor(base * Math.pow(growth, level));
}

function buyStarUpgrade(key) {
  const maxLevels = {
    starfall: 100,
    starShower: 100,
    astralShower: 100,
    supernovas: 100,
    supergiants: 100,
    novaYields: 100,
    giantYields: 100,
    cosmicWorth: 100,
    starHole: 100
  };

  const level = state.starUpgrades?.[key] || 0;
  const max = maxLevels[key] || 100;

  if (level >= max) {
    addLog("This Starforge upgrade is already maxed.");
    return;
  }

  const cost = getStarUpgradeCost(key);

  if ((state.stars || 0) < cost) {
    addLog("Not enough Stars.");
    return;
  }

  state.stars -= cost;
  state.starUpgrades[key] = level + 1;

  addLog(`Upgraded ${key} to ${level + 1}.`);

  updateStarCurrencyUI();
  refreshStarforgeCurrentTab();
  queueSaveGame();
}

function travelToZone(zoneId) {
  const zone = ZONES.find(z => z.id === zoneId);
  if (!zone) return;

  if (state.level < zone.levelReq) {
    showFilterNotification(
      "sell",
      `🔒 You need level ${zone.levelReq} to travel to ${zone.name}.`
    );
    return;
  }

  state.zoneId = zone.id;

if (zoneId === SIEGE_ZONE_ID && isSiegeEventActive?.()) {
  state.siegeEvent.joined = true;
}

  if (zone.id !== OBSERVATORY_ZONE_ID && !state.visitedZones.includes(zone.id)) {
  state.visitedZones.push(zone.id);
}

  clearMonsters();

  renderZoneList();
  updateUI();
  saveGame();

  showFilterNotification(
    "salvage",
    `🗺 Travelled to ${zone.name}.`
  );
}

function renderSpawnInfo() {
  const title = document.getElementById("spawnInfoTitle");
  const list = document.getElementById("spawnInfoList");
  if (!title || !list) return;

  const zone = currentZone();
  const total = zone.monsters.reduce((sum, monster) => sum + monster.weight, 0);

  title.textContent = `${zone.name} Spawns`;
  list.innerHTML = "";

  zone.monsters.forEach(monster => {
    const chance = total > 0 ? ((monster.weight / total) * 100).toFixed(1) : "0.0";

    const row = document.createElement("div");
    row.className = "spawnInfoLine";
    row.innerHTML = `<span>${monster.name}</span><span class="spawnInfoChance">${chance}%</span>`;

    list.appendChild(row);
  });
}

let skillTreeView = {
  x: 0,
  y: 0,
  zoom: 0.85,
  dragging: false,
  startX: 0,
  startY: 0
};

const viewport = document.createElement("div");
viewport.id = "skillTreeViewport";

const canvas = document.createElement("div");
canvas.id = "skillTreeCanvas";

const world = document.createElement("div");
world.id = "skillTreeWorld";

const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
svg.id = "skillTreeLines";

function getNodeVisualRadius(node) {
  if (node.type === "category") return 70;
  return 48;
}

function getNodeEdgePoint(fromNode, toNode, originX, originY) {
  const fromX = originX + fromNode.x;
  const fromY = originY + fromNode.y;
  const toX = originX + toNode.x;
  const toY = originY + toNode.y;

  const dx = toX - fromX;
  const dy = toY - fromY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance === 0) {
    return { x: fromX, y: fromY };
  }

  const radius = getNodeVisualRadius(fromNode);

  return {
    x: fromX + (dx / distance) * radius,
    y: fromY + (dy / distance) * radius
  };
}

function getSkillEffectText(skillKey, current = 0) {
  const effects = {
    sharpshooter: `Increases Minotaur attack speed. Current bonus: ${current * 8}% faster attacks.`,
    powerBolt: `Increases Minotaur damage. Current bonus: ${current * 20}% damage.`,
    doubleStrike: `Gives Minotaur a chance to hit a second target. Current chance: ${current * 10}%.`,
    tripleStrike: `Gives Minotaur a chance to hit a third target. Current chance: ${current * 5}%.`,
    headshot: `Increases Minotaur critical chance. Current bonus: ${current}%.`,
    strongerBullets: `Increases Minotaur critical damage. Current bonus: ${current * 20}%.`,

    unlockFireball: `Unlocks Fireball.`,
    fireballDamage: `Increases Fireball damage. Current bonus: ${current * 50}%.`,
    fireballCooldown: `Reduces Fireball cooldown. Current reduction: ${current}s.`,

    unlockLightMagic: `Unlocks Light Magic Missile.`,
    lightMagicDamage: `Increases Light Magic Missile damage. Current bonus: ${current * 50}%.`,
    lightMagicCooldown: `Reduces Light Magic Missile cooldown. Current reduction: ${current}s.`,

    unlockHeavyMagic: `Unlocks Heavy Magic Missile.`,
    heavyMagicDamage: `Increases Heavy Magic Missile damage. Current bonus: ${current * 50}%.`,
    heavyMagicCooldown: `Reduces Heavy Magic Missile cooldown. Current reduction: ${current}s.`,

    deepPockets: `Increases gold gained. Current bonus: ${current * 10}%.`,
    experiencedHunter: `Increases experience gained. Current bonus: ${current * 10}%.`,
    materialistic: `Improves material drops. Current bonus: ${current * 5}%.`,
    gearingUp: `Improves equipment drops. Current bonus: ${current * 5}%.`,
    likeABoss: `Improves boss rewards. Current bonus: ${current * 5}%.`,
    lootHungry: `Improves general loot chance. Current bonus: ${current * 5}%.`,
    uberDifficulty: `Unlocks or improves Uber difficulty rewards. Current level: ${current}.`,

    // =====================
    // NECROMANCER (OLD SYSTEM)
    // =====================

    darkNovaDamage: `Increases Necromancer damage. Current bonus: ${current * 20}%.`,
    darkNovaTargets: `Increases number of Necromancer targets. Current bonus: +${current} targets.`,
    decay: `Applies damage over time to enemies hit by Necromancer.`,
    deathEcho: `Necromancer attacks repeat after a short delay. Current chance: ${current * 10}%.`,
    overchannel: `Increases Necromancer damage but reduces attack speed. Current bonus: ${current * 25}% damage.`,

    graveCalling: `Allows Necromancer to summon skeletons.`,
    skeletonMastery: `Increases skeleton damage and maximum skeleton count. Current bonus: ${current * 20}% damage.`,
    skeletonReach: `Increases skeleton attack range. Current bonus: ${current * 15}%.`,
    walkingDead: `Increases skeleton movement speed. Current bonus: ${current * 10}%.`,
    reanimation: `Chance to summon an extra skeleton. Current chance: ${current * 10}%.`,
    eliteSkeleton: `Chance to summon stronger skeletons. Current chance: ${current * 10}%.`,
    boneArmor: `Each skeleton increases Necromancer damage. Current bonus: ${current * 5}% per skeleton.`
  };

  return effects[skillKey] || "No effect description set yet.";
}

function ensureSkillTooltip() {
  let tooltip = document.getElementById("skillTooltip");

  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "skillTooltip";
    tooltip.style.display = "none";
  }

  document.body.appendChild(tooltip);

  tooltip.style.position = "fixed";
  tooltip.style.pointerEvents = "none";
  tooltip.style.zIndex = "99999999";

  return tooltip;
}

function getSkillBaseText(skillKey) {
  const texts = {
    sharpshooter: "Increases Minotaur attack speed.",
    powerBolt: "Increases Minotaur damage.",
    doubleStrike: "Gives Minotaur a chance to hit a second target.",
    tripleStrike: "Gives Minotaur a chance to hit a third target.",
    headshot: "Increases Minotaur critical chance.",
    strongerBullets: "Increases Minotaur critical damage.",

    battleRhythm: "Consecutive hits on the same target increase damage.",
    openingStrike: "First hit on a monster deals bonus damage.",
    executionerShot: "Attacks deal bonus damage to low-health monsters.",
    burstArrow: "Attacks deal small area damage around the target.",
    focusedDouble: "Double Strike hits the same target twice.",
    followUp: "The second Double Strike arrow has increased critical chance.",
    focusedBarrage: "Triple Strike fires all arrows into the same target.",
    piercingShot: "Arrows pass through enemies with reduced damage.",
    guillotine: "Attacks instantly kill very low-health monsters.",
    bleedingCritical: "Critical hits apply a bleeding damage-over-time effect.",
    overkill: "Excess damage spills to one nearby enemy.",
    ricochet: "Critical hits bounce to one nearby enemy.",

    unlockFireball: "Unlocks Fireball.",
    fireballDamage: "Increases Fireball damage.",
    fireballCooldown: "Reduces Fireball cooldown.",

    unlockLightMagic: "Unlocks Light Magic Missile.",
    lightMagicDamage: "Increases Light Magic Missile damage.",
    lightMagicCooldown: "Reduces Light Magic Missile cooldown.",

    unlockHeavyMagic: "Unlocks Heavy Magic Missile.",
    heavyMagicDamage: "Increases Heavy Magic Missile damage.",
    heavyMagicCooldown: "Reduces Heavy Magic Missile cooldown.",

    deepPockets: "Increases gold gained.",
    experiencedHunter: "Increases experience gained.",
    materialistic: "Improves material drops.",
    gearingUp: "Improves equipment drops.",
    likeABoss: "Improves boss rewards.",
    lootHungry: "Improves general loot chance.",
    uberDifficulty: "Unlocks or improves Uber difficulty rewards.",

    // =====================
    // NECROMANCER (OLD SYSTEM)
    // =====================

    darkNovaDamage: "Increases Necromancer damage.",
    darkNovaTargets: "Increases number of Necromancer targets.",
    decay: "Applies damage over time to enemies hit by Necromancer.",
    deathEcho: "Necromancer attacks can repeat after a delay.",
    overchannel: "Increases Necromancer damage but reduces attack speed.",

    graveCalling: "Allows Necromancer to summon skeletons.",
    skeletonMastery: "Increases skeleton damage and maximum skeleton count.",
    skeletonReach: "Increases skeleton attack range.",
    walkingDead: "Increases skeleton movement speed.",
    reanimation: "Chance to summon additional skeletons.",
    eliteSkeleton: "Chance to summon stronger skeletons.",
    boneArmor: "Each active skeleton increases Necromancer damage."
  };

  return texts[skillKey] || "No description set yet.";
}

function getSkillCurrentBonusText(skillKey, current = 0) {
  const bonuses = {
    sharpshooter: `${current * 8}% faster attacks`,
    powerBolt: `${current * 20}% damage`,
    doubleStrike: `${current * 10}% chance`,
    tripleStrike: `${current * 5}% chance`,
    headshot: `${current}% crit chance`,
    strongerBullets: `${current * 20}% crit damage`,
	
	battleRhythm: current > 0 ? "Enabled: +5% damage per consecutive hit, up to 50%." : "Not selected",
	openingStrike: current > 0 ? "Enabled: first hit deals 50% bonus damage." : "Not selected",
	executionerShot: current > 0 ? "Enabled: +40% damage against monsters below 30% HP." : "Not selected",
	burstArrow: current > 0 ? "Enabled: 30% splash damage around target." : "Not selected",
	focusedDouble: current > 0 ? "Enabled: both Double Strike arrows hit the same target." : "Not selected",
	followUp: current > 0 ? "Enabled: second arrow gains +25% critical chance." : "Not selected",
	focusedBarrage: current > 0 ? "Enabled: all Triple Strike arrows hit the same target." : "Not selected",
	piercingShot: current > 0 ? "Enabled: arrows pierce enemies with 25% reduced damage." : "Not selected",
	guillotine: current > 0 ? "Enabled: instantly kills monsters below 15% HP. Does not trigger on multi-hit attacks." : "Not selected",
	bleedingCritical: current > 0 ? "Enabled: critical hits bleed for 30% damage over 3 seconds." : "Not selected",
	overkill: current > 0 ? "Enabled: excess damage spills to one nearby enemy." : "Not selected",
	ricochet: current > 0 ? "Enabled: critical hits bounce once. Bounce cannot crit or trigger effects." : "Not selected",

    unlockFireball: current > 0 ? "Fireball unlocked" : "Not unlocked",
    fireballDamage: `${current * 50}% damage`,
    fireballCooldown: `${current}s cooldown reduction`,

    unlockLightMagic: current > 0 ? "Light Magic Missile unlocked" : "Not unlocked",
    lightMagicDamage: `${current * 50}% damage`,
    lightMagicCooldown: `${current}s cooldown reduction`,

    unlockHeavyMagic: current > 0 ? "Heavy Magic Missile unlocked" : "Not unlocked",
    heavyMagicDamage: `${current * 50}% damage`,
    heavyMagicCooldown: `${current}s cooldown reduction`,

    deepPockets: `${current * 10}% gold gain`,
    experiencedHunter: `${current * 10}% experience gain`,
    materialistic: `${current * 5}% material drop bonus`,
    gearingUp: `${current * 5}% equipment drop bonus`,
    likeABoss: `${current * 5}% boss reward bonus`,
    lootHungry: `${current * 5}% loot chance`,
    uberDifficulty: `Level ${current}`,
	
	darkNovaDamage: `+${current * 20}% Necromancer damage`,
	darkNovaTargets: `+${current} Necromancer targets`,
	decay: current > 0 ? `Decay unlocked` : `Not unlocked`,
	deathEcho: `${current * 10}% chance to repeat Necromancer attacks`,
	overchannel: `+${current * 25}% Necromancer damage, slower attacks`,

	graveCalling: current > 0 ? `Skeleton summoning unlocked` : `Not unlocked`,
	skeletonMastery: `+${current * 20}% skeleton damage`,
	skeletonReach: `+${current * 10} skeleton attack range`,
	walkingDead: `+${current * 10}% skeleton attack speed`,
	reanimation: `${current * 10}% chance to summon extra skeletons`,
	eliteSkeleton: `${current * 10}% chance to summon elite skeletons`,
	boneArmor: `+${current * 5}% Necromancer damage per skeleton`
  };

  return bonuses[skillKey] || "No current bonus.";
}

function showSkillTooltip(event, nodeId) {
  const node = SKILL_NODES[nodeId];
  if (!node) return;

  const tooltip = ensureSkillTooltip();

  let html = "";

  if (node.type === "category") {
    let points = 0;
    let unlockText = "";

    if (node.branch === "minotaur") {
      points = getCategoryPoints("minotaur");
      unlockText = "Increase the power of your minotaur!";
    } else if (node.branch === "spells") {
      points = getCategoryPoints("spells");
      unlockText = "Unlock powerful spells!";
    } else if (node.branch === "economy") {
      points = getCategoryPoints("economy");
      unlockText = "Economy improves rewards, loot, and progression speed!";
    }

    html = `
      <div class="tooltipTitle">${node.label}</div>
      <div class="tooltipDesc">Category: ${node.branch}</div>
      <div class="tooltipSection">
        <div class="tooltipLabel">Category Points</div>
        <b>${points}</b>
      </div>
      <div class="tooltipSection">${unlockText}</div>
    `;
  } else {
    const skillDef = getSkillDef(node.skill);
    const current = state.skills?.[node.skill] || 0;
    const max = getSkillMax(skillDef);
    const available = canUnlockNode(nodeId);

    html = `
      <div class="tooltipTitle">
        ${node.label}
        <span class="tooltipLevel">${current}/${max}</span>
      </div>

      <div class="tooltipDesc">
  ${getSkillBaseText(node.skill)}
</div>

<div class="tooltipSection">
  <div class="tooltipLabel">Current Bonus</div>
  ${getSkillCurrentBonusText(node.skill, current)}
</div>

      <div class="tooltipSection">
        <div class="tooltipLabel">Status</div>
        ${
          current >= max
            ? `<span class="tooltipMax">Maxed</span>`
            : available
              ? `<span class="tooltipReady">Available</span>`
              : `<span class="tooltipLocked">Locked</span>`
        }
      </div>

      <div class="tooltipSection">
        <div class="tooltipLabel">Next Level</div>
        ${
          current >= max
            ? `No further upgrades.`
            : getSkillEffectText(node.skill, current + 1)
        }
      </div>
    `;
  }

  tooltip.innerHTML = html;
  tooltip.style.display = "block";
  moveSkillTooltip(event);
}

function hideSkillTooltip() {
  const tooltip = document.getElementById("skillTooltip");
  if (tooltip) tooltip.style.display = "none";
}

function clampSkillTreeView() {
  const viewport = document.getElementById("skillTreeViewport");
  const world = document.getElementById("skillTreeWorld");

  if (!viewport || !world) return;

  const viewportWidth = viewport.clientWidth;
  const viewportHeight = viewport.clientHeight;

  const worldWidth = world.offsetWidth * skillTreeView.zoom;
  const worldHeight = world.offsetHeight * skillTreeView.zoom;

  // If world is larger than viewport, prevent dragging past edges.
  if (worldWidth > viewportWidth) {
    const minX = viewportWidth - worldWidth;
    const maxX = 0;
    skillTreeView.x = Math.max(minX, Math.min(maxX, skillTreeView.x));
  } else {
    skillTreeView.x = (viewportWidth - worldWidth) / 2;
  }

  if (worldHeight > viewportHeight) {
    const minY = viewportHeight - worldHeight;
    const maxY = 0;
    skillTreeView.y = Math.max(minY, Math.min(maxY, skillTreeView.y));
  } else {
    skillTreeView.y = (viewportHeight - worldHeight) / 2;
  }
}

function centerSkillTreeOnNode(nodeId, originX, originY) {
  const viewport = document.getElementById("skillTreeViewport");
  const node = SKILL_NODES[nodeId];

  if (!viewport || !node) return;

  const nodeX = originX + node.x;
  const nodeY = originY + node.y;

  skillTreeView.zoom = 0.85;
  skillTreeView.x = viewport.clientWidth / 2 - nodeX * skillTreeView.zoom;
  skillTreeView.y = viewport.clientHeight / 2 - nodeY * skillTreeView.zoom;

  applySkillTreeTransform();
}

function camelToSnakeCase(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function getSkillTreeNodeIcon(node) {
  if (node.type === "category") {
    const categoryIcons = {
      minotaur: "🏹",
      spells: "🔥",
      economy: "💰",
      necromancer: "☠️"
    };

    return categoryIcons[node.branch] || "⭐";
  }

  const skillIcons = {
    sharpshooter: "🎯",
    powerBolt: "🏹",
    doubleStrike: "⚔️",
    tripleStrike: "⚔️",
    headshot: "💥",
    strongerBullets: "🔩",

    unlockFireball: "🔥",
    fireballDamage: "🔥",
    fireballCooldown: "⏱️",
    unlockLightMagic: "✨",
    lightMagicDamage: "✨",
    lightMagicCooldown: "⏱️",
    unlockHeavyMagic: "☄️",
    heavyMagicDamage: "☄️",
    heavyMagicCooldown: "⏱️",

    deepPockets: "💰",
    experiencedHunter: "📘",
    materialistic: "💎",
    gearingUp: "🛡️",
    likeABoss: "👑",
    lootHungry: "🎁",
    uberDifficulty: "💀",

    darkNovaDamage: "🌑",
    darkNovaTargets: "🌌",
    decay: "🦠",
    deathEcho: "🔊",
    overchannel: "⚡",
    graveCalling: "🪦",
    skeletonReach: "🦴",
    skeletonMastery: "☠️",
    walkingDead: "🧟",
    reanimation: "♻️",
    eliteSkeleton: "💀",
    boneArmor: "🛡️"
  };

  return skillIcons[node.skill] || "⭐";
}

function renderSkillTree() {
  const content = document.getElementById("skillTreeContent");
  if (!content) return;

  if (!Array.isArray(state.unlockedNodes)) {
    state.unlockedNodes = ["minotaur_category"];
  }

  if (!state.unlockedNodes.includes("minotaur_category")) {
    state.unlockedNodes.push("minotaur_category");
  }

  const hasNecromancer = state.rebirthUpgrades?.necromancer > 0;

  const visibleSkillNodes = Object.entries(SKILL_NODES).filter(([id, node]) => {
    if (id === "necromancer_category" || node.branch === "necromancer") {
      return hasNecromancer;
    }

    return true;
  });

  const WORLD_WIDTH = 3600;
  const WORLD_HEIGHT = hasNecromancer ? 4600 : 4200;

  const nodesArray = visibleSkillNodes.map(([id, node]) => node);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  nodesArray.forEach(node => {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y);
  });

  const treeWidth = maxX - minX;
  const treeHeight = maxY - minY;

  const treeCenterX = minX + treeWidth / 2;
  const treeCenterY = minY + treeHeight / 2;

  const ORIGIN_X = WORLD_WIDTH / 2 - treeCenterX;
  const ORIGIN_Y = WORLD_HEIGHT / 2 - treeCenterY;

  currentSkillTreeOrigin.x = ORIGIN_X;
  currentSkillTreeOrigin.y = ORIGIN_Y;

  content.innerHTML = `
    <div class="skillTreeToolbar">
      <button onclick="zoomSkillTree(0.1)">+</button>
      <button onclick="zoomSkillTree(-0.1)">-</button>
      <button onclick="resetSkillTreeView()">Reset</button>
    </div>
    <div
      id="skillTreeViewport"
      onmousedown="startSkillTreeDrag(event)"
      onmousemove="dragSkillTree(event)"
      onmouseup="stopSkillTreeDrag()"
      onmouseleave="stopSkillTreeDrag()"
      onwheel="wheelZoomSkillTree(event)"
    >
      <div id="skillTreeCanvas">
        <div id="skillTreeWorld">
          <svg id="skillTreeLines"></svg>
        </div>
      </div>
    </div>
  `;

  const viewport = document.getElementById("skillTreeViewport");
  const world = document.getElementById("skillTreeWorld");
  const svg = document.getElementById("skillTreeLines");

  if (!viewport || !world || !svg) return;

  world.style.width = `${WORLD_WIDTH}px`;
  world.style.height = `${WORLD_HEIGHT}px`;

  svg.setAttribute("width", WORLD_WIDTH);
  svg.setAttribute("height", WORLD_HEIGHT);
  svg.style.width = `${WORLD_WIDTH}px`;
  svg.style.height = `${WORLD_HEIGHT}px`;

  world.classList.add("skillTreeGeneratedBackground");

  // =====================
  // DRAW CONNECTION LINES
  // =====================

  visibleSkillNodes.forEach(([id, node]) => {
    node.connectsTo.forEach(targetId => {
      const targetEntry = visibleSkillNodes.find(([visibleId]) => visibleId === targetId);
      if (!targetEntry) return;

      const target = targetEntry[1];
      if (!target) return;

      const start = getNodeEdgePoint(node, target, ORIGIN_X, ORIGIN_Y);
      const end = getNodeEdgePoint(target, node, ORIGIN_X, ORIGIN_Y);

      let progress = 0;

      if (id === "minotaur_category" && targetId === "spells_category") {
  progress = Math.min(1, getCategoryPoints("minotaur") / MINOTAUR_TO_SPELLS_REQUIREMENT);
} else if (id === "spells_category" && targetId === "economy_category") {
  progress = Math.min(1, getCategoryPoints("spells") / SPELLS_TO_ECONOMY_REQUIREMENT);
} else if (id === "economy_category" && targetId === "necromancer_category") {
  progress = state.rebirthUpgrades?.necromancer > 0
    ? Math.min(1, getCategoryPoints("economy") / ECONOMY_TO_NECROMANCER_REQUIREMENT)
    : 0;
} else if (node.type === "category" && target.type === "skill") {
        progress = (state.skills?.[target.skill] || 0) > 0 ? 1 : 0;
      } else if (node.type === "skill" && target.type === "skill") {
        progress = (state.skills?.[target.skill] || 0) > 0 ? 1 : 0;
      } else {
        progress = canUnlockNode(targetId) ? 1 : 0;
      }

      const baseLine = document.createElementNS("http://www.w3.org/2000/svg", "line");

      baseLine.setAttribute("x1", start.x);
      baseLine.setAttribute("y1", start.y);
      baseLine.setAttribute("x2", end.x);
      baseLine.setAttribute("y2", end.y);

      baseLine.classList.add("skillTreeLine", "inactiveLine");

      svg.appendChild(baseLine);

      if (progress > 0) {
        const activeX2 = start.x + (end.x - start.x) * progress;
        const activeY2 = start.y + (end.y - start.y) * progress;

        const activeLine = document.createElementNS("http://www.w3.org/2000/svg", "line");

        activeLine.setAttribute("x1", start.x);
        activeLine.setAttribute("y1", start.y);
        activeLine.setAttribute("x2", activeX2);
        activeLine.setAttribute("y2", activeY2);

        activeLine.classList.add("skillTreeLine", "activeLine");

        const branchClass = getSkillBranchClass(target) || getSkillBranchClass(node);
        if (branchClass) {
          activeLine.classList.add(branchClass);
        }

        if (progress < 1) {
          activeLine.classList.add("progressLine");
        }

        svg.appendChild(activeLine);
      }
    });
  });

  // =====================
  // DRAW NODES
  // =====================

  visibleSkillNodes.forEach(([id, node]) => {
    const nodeEl = document.createElement("button");

    const isCategory = node.type === "category";
    const isAvailable = canUnlockNode(id);

    let current = 0;
    let max = 1;
    let skillDef = null;

    if (node.skill) {
      skillDef = getSkillDef(node.skill);
      current = state.skills?.[node.skill] || 0;
      max = getSkillMax(skillDef);
    }

    const isInvested = node.skill && current > 0;
    const isMaxed = node.skill && current >= max;
    const isLocked = !isAvailable;
    const isCategoryUnlocked = isCategory && isAvailable;

    nodeEl.className = [
      "skillNode",
      isCategory ? "category" : "skill",
      skillDef?.modifier ? "modifierNode" : "",
      getSkillBranchClass(node),
      isLocked ? "locked" : "",
      isAvailable && !isMaxed && !isCategory ? "available" : "",
      isInvested ? "invested" : "",
      isMaxed ? "maxed" : "",
      isCategoryUnlocked ? "categoryUnlocked" : ""
    ].filter(Boolean).join(" ");

    nodeEl.style.left = `${ORIGIN_X + node.x}px`;
    nodeEl.style.top = `${ORIGIN_Y + node.y}px`;

    let pointsText = "";

    if (node.skill) {
      pointsText = `<div class="skillNodeLevel">${current}/${max}</div>`;
    }

    nodeEl.innerHTML = `
      <div class="skillNodeFrame"></div>
      <div class="skillNodeIcon"></div>
      <span class="skillNodeLabel">${node.label}</span>
      ${pointsText}
    `;

    const iconEl = nodeEl.querySelector(".skillNodeIcon");

if (iconEl) {
  iconEl.style.backgroundImage = "none";
  iconEl.textContent = getSkillTreeNodeIcon(node);
}

    nodeEl.onclick = () => clickSkillNode(id);

    nodeEl.oncontextmenu = event => {
      event.preventDefault();
      refundSkillNode(id);
    };

    nodeEl.onmouseenter = event => showSkillTooltip(event, id);
    nodeEl.onmousemove = event => moveSkillTooltip(event);
    nodeEl.onmouseleave = () => hideSkillTooltip();

    world.appendChild(nodeEl);
  });

  if (!skillTreeView.hasOpenedOnce) {
    requestAnimationFrame(() => {
      centerSkillTreeOnNode("minotaur_category", ORIGIN_X, ORIGIN_Y);
      skillTreeView.hasOpenedOnce = true;
    });
  } else {
    applySkillTreeTransform();
  }
}

function drawSkillConnections(originX, originY) {
  const svg = document.getElementById("skillTreeLines");
  if (!svg) return;

  svg.innerHTML = "";

  Object.values(SKILL_NODES).forEach(node => {
    (node.connectsTo || []).forEach(targetId => {
      const target = SKILL_NODES[targetId];
      if (!target) return;

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");

      line.setAttribute("x1", originX + node.x);
      line.setAttribute("y1", originY + node.y);
      line.setAttribute("x2", originX + target.x);
      line.setAttribute("y2", originY + target.y);
      line.setAttribute("class", "skillTreeLine");

      const cls = getSkillBranchClass(node);
      if (cls) line.classList.add(cls);

      svg.appendChild(line);
    });
  });
}

function moveSkillTooltip(event) {
  const tooltip = ensureSkillTooltip();

  const offsetX = 18;
  const offsetY = 18;

  let x = event.clientX + offsetX;
  let y = event.clientY + offsetY;

  const rect = tooltip.getBoundingClientRect();

  if (x + rect.width > window.innerWidth) {
    x = event.clientX - rect.width - offsetX;
  }

  if (y + rect.height > window.innerHeight) {
    y = event.clientY - rect.height - offsetY;
  }

  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function applySkillTreeTransform() {
  const world = document.getElementById("skillTreeWorld");
  if (!world) return;

  clampSkillTreeView();

  world.style.transform = `translate(${skillTreeView.x}px, ${skillTreeView.y}px) scale(${skillTreeView.zoom})`;
}

function startSkillTreeDrag(event) {
  skillTreeView.dragging = true;
  skillTreeView.lastX = event.clientX;
  skillTreeView.lastY = event.clientY;
}

function dragSkillTree(event) {
  if (!skillTreeView.dragging) return;

  skillTreeView.x += event.clientX - skillTreeView.lastX;
  skillTreeView.y += event.clientY - skillTreeView.lastY;

  skillTreeView.lastX = event.clientX;
  skillTreeView.lastY = event.clientY;

  applySkillTreeTransform();
}

function stopSkillTreeDrag() {
  skillTreeView.dragging = false;
}

function zoomSkillTree(amount) {
  const viewport = document.getElementById("skillTreeViewport");
  if (!viewport) return;

  const oldZoom = skillTreeView.zoom;
  const newZoom = Math.max(0.35, Math.min(1.4, oldZoom + amount));

  const centerX = viewport.clientWidth / 2;
  const centerY = viewport.clientHeight / 2;

  const worldCenterX = (centerX - skillTreeView.x) / oldZoom;
  const worldCenterY = (centerY - skillTreeView.y) / oldZoom;

  skillTreeView.zoom = newZoom;
  skillTreeView.x = centerX - worldCenterX * newZoom;
  skillTreeView.y = centerY - worldCenterY * newZoom;

  applySkillTreeTransform();
}

function wheelZoomSkillTree(event) {
  event.preventDefault();

  const amount = event.deltaY < 0 ? 0.08 : -0.08;
  zoomSkillTree(amount);
}

function renderPanelById(id) {
  if (id === "weaponsPanel") renderWeaponList();
  if (id === "travelPanel") renderZoneList();
  if (id === "upgradePanel") renderSkillTree();
  if (id === "craftingPanel") renderCraftingPanel();
  if (id === "researchPanel") renderResearchPanel();
  if (id === "rewardsPanel") renderRewardsPanel();
  if (id === "depotPanel") { renderDepotPanel(); renderLoadoutsPanel?.();}
  if (id === "statsPanel") renderStatsPanel();
  if (id === "scorePanel") renderScorePanel();
  if (id === "rebirthPanel") renderRebirthMenu();
  if (id === "rebirthShopPanel") renderRebirthShop();
  if (id === "blacksmithPanel") renderBlacksmithPanel();
  if (id === "settingsPanel") renderSettingsPanel();
  if (id === "starforgePanel") renderStarforgePanel();

  injectPanelHero(id);
}

function closePanels(exceptId) {
  ["weaponsPanel", "travelPanel", "upgradePanel", "testingPanel", "craftingPanel", "rewardsPanel", "depotPanel", "statsPanel", "scorePanel", "rebirthPanel", "rebirthShopPanel", "settingsPanel", "blacksmithPanel", "researchPanel", "starforgePanel", "skinsPanel", "fishingPanel"].forEach(id => {
    if (id !== exceptId) {
      const panel = document.getElementById(id);
      if (panel) panel.style.display = "none";
    }
  });

  if (exceptId !== "depotPanel") {
    document.getElementById("depotLoadoutWrapper")?.classList.remove("open");
  }
}

function togglePanel(id) {
  closePanels(id);

  const panel = document.getElementById(id);
  if (!panel) return;

  const wrapper = document.getElementById("depotLoadoutWrapper");

  const shouldOpen = id === "depotPanel"
    ? !wrapper?.classList.contains("open")
    : panel.style.display !== "block";

  if (id === "depotPanel") {
    panel.style.display = shouldOpen ? "block" : "none";

    if (shouldOpen) {
      renderDepotTabs?.();
      renderDepotPanel?.();
      renderLoadoutsPanel?.();
      document.getElementById("depotLoadoutWrapper")?.classList.add("open");
    } else {
      document.getElementById("depotLoadoutWrapper")?.classList.remove("open");
    }
  } else {
    panel.style.display = shouldOpen ? "block" : "none";

    if (shouldOpen) {
      renderPanelById(id);
    }
  }

  updateMenuIndicators();
}

function renderResearchCard(monsterName) {
  const progress = state.monsterResearch?.[monsterName] || {
    kills: 0,
    unlocked: []
  };

  const kills = progress.kills || 0;
  const unlockedCount = progress.unlocked?.length || 0;
  const completed = unlockedCount >= RESEARCH_MILESTONES.length;
  const discovered = kills > 0;

  const nextMilestone = RESEARCH_MILESTONES.find((milestone, index) =>
    !progress.unlocked.includes(index)
  );

  const nextKills = nextMilestone
    ? nextMilestone.kills
    : RESEARCH_MILESTONES[RESEARCH_MILESTONES.length - 1].kills;

  const progressPercent = completed
    ? 100
    : Math.min(100, (kills / nextKills) * 100);

  const sprite = getMonsterSpriteByName(monsterName);

  return `
    <div
      class="researchSquareCard ${completed ? "complete" : discovered ? "discovered" : "unknown"}"
      onmouseenter="showResearchTooltip('${monsterName.replace(/'/g, "\\'")}', event.clientX, event.clientY)"
      onmousemove="moveResearchTooltip(event.clientX, event.clientY)"
      onmouseleave="hideResearchTooltip()"
    >
      <div class="researchSquareName">
        ${discovered ? monsterName : "Unknown"}
      </div>

      <div class="researchSquareSpriteBox">
        ${
          discovered
            ? `<img src="${sprite}" class="researchSquareSprite" onerror="this.style.display='none';">`
            : `<div class="researchSquareUnknown">?</div>`
        }
      </div>

      <div class="researchSquareProgressText">
        ${discovered ? `${fmt(kills)} / ${fmt(nextKills)}` : "? / ?"}
      </div>

      <div class="researchSquareBar">
        <div class="researchSquareFill" style="width:${progressPercent}%"></div>
      </div>

      <div class="researchSquareUnlocks">
        ${completed ? "✓ Complete" : `${unlockedCount} / ${RESEARCH_MILESTONES.length}`}
      </div>
    </div>
  `;
}

function showResearchTooltip(monsterName, x, y) {
  let tooltip = document.getElementById("researchTooltip");

  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "researchTooltip";
    document.body.appendChild(tooltip);
  }

  const progress = state.monsterResearch?.[monsterName] || {
    kills: 0,
    unlocked: []
  };

  const unlocked = progress.unlocked || [];

  const unlockedHtml = unlocked.length
    ? unlocked.map(index => {
        const milestone = RESEARCH_MILESTONES[index];
        return `<div style="color:#4cff9a;">✓ ${fmt(milestone.kills)} — ${milestone.desc}</div>`;
      }).join("")
    : `<div class="muted">No bonuses unlocked yet.</div>`;

  const next = RESEARCH_MILESTONES.find((m, index) => !unlocked.includes(index));

  tooltip.innerHTML = `
    <div style="color:#ffcf4a;font-weight:bold;margin-bottom:4px;">
      ${monsterName}
    </div>

    <div>Kills: <span style="color:white;">${fmt(progress.kills || 0)}</span></div>

    <div style="margin-top:6px;color:#ffcf4a;">Unlocked Bonuses</div>
    ${unlockedHtml}

    <div style="margin-top:6px;color:#ffcf4a;">Next Bonus</div>
    ${
      next
        ? `<div>${fmt(next.kills)} kills — ${next.desc}</div>`
        : `<div style="color:#4cff9a;">Completed</div>`
    }
  `;

  tooltip.style.display = "block";
  moveResearchTooltip(x, y);
}

function moveResearchTooltip(x, y) {
  const tooltip = document.getElementById("researchTooltip");
  if (!tooltip) return;

  tooltip.style.left = x + 14 + "px";
  tooltip.style.top = y + 14 + "px";
}

function hideResearchTooltip() {
  const tooltip = document.getElementById("researchTooltip");
  if (tooltip) tooltip.style.display = "none";
}

function showResearchDetails(monsterName) {
  const progress = state.monsterResearch?.[monsterName] || {
    kills: 0,
    unlocked: []
  };

  const unlocked = progress.unlocked || [];

  showFilterNotification(
    "salvage",
    `📖 ${monsterName}: ${fmt(progress.kills || 0)} kills, ${unlocked.length}/${RESEARCH_MILESTONES.length} bonuses`
  );
}

function renderResearchPanel() {
  const box = document.getElementById("researchContent");
  if (!box) return;

  if (!state.monsterResearch) state.monsterResearch = {};

  const allMonsters = ALL_MONSTER_NAMES.length ? ALL_MONSTER_NAMES : [...new Set(
    ZONES.flatMap(zone => zone.monsters.map(monster => monster.name))
  )];

  const filteredMonsters = allMonsters.filter(name =>
    name.toLowerCase().includes((researchSearch || "").toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredMonsters.length / RESEARCH_PER_PAGE));

  if (researchPage >= totalPages) researchPage = totalPages - 1;
  if (researchPage < 0) researchPage = 0;

  const start = researchPage * RESEARCH_PER_PAGE;
  const pageMonsters = filteredMonsters.slice(start, start + RESEARCH_PER_PAGE);

  box.innerHTML = `

      <div class="bestiaryGrid">
        ${pageMonsters.map(monsterName => renderResearchCard(monsterName)).join("")}
      </div>

      <div class="bestiaryFooter">
        <div class="bestiaryPageControls">
          <button onclick="researchPage = Math.max(0, researchPage - 1); renderResearchPanel();">◀</button>
          <span>${researchPage + 1} / ${totalPages}</span>
          <button onclick="researchPage = Math.min(${totalPages - 1}, researchPage + 1); renderResearchPanel();">▶</button>
        </div>

        <input
          class="bestiarySearch"
          id="researchSearchInput"
          placeholder="Type to search"
        >
      </div>
    </div>
  `;

  const input = document.getElementById("researchSearchInput");

  if (input) {
    input.value = researchSearch || "";

    input.oninput = e => {
      researchSearch = e.target.value;
      researchPage = 0;
      renderResearchPanel();

      setTimeout(() => {
        const newInput = document.getElementById("researchSearchInput");
        if (newInput) {
          newInput.focus();
          newInput.setSelectionRange(researchSearch.length, researchSearch.length);
        }
      }, 0);
    };
  }
}

function renderDepotPanel() {
  const grid = document.getElementById("depotGrid");
  if (!grid) return;

injectPanelHero?.("depotPanel");

  normalizeLoadouts();

  const activeTab = state.depot.activeTab || 0;

if (!state.depot.tabs) {
  state.depot.tabs = [[]];
}

while (state.depot.tabs.length <= activeTab) {
  state.depot.tabs.push([]);
}

const items = state.depot.tabs[activeTab];

  ensureFilters();

  const hasAutoSalvage = state.rebirthUpgrades?.autoSalvage > 0;
  const hasAutoSell = state.rebirthUpgrades?.autoSell > 0;

  document.querySelectorAll(".depotTab").forEach(btn => {
    btn.classList.toggle("active", Number(btn.dataset.depotTab) === activeTab);
  });

  const depotPanel = document.getElementById("depotPanel");

let bulkActions = document.getElementById("depotBulkActions");
if (!bulkActions && depotPanel) {
  bulkActions = document.createElement("div");
  bulkActions.id = "depotBulkActions";

  const depotGrid = document.getElementById("depotGrid");
  depotPanel.insertBefore(bulkActions, depotGrid);
}

  if (bulkActions) {
    bulkActions.innerHTML = `
      <button onclick="sellCurrentDepotTab()">Sell Tab</button>
      <button onclick="salvageCurrentDepotTab()">Salvage Tab</button>

      ${(hasAutoSalvage || hasAutoSell) ? `
        <div class="depotFilterBox">
          <div class="depotFilterTitle">Auto Filter</div>

          <div class="depotFilterButtons">
            <button class="${state.filters.equipmentAction === "none" ? "depotFilterOn" : ""}" onclick="setEquipmentFilterAction('none'); renderDepotPanel();">
              OFF
            </button>

            ${hasAutoSalvage ? `
              <button class="${state.filters.equipmentAction === "salvage" ? "depotFilterOn" : ""}" onclick="toggleEquipmentFilterAction('salvage')">
                Salvage
              </button>
            ` : ""}

            ${hasAutoSell ? `
              <button class="${state.filters.equipmentAction === "sell" ? "depotFilterOn" : ""}" onclick="toggleEquipmentFilterAction('sell')">
                Sell
              </button>
            ` : ""}
          </div>

          <div class="depotFilterTitle" style="margin-top:6px;">Rarity Limit</div>

          <div class="depotFilterButtons">
            <button class="${state.filters.rarityLimit === "common" ? "depotFilterOn" : ""}" onclick="setEquipmentRarityLimit('common')">
              Common only
            </button>

            <button class="${state.filters.rarityLimit === "uncommon" ? "depotFilterOn" : ""}" onclick="setEquipmentRarityLimit('uncommon')">
              Up to Uncommon
            </button>

            <button class="${state.filters.rarityLimit === "rare" ? "depotFilterOn" : ""}" onclick="setEquipmentRarityLimit('rare')">
              Up to Rare
            </button>

            <button class="${state.filters.rarityLimit === "legendary" ? "depotFilterOn" : ""}" onclick="setEquipmentRarityLimit('legendary')">
              All Gear
            </button>
          </div>
        </div>
      ` : ""}
    `;
  }

  grid.innerHTML = "";

  for (let i = 0; i < 40; i++) {
    const item = items[i];

    const slot = document.createElement("div");
    slot.className = "depotSlot";

    if (item) {
  ensureItemId(item);
  slot.style.borderColor = item.rarityColor || "#3d2809";
  slot.style.boxShadow = `0 0 6px ${item.rarityColor || "transparent"}`;
  slot.draggable = true;
slot.ondragstart = event => handleDepotItemDragStart(event, activeTab, i);
slot.dataset.depotTab = activeTab;
slot.dataset.depotSlot = i;
  slot.onclick = () => equipItem(item, i, state.depot.activeTab);
      slot.onmouseenter = e => showItemTooltip(item, e.clientX, e.clientY, true);
      slot.onmousemove = e => moveItemTooltip(e.clientX, e.clientY);
      slot.onmouseleave = hideItemTooltip;
    }

    const enhance = item?.enhanceLevel || 0;

    slot.innerHTML = item
      ? `
        <div 
  draggable="true"
  ondragstart="handleDepotItemDragStart(event, ${activeTab}, ${i})"
  style="position:relative;width:100%;height:100%;"
>

          <img 
  draggable="false"
  class="depotItemSprite"
            src="${item.sprite}"
            style="
              position:absolute;
              top:0;
              left:0;
              width:100%;
              height:100%;
              object-fit:contain;
              image-rendering:pixelated;
            "
            onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
          >

          <div class="depotItemIcon" style="
            display:none;
            position:absolute;
            top:50%;
            left:50%;
            transform:translate(-50%, -50%);
          ">
            ${item.icon || "❔"}
          </div>

          ${enhance > 0 ? `
            <div style="
              position:absolute;
              bottom:2px;
              right:3px;
              font-size:10px;
              font-weight:bold;
              color:#4cff9a;
              text-shadow:0 0 4px #000;
              pointer-events:none;
              z-index:2;
            ">
              +${enhance}
            </div>
          ` : ""}

          <div class="depotItemName" style="
            position:absolute;
            bottom:-14px;
            left:0;
            width:100%;
            font-size:10px;
            text-align:center;
            color:${item.rarityColor || "#c7a044"};
            pointer-events:none;
          ">
            T${item.tier} ${item.name}
          </div>

          <div class="depotItemActions" style="
            position:absolute;
            top:2px;
            left:2px;
            z-index:3;
          ">
            <button onclick="event.stopPropagation(); sellDepotItem(${activeTab}, ${i});">Sell</button>
            <button onclick="event.stopPropagation(); salvageDepotItem(${activeTab}, ${i});">Salvage</button>
          </div>

        </div>
      `
      : "";

    grid.appendChild(slot);
  }
 
 renderLoadoutsPanel();
 
}

function compactDepotTab(tabIndex) {
  const tab = state.depot.tabs[tabIndex];
  if (!tab) return;

  const compacted = tab.filter(item => item);
  const emptySlots = Array(tab.length - compacted.length).fill(null);

  state.depot.tabs[tabIndex] = [...compacted, ...emptySlots];
}

function sellCurrentDepotTab() {
  const activeTab = state.depot.activeTab || 0;
  const items = state.depot.tabs[activeTab];

  if (!items || !items.some(Boolean)) {
    showFilterNotification("sell", "Depot tab is empty.");
    return;
  }

  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i]) {
      sellDepotItem(activeTab, i, true);
    }
  }

  compactDepotTab(activeTab);
  hideItemTooltip();
  renderDepotPanel();
  updateUI();
  injectPanelHero?.("depotPanel");
  saveGame();

  showFilterNotification("sell", `Sold all items in depot tab ${activeTab + 1}.`);
}

function salvageCurrentDepotTab() {
  const activeTab = state.depot.activeTab || 0;
  const items = state.depot.tabs[activeTab];

  if (!items || !items.some(Boolean)) {
    showFilterNotification("salvage", "Depot tab is empty.");
    return;
  }

  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i]) {
      salvageDepotItem(activeTab, i, true);
    }
  }

  compactDepotTab(activeTab);
  hideItemTooltip();
  renderDepotPanel();
  injectPanelHero?.("depotPanel");
  updateUI();
  saveGame();

  showFilterNotification("salvage", `Salvaged all items in depot tab ${activeTab + 1}.`);
}

function setDepotTab(tabIndex) {
  if (!state.depot) state.depot = {};
  state.depot.activeTab = tabIndex;

  renderDepotTabs();
  renderDepotPanel();
  queueSaveGame?.() || saveGame();
}

function getItemComparisonText(item) {
  if (!item || !item.type) return "";

  const equipped = state.equipment[item.type];

  if (!equipped || !equipped.stats) {
    return `<div class="itemTooltipCompareGood">No item equipped</div>`;
  }

  function formatComparisonStat(statKey, value) {
    if (statKey === "critChance") {
      const abs = Math.abs(value);

      if (abs > 0 && abs < 1) {
        return value.toFixed(2);
      }

      return Math.floor(value);
    }

    return value;
  }

  const allStats = new Set([
    ...Object.keys(item.stats || {}),
    ...Object.keys(equipped.stats || {})
  ]);

  const rows = [];

  allStats.forEach(statKey => {
    const newValue = getEnhancedItemStatValue(item, statKey, item.stats?.[statKey] || 0);
    const oldValue = getEnhancedItemStatValue(equipped, statKey, equipped.stats?.[statKey] || 0);
    const diff = newValue - oldValue;

    const def = ITEM_STATS[statKey];
    const label = def ? def.label : statKey;
    const suffix = def ? def.suffix : "";

    const shownDiff = formatComparisonStat(statKey, diff);

    const diffText =
      diff > 0 ? `+${shownDiff}${suffix}` :
      diff < 0 ? `${shownDiff}${suffix}` :
      `±0${suffix}`;

    const diffClass =
      diff > 0 ? "itemTooltipCompareGood" :
      diff < 0 ? "itemTooltipCompareBad" :
      "itemTooltipCompareNeutral";

    rows.push(`
      <div class="${diffClass}">
        ${label}: ${diffText}
      </div>
    `);
  });

  return rows.join("");
}

function showItemTooltip(item, x, y, showComparison = true) {
  const tooltip = document.getElementById("itemTooltip");
  if (!tooltip || !item) return;

  const enhance = item.enhanceLevel || 0;

  function formatItemStatValue(key, value) {
    if (key === "critChance") {
      return value < 1
        ? value.toFixed(2)
        : Math.floor(value);
    }

    return value;
  }

  const stats = Object.entries(item.stats || {})
    .map(([key, value]) => {
      const def = ITEM_STATS[key];
      const label = def ? def.label : key;
      const suffix = def ? def.suffix : "";

      const enhancedValue = getEnhancedItemStatValue(item, key, value);
      const improved = enhancedValue !== value;

      const shownValue = formatItemStatValue(key, enhancedValue);
      const shownImprovement = formatItemStatValue(key, enhancedValue - value);

      return `
        <div class="itemTooltipStat">
          +${shownValue}${suffix} ${label}
          ${improved ? `<span style="color:#4cff9a;">(+${shownImprovement}${suffix})</span>` : ""}
        </div>
      `;
    })
    .join("");

  const comparison = showComparison ? getItemComparisonText(item) : "";

  tooltip.style.display = "block";

  tooltip.innerHTML = `
    <div class="itemTooltipTitle" style="color:${item.rarityColor || "#fff"};">
      ${item.rarityName} ${item.name}${enhance > 0 ? ` +${enhance}` : ""}
    </div>

    <div class="itemTooltipTier">
      Tier ${item.tier}
    </div>

    <div class="itemTooltipStats">
      ${stats || `<div class="itemTooltipStat muted">No bonuses</div>`}
    </div>

    ${showComparison ? `
      <div class="itemTooltipCompare">
        <div class="itemTooltipCompareTitle">Compared to equipped</div>
        ${comparison}
      </div>
    ` : ""}
  `;

  moveItemTooltip(x, y);
}

function moveItemTooltip(x, y) {
  const tooltip = document.getElementById("itemTooltip");
  if (!tooltip) return;

  const padding = 12;

  const tooltipWidth = tooltip.offsetWidth;
  const tooltipHeight = tooltip.offsetHeight;

  let left = x + padding;
  let top = y + padding;

  // If overflowing right side → flip to left
  if (left + tooltipWidth > window.innerWidth) {
    left = x - tooltipWidth - padding;
  }

  // If overflowing bottom → move up
  if (top + tooltipHeight > window.innerHeight) {
    top = y - tooltipHeight - padding;
  }

  // Clamp to screen (safety)
  left = Math.max(5, left);
  top = Math.max(5, top);

  tooltip.style.left = left + "px";
  tooltip.style.top = top + "px";
}

function hideItemTooltip() {
  const tooltip = document.getElementById("itemTooltip");
  if (!tooltip) return;

  tooltip.style.display = "none";
}

function recordStarGain(amount) {
  if (!state.starGainSamples) {
    state.starGainSamples = [];
  }

  state.starGainSamples.push({
    time: Date.now(),
    amount
  });

  const cutoff = Date.now() - 15000; // last 15 seconds
  state.starGainSamples = state.starGainSamples.filter(sample => sample.time >= cutoff);
}

function getRollingStarsPerSecond() {
  const samples = state.starGainSamples || [];
  if (samples.length === 0) return 0;

  const now = Date.now();
  const cutoff = now - 15000;

  const recent = samples.filter(sample => sample.time >= cutoff);
  const total = recent.reduce((sum, sample) => sum + sample.amount, 0);

  return total / 15;
}

function getRollingStarsPerHour() {
  return getRollingStarsPerSecond() * 3600;
}

function renderStatsPanel() {
  const box = document.getElementById("statsContent");
  if (!box) return;

  const gearDamage = getTotalEquipmentStat("damage");
  const gearGold = getTotalEquipmentStat("gold");
  const gearExp = getTotalEquipmentStat("exp");
  const gearCrit = getTotalEquipmentStat("crit");
  const gearSpeed = getTotalEquipmentStat("attackSpeed");

  const skillDamage = (state.skills.powerBolt || 0) * 20;
  const skillGold = (state.skills.deepPockets || 0) * 10;
  const skillExp = (state.skills.experiencedHunter || 0) * 2.5;
  const essenceBoost = (state.skills.materialistic || 0) * 2;

  const potionGold = isPotionActive("wealthUntil") ? 25 : 0;
  const potionExp = isPotionActive("wisdomUntil") ? 25 : 0;

  const researchDamage = getTotalResearchBonus("damage") * 100;
  const researchGold = getTotalResearchBonus("gold") * 100;
  const researchExp = getTotalResearchBonus("exp") * 100;
  const researchMaterials = getTotalResearchBonus("materials") * 100;
  const researchCritDamage = getTotalResearchBonus("critDamage") * 100;
  const researchOverkillSplash = getTotalResearchBonus("overkillSplash") * 100;
  const researchRareDrops = getTotalResearchBonus("rareDrops") * 100;

  const rebirthGold = 0;
  const rebirthExp = 0;

  const damageMulti =
    (1 + gearDamage / 100) *
    (1 + skillDamage / 100);

  const goldMulti =
    (1 + gearGold / 100) *
    (1 + skillGold / 100) *
    (1 + rebirthGold / 100) *
    (1 + potionGold / 100);

  const expMulti =
    (1 + gearExp / 100) *
    (1 + skillExp / 100) *
    (1 + rebirthExp / 100) *
    (1 + potionExp / 100);

  const sessionHours = Math.max(
    1 / 60,
    (Date.now() - (state.stats?.sessionStartedAt || Date.now())) / 3600000
  );

  const goldPerHour = Math.floor((state.stats?.goldEarned || 0) / sessionHours);
  const expPerHour = Math.floor((state.stats?.expEarned || 0) / sessionHours);
  
  const starsPerSecond = getRollingStarsPerSecond();
  const starsPerHour = getRollingStarsPerHour();

  const gearDropBoost = 1 + (state.skills.gearingUp || 0) * 0.10;

  const normalGearDrop = 0.5 * gearDropBoost;
  const bossGearDrop = 2.5 * gearDropBoost;
  const uberGearDrop = 5 * gearDropBoost;

  const minotaurDps = getRollingAverageDps("minotaur", getMinotaurDps());
  const necromancerDps = getRollingAverageDps("necromancer", getNecromancerDps());

  const activeStarZone = getZoneById(state.starSystem?.activeZoneId);
  const starSpawnChance = getStarSpawnChance() * 100;
  const starShowerChance = (state.starUpgrades?.starShower || 0) * 0.3;
  const astralShowerChance = (state.starUpgrades?.astralShower || 0) * 0.1;
  const supernovaChance = (state.starUpgrades?.supernovas || 0) * 0.1;
  const supergiantChance = (state.starUpgrades?.supergiants || 0) * 0.1;
  const novaMultiplier = 2 + (state.starUpgrades?.novaYields || 0) * 0.01;
  const giantMultiplier = 3 + (state.starUpgrades?.giantYields || 0) * 0.01;
  const cosmicWorthMultiplier = 1 + (state.starUpgrades?.cosmicWorth || 0) * 0.01;
  const taurusAutoCatch = (state.constellations?.taurus || 0);
  const weaponStarLevel = state.weaponStarLevel || 0;
  const dracoScaling = state.dracoWeaponScaling || 0;
  const phoenixMultiplier = getPhoenixBonusMultiplier();
  const starPickupRange = getStarPickupRadius();

  box.innerHTML = `
    <div class="statsSection">
      <b>Stars</b>
      <div>Stars Owned: <span>${fmt(state.stars || 0)}</span></div>
	  <div>Stars / Sec: <span>${fmt(starsPerSecond.toFixed(1))}</span></div>
      <div>Stars / Hour: <span>${fmt(Math.floor(starsPerHour))}</span></div>
      <div>Active Star Zone: <span>${activeStarZone?.name || "Unknown"}</span></div>
      <div>Next Rotation: <span>${getStarZoneTimeLeftText()}</span></div>
      <div>Spawn Rate / Sec: <span>${starSpawnChance.toFixed(1)}%</span></div>
	  <div>Pickup Range: <span>${starPickupRange.toFixed(0)}px</span></div>
	  <div>Guaranteed Stars / Sec: <span>${Math.floor(getStarSpawnChance())}</span></div>
	  <div>Extra Star Chance: <span>${((getStarSpawnChance() % 1) * 100).toFixed(1)}%</span></div>
      <div>3-Star Chance: <span>${starShowerChance.toFixed(1)}%</span></div>
      <div>10-Star Chance: <span>${astralShowerChance.toFixed(1)}%</span></div>
      <div>Supernova Chance: <span>${supernovaChance.toFixed(1)}%</span></div>
      <div>Supergiant Chance: <span>${supergiantChance.toFixed(1)}%</span></div>
      <div>Supernova Multiplier: <span>x${novaMultiplier.toFixed(2)}</span></div>
      <div>Supergiant Multiplier: <span>x${giantMultiplier.toFixed(2)}</span></div>
      <div>Cosmic Worth: <span>x${cosmicWorthMultiplier.toFixed(2)}</span></div>
      <div>Taurus Auto-Catch: <span>${taurusAutoCatch}%</span></div>
      <div>Celestial Weapon: <span>+${weaponStarLevel}/100</span></div>
      <div>Draco Weapon Scaling: <span>+${dracoScaling}%</span></div>
      <div>Follow Stars: <span>${state.settings?.followStars ? "ON" : "OFF"}</span></div>
      <div>Phoenix Early-Rebirth Boost: <span>x${phoenixMultiplier.toFixed(2)}</span></div>
    </div>

    <div class="statsSection">
      <b>Global Multipliers</b>
      <div>Damage: <span>x${damageMulti.toFixed(2)} (+${((damageMulti - 1) * 100).toFixed(1)}%)</span></div>
      <div>Gold: <span>x${goldMulti.toFixed(2)} (+${((goldMulti - 1) * 100).toFixed(1)}%)</span></div>
      <div>EXP: <span>x${expMulti.toFixed(2)} (+${((expMulti - 1) * 100).toFixed(1)}%)</span></div>
    </div>

    <div class="statsSection">
      <b>Efficiency</b>
      <div>Gold / Hour: <span>${fmt(goldPerHour)}</span></div>
      <div>EXP / Hour: <span>${fmt(expPerHour)}</span></div>
    </div>

    <div class="statsSection">
      <b>Summon DPS</b>
      <div>Minotaur DPS: <span>${fmt(minotaurDps)}</span></div>
      <div>Necromancer DPS: <span>${fmt(necromancerDps)}</span></div>
    </div>

    <div class="statsSection">
      <b>Session</b>
      <div>Monsters Killed: <span>${fmt(state.stats?.monstersKilled || 0)}</span></div>
      <div>Bosses Killed: <span>${fmt(state.stats?.bossesKilled || 0)}</span></div>
      <div>Uber Bosses Killed: <span>${fmt(state.stats?.ubersKilled || 0)}</span></div>
      <div>Max Monsters: <span>${getMaxMonsters()}</span></div>
      <div>Gear Found: <span>${fmt(state.stats?.gearFound || 0)}</span></div>
    </div>

    <div class="statsSection">
      <b>Rewards</b>
      <div>Gold (Skills): <span>+${skillGold}%</span></div>
      <div>Gold (Gear): <span>+${gearGold}%</span></div>
      <div>Gold (Potion): <span>+${potionGold}%</span></div>
      <div>EXP (Skills): <span>+${skillExp}%</span></div>
      <div>EXP (Gear): <span>+${gearExp}%</span></div>
      <div>EXP (Potion): <span>+${potionExp}%</span></div>
      <div>Essence Bonus: <span>+${essenceBoost}%</span></div>
    </div>

    <div class="statsSection">
      <b>Research Bonuses</b>
      <div>Damage: <span>+${researchDamage.toFixed(1)}%</span></div>
      <div>Gold: <span>+${researchGold.toFixed(1)}%</span></div>
      <div>EXP: <span>+${researchExp.toFixed(1)}%</span></div>
      <div>Materials: <span>+${researchMaterials.toFixed(1)}%</span></div>
      <div>Crit Damage: <span>+${researchCritDamage.toFixed(1)}%</span></div>
      <div>Overkill Splash: <span>+${researchOverkillSplash.toFixed(1)}%</span></div>
      <div>Rare Drops: <span>+${researchRareDrops.toFixed(1)}%</span></div>
    </div>

    <div class="statsSection">
      <b>Equipment Totals</b>
      <div>Damage: <span>+${gearDamage}%</span></div>
      <div>Gold: <span>+${gearGold}%</span></div>
      <div>EXP: <span>+${gearExp}%</span></div>
      <div>Crit: <span>+${gearCrit}%</span></div>
      <div>Attack Speed: <span>+${gearSpeed}%</span></div>
    </div>

    <div class="statsSection">
      <b>Equipment Drops</b>
      <div>Normal: <span>${normalGearDrop.toFixed(2)}%</span></div>
      <div>Boss: <span>${bossGearDrop.toFixed(2)}%</span></div>
      <div>Uber: <span>${uberGearDrop.toFixed(2)}%</span></div>
    </div>

    <div class="statsSection">
      <b>Rarity Odds</b>
      <div>Common: <span>70%</span></div>
      <div>Uncommon: <span>22%</span></div>
      <div>Rare: <span>7%</span></div>
      <div>Legendary: <span>1%</span></div>
    </div>
  `;
}

function getResearchMilestonesCompleted() {
  if (!state.monsterResearch) return 0;

  return Object.values(state.monsterResearch).reduce((total, progress) => {
    return total + (progress.unlocked?.length || 0);
  }, 0);
}

async function updateOnlinePlayersUI() {
  try {
    const response = await fetch(`${API_URL}/online`);
    const data = await response.json();

    const bar = document.getElementById("onlinePlayersBar");

    if (!bar) return;

    bar.textContent =
      `🟢 Online Players: ${data.onlineCount || 0}`;
  } catch (error) {
    console.warn("Failed to load online players:", error);
  }
}

async function renderScorePanel() {
  const box = document.getElementById("scoreContent");
  if (!box) return;

  if (!state.leaderboardSort) state.leaderboardSort = "level";

  if (!box.dataset.loaded) {
  box.innerHTML = `
    <div class="leaderboardControls">
      <button class="${state.leaderboardSort === "level" ? "active" : ""}" onclick="setLeaderboardSort('level')">Level</button>
      <button class="${state.leaderboardSort === "kills" ? "active" : ""}" onclick="setLeaderboardSort('kills')">Kills</button>
      <button class="${state.leaderboardSort === "gold" ? "active" : ""}" onclick="setLeaderboardSort('gold')">Gold</button>
      <button class="${state.leaderboardSort === "research" ? "active" : ""}" onclick="setLeaderboardSort('research')">Research</button>
      <button class="${state.leaderboardSort === "stars" ? "active" : ""}" onclick="setLeaderboardSort('stars')">Stars</button>
    </div>

    <div style="padding:12px;color:#c7a044;">
      Loading leaderboard...
    </div>
  `;

  box.dataset.loaded = "true";
}

  let entries = [];

  try {
    const response = await fetch(`${API_URL}/leaderboard`);
    const data = await response.json();

    if (data.success && Array.isArray(data.leaderboard)) {
      entries = data.leaderboard.map(entry => ({
        userId: entry.userId,
        name: entry.username,
        level: entry.level || 1,
        monstersKilled: entry.monstersKilled || 0,
        goldCollected: entry.gold || 0,
        researchMilestones: entry.researchMilestones || 0,
        starsCollected: entry.starsCollected || 0
      }));
    }
  } catch (error) {
    console.warn("Leaderboard fetch failed:", error);
  }

  if (entries.length === 0) {
    box.innerHTML += `
      <div style="padding:12px;color:#ff9999;">
        Could not load leaderboard.
      </div>
    `;
    return;
  }

  if (state.leaderboardSort === "level") {
    entries.sort((a, b) => b.level - a.level);
  }

  if (state.leaderboardSort === "kills") {
    entries.sort((a, b) => b.monstersKilled - a.monstersKilled);
  }

  if (state.leaderboardSort === "gold") {
    entries.sort((a, b) => b.goldCollected - a.goldCollected);
  }

  if (state.leaderboardSort === "research") {
    entries.sort((a, b) => b.researchMilestones - a.researchMilestones);
  }

  if (state.leaderboardSort === "stars") {
    entries.sort((a, b) => b.starsCollected - a.starsCollected);
  }

  const currentUser = getLoggedInUser?.();

  box.innerHTML = `
    <div class="leaderboardControls">
      <button class="${state.leaderboardSort === "level" ? "active" : ""}" onclick="setLeaderboardSort('level')">Level</button>
      <button class="${state.leaderboardSort === "kills" ? "active" : ""}" onclick="setLeaderboardSort('kills')">Kills</button>
      <button class="${state.leaderboardSort === "gold" ? "active" : ""}" onclick="setLeaderboardSort('gold')">Gold</button>
      <button class="${state.leaderboardSort === "research" ? "active" : ""}" onclick="setLeaderboardSort('research')">Research</button>
      <button class="${state.leaderboardSort === "stars" ? "active" : ""}" onclick="setLeaderboardSort('stars')">Stars</button>
    </div>

    <div class="leaderboardHeader">
      <span>Rank</span>
      <span>Name</span>
      <span>Lvl</span>
      <span>Kills</span>
      <span>Gold</span>
      <span>Research</span>
      <span>Stars</span>
    </div>

    ${entries.map((entry, index) => `
      <div class="leaderboardRow ${String(entry.userId) === String(currentUser?.id) ? "you" : ""}">
        <span>#${index + 1}</span>
        <span>${entry.name}</span>
        <span>${entry.level}</span>
        <span>${fmt(entry.monstersKilled)}</span>
        <span>${fmt(entry.goldCollected)}</span>
        <span>${fmt(entry.researchMilestones || 0)}</span>
        <span>${fmt(entry.starsCollected || 0)}</span>
      </div>
    `).join("")}
  `;
}

function setLeaderboardSort(type) {
  state.leaderboardSort = type;
  renderScorePanel();
}

function getNextRebirthRewardLevel(targetReward = null) {
  const desiredReward =
    targetReward ?? (calculateRebirthReward() + 1);

  let level = 1;

  while (true) {
    const coins = calculateRebirthRewardForLevel(level);

    if (coins >= desiredReward) {
      return level;
    }

    level++;
  }
}

function calculateRebirthRewardForLevel(level) {
  return Math.floor(Math.pow(level / 50, 1.15));
}

function renderRebirthPanel() {
  const box = document.getElementById("rebirthContent");
  if (!box) return;

  const reward = calculateRebirthReward();

  box.innerHTML = `
    <div class="statsSection">
      <b>Rebirth Info</b>
      <div>Total Rebirths: <span>${state.rebirth.count}</span></div>
      <div>Coins: <span>${state.rebirth.coins}</span></div>
    </div>

    <div class="statsSection">
      <b>Reward</b>
      <div>Coins on rebirth: <span>${reward}</span></div>
    </div>

    <button class="weaponActionBtn" style="margin-top:10px;width:100%;" onclick="performRebirth()">
      Rebirth Now
    </button>
  `;
}

const REBIRTH_SHOP = [
  {
    key: "keepMaterials",
    name: "Keep Materials",
    desc: "Keep 5% of all materials when rebirthing per point.",
    icon: "📦",
    cost: 1,
    max: 10
  },
  {
    key: "keepGear",
    name: "Gear Stash",
    desc: "Keep equipped gear when rebirthing.",
    icon: "🎒",
    cost: 3,
    max: 1
  },
  {
    key: "autoTravel",
    name: "Automatic Travelling",
    desc: "Automatically travels to the next zone when possible.",
    icon: "🗺",
    cost: 4,
    max: 1
  },
  {
    key: "autoWeapons",
    name: "Weapon Upgrader",
    desc: "Automatically purchases the next weapon upgrade when possible.",
    icon: "⚔",
    cost: 5,
    max: 1
  },
  {
    key: "autoSkills",
    name: "Skills Improvement",
    desc: "Automatically purchases available skills when possible.",
    icon: "🧠",
    cost: 6,
    max: 1
  },
  {
    key: "potionLimit",
    name: "Potion Time Limit",
    desc: "Increases maximum potion duration by 1 hour per point.",
    icon: "🧪",
    cost: 3,
    max: 11
  },
  {
    key: "autoSalvage",
    name: "Auto Salvage Filter",
    desc: "Unlocks automatic salvaging for low-rarity equipment drops.",
    icon: "⚒",
    cost: 6,
    max: 1
  },
  {
    key: "autoSell",
    name: "Auto Sell Filter",
    desc: "Unlocks automatic selling for low-rarity equipment drops.",
    icon: "💰",
    cost: 6,
    max: 1
  },
  {
    key: "rebirthTokens",
    name: "Rebirth with Silver Tokens",
    desc: "Gain 1 Silver Token after rebirthing per point.",
    icon: "⚪",
    cost: 4,
    max: 10
  },
  {
    key: "maxMonsters",
    name: "Monster Overflow",
    desc: "Increases maximum monsters on screen by 1 per point.",
    icon: "👹",
    cost: 8,
    max: 10
  },
  {
    key: "necromancer",
    name: "Necromancer",
    desc: "Unlocks the Necromancer and his skill tree.",
    icon: "☠",
    cost: 15,
    max: 1
  }
];

function renderRebirthShop() {
  const box = document.getElementById("rebirthShopContent");
  if (!box) return;

  if (!state.rebirth) state.rebirth = { count: 0, coins: 0 };
  if (!state.rebirthUpgrades) state.rebirthUpgrades = {};

  const sections = [
  {
    title: "Automation",
    upgrades: ["autoWeapons", "autoTravel", "autoSkills"]
  },
  {
    title: "Progression",
    upgrades: ["keepGear", "goldBooster", "experienceBooster"]
  },
  {
    title: "Companions",
    upgrades: ["necromancer"]
  },
  {
    title: "Other",
    upgrades: REBIRTH_SHOP
      .map(upgrade => upgrade.key)
      .filter(key => ![
        "autoWeapons",
        "autoTravel",
        "autoSkills",
        "keepGear",
        "goldBooster",
        "experienceBooster",
        "necromancer"
      ].includes(key))
  }
];

  const upgradeMap = Object.fromEntries(REBIRTH_SHOP.map(upgrade => [upgrade.key, upgrade]));

  box.innerHTML = `

    ${sections.map(section => {
      const upgrades = section.upgrades
        .map(key => upgradeMap[key])
        .filter(Boolean);

      if (!upgrades.length) return "";

      return `
        <div class="starSection">
  <div class="starSectionTitle">${section.title}</div>

  <div class="uiGrid">
            ${upgrades.map(upgrade => {
              const owned = state.rebirthUpgrades[upgrade.key] || 0;
              const max = upgrade.max || 1;
              const maxed = owned >= max;

              const cost = getRebirthUpgradeCost(upgrade);
              const affordable = (state.rebirth.coins || 0) >= cost && !maxed;

              return `
                <div class="uiListCard ${maxed ? "active" : ""}">
                  <div class="uiListCardInner">
                    <div class="uiListIcon">${upgrade.icon || "✦"}</div>

                    <div class="uiListText">
                      <div class="uiListTitle">${upgrade.name}</div>
                      <div class="uiListSub">${upgrade.desc}</div>
                      <div class="skillPointsLine">Level ${owned}/${max}</div>
                    </div>

                    <div class="uiListAction rightAligned">
                      <button
                        class="uiButton ${affordable ? "active" : ""}"
                        ${maxed || !affordable ? "disabled" : ""}
                        onclick="buyRebirthUpgrade('${upgrade.key}')"
                      >
                        ${maxed ? "Maxed" : `${fmt(cost)} 🪙`}
                      </button>
                    </div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }).join("")}
  `;
}

function getRebirthUpgradeCost(upgrade) {
  const level = state.rebirthUpgrades?.[upgrade.key] || 0;
  return Math.floor(upgrade.cost * Math.pow(1.5, level));
}

function buyRebirthUpgrade(key) {
  if (!state.rebirthUpgrades) state.rebirthUpgrades = {};
  if (!state.rebirth) state.rebirth = { count: 0, coins: 0 };

  const upgrade = REBIRTH_SHOP.find(u => u.key === key);
  if (!upgrade) return;

  const owned = state.rebirthUpgrades[key] || 0;
  const max = upgrade.max || 1;

  if (owned >= max) return;

  const cost = getRebirthUpgradeCost(upgrade);

  if ((state.rebirth.coins || 0) < cost) {
    showFilterNotification(
  "system",
  `Not enough rebirth coins. Need ${fmt(cost)}.`
);
    return;
  }

state.rebirth.coins -= cost;
state.rebirthUpgrades[key] = owned + 1;

renderNecromancerVisual();

// refresh necromancer visual safely
document.getElementById("necromancerVisual")?.remove();
initSummonVisual();

renderSkillTree();
renderRebirthShop();
renderAutomationBox();
renderAutomationInfo();
updateUI();
renderPanelById("rebirthShopPanel");

saveGame();
}

function renderAutomationBox() {
  const box = document.getElementById("automationBox");
  if (!box) return;

  ensureAutomationToggles();

  const hasAutoWeapons =
  state.rebirthUpgrades?.autoBuy > 0 ||
  state.rebirthUpgrades?.weaponUpgrader > 0 ||
  state.rebirthUpgrades?.autoWeapons > 0;

  const hasAutoTravel =
    state.rebirthUpgrades?.autoTravel > 0 ||
    state.rebirthUpgrades?.automaticTravelling > 0;

  const hasAutoSkills =
    state.rebirthUpgrades?.autoSkills > 0 ||
    state.rebirthUpgrades?.skillsImprovement > 0;

  if (!hasAutoWeapons && !hasAutoTravel && !hasAutoSkills) {
    box.innerHTML = "";
    return;
  }

  const rows = [];

  if (hasAutoWeapons) {
    rows.push({
      key: "autoBuy",
      name: "Auto Weapons"
    });
  }

  if (hasAutoTravel) {
    rows.push({
      key: "autoTravel",
      name: "Auto Travel"
    });
  }

  if (hasAutoSkills) {
    rows.push({
      key: "autoSkills",
      name: "Auto Skills"
    });
  }

  box.innerHTML = `
    <div style="margin-top:8px;border-top:1px solid rgba(139,101,15,.45);padding-top:6px;">
      <b class="goldTitle">AUTOMATIONS</b>

      ${rows.map(row => {
        const enabled = state.automationToggles[row.key];

        return `
          <button class="automationToggle ${enabled ? "on" : "off"}" onclick="toggleAutomation('${row.key}')">
            <span>${row.name}</span>
            <span>${enabled ? "ON" : "OFF"}</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function hasAnyAutomationUnlocked() {
  return (
    state.rebirthUpgrades?.autoBuy > 0 ||
    state.rebirthUpgrades?.autoTravel > 0 ||
    state.rebirthUpgrades?.autoSkills > 0
  );
}

function ensureAutomationToggles() {
  if (!state.automationToggles) {
    state.automationToggles = {
      autoBuy: true,
      autoTravel: true,
      autoSkills: true
    };
  }
}

function toggleAutomation(key) {
  ensureAutomationToggles();

  state.automationToggles[key] = !state.automationToggles[key];

  renderAutomationBox();
  renderAutomationInfo();
  updateUI();

  saveGame();
}

function renderSkeletons() {
  const arena = document.getElementById("arena");
  if (!arena) return;

  const validSkeletons = (state.skeletons || []).filter(skeleton =>
    Number.isFinite(skeleton.x) &&
    Number.isFinite(skeleton.y)
  );

  const activeIds = new Set(validSkeletons.map(s => String(s.id)));

  document.querySelectorAll(".skeletonSummon").forEach(el => {
    if (!activeIds.has(el.dataset.skeletonId)) {
      el.remove();
    }
  });

  validSkeletons.forEach(skeleton => {
    let el = document.querySelector(`.skeletonSummon[data-skeleton-id="${skeleton.id}"]`);

    if (!el) {
      el = document.createElement("div");
      el.dataset.skeletonId = String(skeleton.id);
      el.innerHTML = `
        <img src="assets/summons/Skeleton.gif" onerror="this.style.display='none';">
      `;
      arena.appendChild(el);
    }

    const isElite = skeleton.elite === true;
    el.className = `skeletonSummon ${isElite ? "eliteSkeletonSummon" : ""}`;

    const radius = getSkeletonAttackRadius(skeleton);
    el.style.setProperty("--skeleton-radius", `${radius * 2}px`);

    el.style.left = `${skeleton.x}px`;
    el.style.top = `${skeleton.y}px`;
  });
}

function renderSettingsPanel() {
  const box = document.getElementById("settingsContent");
  if (!box) return;

  if (!state.settings) state.settings = {};

  if (state.settings.minotaurAttacks === undefined) state.settings.minotaurAttacks = true;
  if (state.settings.necromancerAttacks === undefined) state.settings.necromancerAttacks = true;
  if (state.settings.autoCollectStars === undefined) state.settings.autoCollectStars = false;
  if (state.settings.followStars === undefined) state.settings.followStars = false;

  const aquariusUnlocked = (state.constellations?.aquarius || 0) > 0;
  const taurusUnlocked = (state.constellations?.taurus || 0) > 0;

  box.innerHTML = `
    <div class="statsSection">
      <b>Star Settings</b>

      <button
        class="automationToggle ${state.settings.autoCollectStars ? "on" : "off"}"
        onclick="toggleAutoCollectStars()"
        ${taurusUnlocked ? "" : "disabled"}
      >
        <span>Auto Collect Stars ${taurusUnlocked ? "" : "(Requires Taurus)"}</span>
        <span>${state.settings.autoCollectStars ? "ON" : "OFF"}</span>
      </button>

      <button
        class="automationToggle ${state.settings.followStars ? "on" : "off"}"
        onclick="toggleFollowStars()"
        ${aquariusUnlocked ? "" : "disabled"}
      >
        <span>Follow Stars ${aquariusUnlocked ? "" : "(Requires Aquarius)"}</span>
        <span>${state.settings.followStars ? "ON" : "OFF"}</span>
      </button>
    </div>

    <div class="statsSection">
      <b>Summon Settings</b>

      <button class="automationToggle ${state.settings.minotaurAttacks ? "on" : "off"}" onclick="toggleGameSetting('minotaurAttacks')">
        <span>Minotaur Attacks</span>
        <span>${state.settings.minotaurAttacks ? "ON" : "OFF"}</span>
      </button>

      <button class="automationToggle ${state.settings.necromancerAttacks ? "on" : "off"}" onclick="toggleGameSetting('necromancerAttacks')">
        <span>Necromancer Attacks</span>
        <span>${state.settings.necromancerAttacks ? "ON" : "OFF"}</span>
      </button>

      <button
        class="automationToggle ${state.settings?.minotaurEffectDebug ? "on" : "off"}"
        onclick="toggleMinotaurEffectDebug()"
      >
        <span>Minotaur Effect Debug</span>
        <span>${state.settings?.minotaurEffectDebug ? "ON" : "OFF"}</span>
      </button>
    </div>
  `;
}

function toggleMinotaurEffectDebug() {
  if (!state.settings) state.settings = {};

  state.settings.minotaurEffectDebug = !state.settings.minotaurEffectDebug;

  renderSettingsPanel?.();
  saveGame();

  addLog(
    state.settings.minotaurEffectDebug
      ? "Minotaur effect debug enabled."
      : "Minotaur effect debug disabled."
  );
}

function toggleGameSetting(key) {
  if (!state.settings) {
    state.settings = {
      minotaurAttacks: true,
      necromancerAttacks: true
    };
  }

  state.settings[key] = !state.settings[key];

  renderSettingsPanel();
  saveGame();
}

function ensureFilters() {
  if (!state.filters) {
    state.filters = {
      equipmentAction: "none",
      rarityLimit: "common"
    };
  }

  if (!state.filters.equipmentAction) state.filters.equipmentAction = "none";
  if (!state.filters.rarityLimit) state.filters.rarityLimit = "common";
}

function setEquipmentFilterAction(action) {
  ensureFilters();

  const hasSalvage = state.rebirthUpgrades?.autoSalvage > 0;
  const hasSell = state.rebirthUpgrades?.autoSell > 0;

  if (action === "salvage" && !hasSalvage) return;
  if (action === "sell" && !hasSell) return;

  state.filters.equipmentAction = action;

  renderSettingsPanel();
  saveGame();
}

function setEquipmentRarityLimit(rarity) {
  ensureFilters();

  if (!RARITY_ORDER[rarity]) return;

  state.filters.rarityLimit = rarity;

  renderDepotPanel();
  saveGame();
}

function toggleEquipmentFilterAction(action) {
  ensureFilters();

  const hasSalvage = state.rebirthUpgrades?.autoSalvage > 0;
  const hasSell = state.rebirthUpgrades?.autoSell > 0;

  if (action === "salvage" && !hasSalvage) return;
  if (action === "sell" && !hasSell) return;

  state.filters.equipmentAction =
    state.filters.equipmentAction === action ? "none" : action;

  renderDepotPanel();
  saveGame();
}

function showFilterNotification(type, text) {
  const box = document.getElementById("filterNotifications");
  if (!box) return;

  const div = document.createElement("div");
  div.className = `filterNotification ${type}`;
  div.textContent = text;

  box.prepend(div);

  while (box.children.length > 4) {
    box.lastElementChild.remove();
  }

  setTimeout(() => {
    div.remove();
  }, 3000);
}

function renderNecromancerVisual() {
  const arena = document.getElementById("arena");
  if (!arena) return;

  const unlocked = state.rebirthUpgrades?.necromancer > 0;

  let necro = document.getElementById("necromancerVisual");

  if (!unlocked) {
    if (necro) necro.remove();
    return;
  }

  if (necro) return;

  necro = document.createElement("div");
  necro.id = "necromancerVisual";
  necro.className = "summonUnit";

  necro.innerHTML = `
    <img src="assets/summons/necromancer.gif" onerror="this.style.display='none';">
    <div class="summonNameplate">Necromancer</div>
  `;

  arena.appendChild(necro);
}

function getMaxMonsters() {
  const base = state.maxMonsters + (state.rebirthUpgrades?.maxMonsters || 0);
  const cetusBonus = state.constellations?.cetus || 0;

  return base + cetusBonus;
}

let selectedEnhanceSlot = null;

function renderBlacksmithPanel() {
  const box = document.getElementById("blacksmithContent");
  if (!box) return;

  if (!state.materials) state.materials = {};
  if (!state.salvageMaterials) state.salvageMaterials = {};

  state.materials.whetstones = state.materials.whetstones || 0;

  const selectedItem = selectedEnhanceSlot
    ? state.equipment[selectedEnhanceSlot]
    : null;

  box.innerHTML = `
    <div class="rebirthShopHeader">
      <div>
        <b>Materials</b>
      </div>
    </div>

    <div class="blacksmithMaterialsGrid">

      ${[
        { icon: "🪨", name: "Whetstones", value: state.materials.whetstones || 0, color: "#fff" },
        { icon: "⚙", name: "Common", value: state.salvageMaterials.commonMaterial || 0, color: "#b8b8b8" },
        { icon: "⚙", name: "Uncommon", value: state.salvageMaterials.uncommonMaterial || 0, color: "#53ff7a" },
        { icon: "⚙", name: "Rare", value: state.salvageMaterials.rareMaterial || 0, color: "#4dabf7" },
        { icon: "⚙", name: "Legendary", value: state.salvageMaterials.legendaryMaterial || 0, color: "#ffb84d" }
      ].map(mat => `
        <div class="uiListCard compact">
          <div class="uiListCardInner">

            <div class="uiListIcon">${mat.icon}</div>

            <div class="uiListText">
              <div class="uiListTitle" style="color:${mat.color};">${mat.name}</div>
            </div>

            <div class="rebirthBuyBtn uiListAction rightAligned" style="cursor:default;">
              ${fmt(mat.value)}
            </div>

          </div>
        </div>
      `).join("")}

    </div>

    <div class="blacksmithEquipGrid">
      ${[
        ["necklace", "helmet", null],
        ["weapon", "armor", "shield"],
        ["ring", "legs", null],
        [null, "shoes", null]
      ].flat().map(slotKey => {
        if (!slotKey) {
          return `<div class="blacksmithEquipSlot emptyLayoutSlot"></div>`;
        }

        const slot = EQUIPMENT_SLOTS.find(s => s.key === slotKey) || { key: slotKey, name: slotKey };
        const item = slotKey === "weapon" ? currentWeapon() : state.equipment?.[slotKey];

        const selected = selectedEnhanceSlot === slotKey;
        const faded = selectedEnhanceSlot && !selected;

        const isEnhanceable = slotKey !== "weapon" && item;

        return `
          <div 
            class="blacksmithEquipSlot ${selected ? "selected" : ""} ${faded ? "faded" : ""} ${slotKey === "weapon" ? "notEnhanceable" : ""}"
            ${isEnhanceable ? `onclick="selectEnhanceItem('${slotKey}')"` : ""}
            ${isEnhanceable ? `
              onmouseenter="showItemTooltip(state.equipment['${slotKey}'], event.clientX, event.clientY, false)"
              onmousemove="moveItemTooltip(event.clientX, event.clientY)"
              onmouseleave="hideItemTooltip()"
            ` : ""}
          >
            <div class="blacksmithEquipIcon">
              ${
                item?.sprite
                  ? `<img src="${item.sprite}" onerror="this.style.display='none';">`
                  : `<span>${slot.icon || "?"}</span>`
              }
            </div>

            <div class="blacksmithEquipName">
              ${slot.name || slot.key}
            </div>

            ${
              slotKey !== "weapon" && item
                ? `<div class="blacksmithEnhanceBadge">+${item.enhanceLevel || 0}</div>`
                : slotKey === "weapon"
                  ? `<div class="blacksmithEmptyText">Weapon</div>`
                  : `<div class="blacksmithEmptyText">Empty</div>`
            }
          </div>
        `;
      }).join("")}
    </div>

    ${selectedItem ? renderEnhanceDetails(selectedEnhanceSlot, selectedItem) : `
      <div class="blacksmithHintBox">
        Select an equipped item above to enhance it.
      </div>
    `}
  `;
}

function renderEnhanceDetails(slot, item) {
  const level = item.enhanceLevel || 0;

  if (level >= MAX_ENHANCE_LEVEL) {
    return `
      <div class="blacksmithEnhancePanel">
        <div class="blacksmithEnhanceHeader">
          <img src="${item.sprite}" onerror="this.style.display='none';">
          <div>
            <b style="color:${item.rarityColor || "#ffcf4a"};">
              ${item.rarityName} ${item.name}
            </b>
            <span>Enhancement +${level} / +${MAX_ENHANCE_LEVEL}</span>
          </div>
        </div>

        <div class="blacksmithMaxedBox">
          ✓ This item is fully enhanced.
        </div>
      </div>
    `;
  }

  const cost = getEnhanceCost(item);

  const ownedMaterial = state.salvageMaterials?.[cost.materialKey] || 0;
  const ownedWhetstones = state.materials?.whetstones || 0;

  const hasGold = state.gold >= cost.gold;
  const hasMaterials = ownedMaterial >= cost.materials;
  const hasWhetstones = ownedWhetstones >= cost.whetstones;

  const canEnhance = hasGold && hasMaterials && hasWhetstones;

  return `
    <div class="blacksmithEnhancePanel">
      <div class="blacksmithEnhanceHeader">
        <img src="${item.sprite}" onerror="this.style.display='none';">

        <div>
          <b style="color:${item.rarityColor || "#ffcf4a"};">
            ${item.rarityName} ${item.name}
          </b>
          <span>Enhancement +${level} / +${MAX_ENHANCE_LEVEL}</span>
        </div>
      </div>

      <div class="blacksmithEnhanceGrid">
        <div class="blacksmithCostBox">
          <b>${cost.chance}%</b>
          <span>Success</span>
        </div>

        <div class="blacksmithCostBox ${hasGold ? "" : "missing"}">
          <b>${fmt(cost.gold)}</b>
          <span>Gold Cost</span>
        </div>

        <div class="blacksmithCostBox ${hasMaterials ? "" : "missing"}">
          <b>${ownedMaterial} / ${cost.materials}</b>
          <span>${cost.materialKey.replace("Material", "")}</span>
        </div>

        <div class="blacksmithCostBox ${hasWhetstones ? "" : "missing"}">
          <b>${ownedWhetstones} / ${cost.whetstones}</b>
          <span>Whetstones</span>
        </div>
      </div>

      <button 
        class="rebirthBuyBtn blacksmithEnhanceBtn ${canEnhance ? "" : "disabledEnhanceBtn"}"
        onclick="enhanceEquippedItem('${slot}')"
        ${canEnhance ? "" : "disabled"}
      >
        Enhance Item
      </button>
    </div>
  `;
}

function selectEnhanceItem(slot) {
  if (selectedEnhanceSlot === slot) {
    selectedEnhanceSlot = null;
  } else {
    selectedEnhanceSlot = slot;
  }

  renderBlacksmithPanel();
}

function enhanceEquippedItem(slot) {
  const item = state.equipment?.[slot];
  if (!item) return;

  const level = item.enhanceLevel || 0;
  if (level >= MAX_ENHANCE_LEVEL) return;

  const cost = getEnhanceCost(item);

  const missing = [];

  if (state.gold < cost.gold) {
    missing.push("gold");
  }

  if ((state.salvageMaterials?.[cost.materialKey] || 0) < cost.materials) {
    missing.push("materials");
  }

  if ((state.materials?.whetstones || 0) < cost.whetstones) {
    missing.push("whetstones");
  }

  if (missing.length > 0) {
    showFilterNotification(
      "sell",
      `Not enough ${missing.join(", ")}.`
    );
    return;
  }

  state.gold -= cost.gold;
  state.salvageMaterials[cost.materialKey] -= cost.materials;
  state.materials.whetstones -= cost.whetstones;

  const roll = Math.random() * 100;

  if (roll <= cost.chance) {
    item.enhanceLevel = level + 1;

    showFilterNotification(
      "salvage",
      `🛠 Enhanced ${item.name} to +${item.enhanceLevel}`
    );
  } else {
    showFilterNotification(
      "sell",
      `❌ Enhancement failed. ${item.name} stayed +${level}`
    );
  }

  renderBlacksmithPanel();
  renderEquipmentSlots();
  updateUI();
  saveGame();
}

function renderRebirthMenu() {
  const box = document.getElementById("rebirthMenuContent");
  if (!box) return;

  if (!state.rebirth) state.rebirth = { count: 0, coins: 0 };
  if (!state.rebirthUpgrades) state.rebirthUpgrades = {};

  const reward = calculateRebirthReward();
const canRebirth = reward >= 1;

const nextRewardLevel = getNextRebirthRewardLevel();
const currentLevel = state.level;

const previousRewardLevel =
  reward <= 1
    ? 1
    : getNextRebirthRewardLevel(reward - 1);

const levelRange =
  Math.max(1, nextRewardLevel - previousRewardLevel);

const currentProgress =
  Math.max(0, currentLevel - previousRewardLevel);

const progress = Math.min(
  100,
  (currentProgress / levelRange) * 100
);

  const keepGear = state.rebirthUpgrades?.keepGear > 0;
  const keepMaterialPercent = Math.min(
    50,
    (state.rebirthUpgrades?.keepMaterials || 0) * 5
  );

  box.innerHTML = `
    <div class="rebirthHero ready">
      <div class="rebirthHeroTop">

        <div>
          <div class="rebirthTitle">🔁 Rebirth Chamber</div>

          <div class="rebirthSub">
            Reset this run, return to level 1, and gain permanent Rebirth Coins.
          </div>
        </div>

        <div class="rebirthCoinBox">
          <div class="rebirthCoinAmount">
            +${reward}
          </div>

          <div class="rebirthCoinLabel">
            Coins
          </div>
        </div>

      </div>

      <div class="rebirthProgressWrap">
        <div class="rebirthProgressText">
		<div class="rebirthSub" style="margin-top:4px;">
  Next Rebirth Coin at level ${nextRewardLevel}
</div>
          <span>Current Level</span>
          <b>Level ${state.level}</b>
        </div>

        <div class="rebirthProgressBar">
          <div
            class="rebirthProgressFill"
            style="width:${progress}%;"
          ></div>
        </div>
      </div>

      <button
        class="rebirthMainBtn ${canRebirth ? "ready" : "disabledRebirthBtn"}"
        onclick="performRebirth()"
      >
        ${
          canRebirth
            ? `Rebirth Now for ${reward} coin${reward === 1 ? "" : "s"}`
            : `Reach level 50 to earn your first Rebirth Coin`
        }
      </button>
    </div>

    <div class="rebirthInfoGrid threeColumns">

      <div class="rebirthInfoBox keep">
        <div class="rebirthInfoTitle">
          ✅ Permanent Progress
        </div>

        <div>Rebirth Coins</div>
        <div>Rebirth Shop upgrades</div>
        <div>Monster Research progress</div>
        <div>Stars and Starforge progress</div>
        <div>Constellations and Depot Tabs</div>
        <div>Fishing progress, fish and fishing upgrades</div>
        <div>Summon skins, skin shards and skin levels</div>
        <div>Backpack items, Treasure Chests and Keys</div>
        <div>Statistics and lifetime progress</div>
      </div>

      <div class="rebirthInfoBox protect">
        <div class="rebirthInfoTitle">
          🛡 Protected By Upgrades
        </div>

        <div>
          ${
            keepGear
              ? "✅ Equipped gear kept with Gear Stash"
              : "❌ Equipped gear resets unless Gear Stash is owned"
          }
        </div>

        <div>
          ${
            keepMaterialPercent > 0
              ? `✅ Keep ${keepMaterialPercent}% of materials`
              : "❌ Materials reset unless Keep Materials is owned"
          }
        </div>
      </div>

      <div class="rebirthInfoBox lose">
        <div class="rebirthInfoTitle">
          ❌ Reset This Run
        </div>

        <div>Level → 1</div>
        <div>EXP → 0</div>
        <div>Gold → 0</div>
        <div>Current zone → Rookgaard Sewers</div>
        <div>Weapon progression → Sword</div>
        <div>Skill tree progress</div>
        <div>Temporary potion buffs</div>
        <div>Current monsters and encounters</div>
      </div>

    </div>
  `;
}

function ensureItemId(item) {
  if (!item) return null;

  if (!item.id) {
    item.id = crypto?.randomUUID
      ? crypto.randomUUID()
      : `item_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  return item.id;
}

function createEmptyLoadoutSlots() {
  return Object.fromEntries(LOADOUT_SLOT_KEYS.map(slot => [slot, null]));
}

function normalizeLoadouts() {
  if (!state.loadouts) {
    state.loadouts = structuredClone(DEFAULT_LOADOUTS);
  }

  if (typeof state.loadouts.activeIndex !== "number") {
    state.loadouts.activeIndex = 0;
  }

  if (!Array.isArray(state.loadouts.stash)) {
    state.loadouts.stash = [];
  }

  if (!Array.isArray(state.loadouts.sets)) {
    state.loadouts.sets = [];
  }

  while (state.loadouts.sets.length < 3) {
    state.loadouts.sets.push({
      name: `Loadout ${state.loadouts.sets.length + 1}`,
      slots: createEmptyLoadoutSlots()
    });
  }

  state.loadouts.sets.forEach((loadout, index) => {
    if (!loadout.name) {
      loadout.name = `Loadout ${index + 1}`;
    }

    if (!loadout.slots) {
      loadout.slots = createEmptyLoadoutSlots();
    }

    LOADOUT_SLOT_KEYS.forEach(slotKey => {
      if (!(slotKey in loadout.slots)) {
        loadout.slots[slotKey] = null;
      }
    });
  });

  state.loadouts.activeIndex = Math.max(
    0,
    Math.min(state.loadouts.activeIndex, state.loadouts.sets.length - 1)
  );

  state.loadouts.stash.forEach(ensureItemId);
}

function getActiveLoadout() {
  normalizeLoadouts();
  return state.loadouts.sets[state.loadouts.activeIndex];
}

function findLoadoutStashItem(itemId) {
  normalizeLoadouts();

  return state.loadouts.stash.find(item =>
    String(item?.id) === String(itemId)
  ) || null;
}

function isItemUsedByAnyLoadout(itemId) {
  if (!itemId) return false;

  normalizeLoadouts();

  return state.loadouts.sets.some(loadout =>
    Object.values(loadout.slots || {}).includes(itemId)
  );
}

function isItemInLoadoutStash(itemId) {
  if (!itemId) return false;
  normalizeLoadouts();
  return state.loadouts.stash.some(item => item?.id === itemId);
}

function addItemToLoadoutStash(item) {
  if (!item) return null;

  normalizeLoadouts();

  if (!item.id) {
    ensureItemId(item);
  }

  const existing = state.loadouts.stash.find(stashItem =>
    String(stashItem?.id) === String(item.id)
  );

  if (existing) {
    return existing;
  }

  state.loadouts.stash.push(item);

  return item;
}

function addItemToDepotDirect(item) {
  if (!item) return false;

  ensureItemId(item);

  const alreadyInDepot = state.depot.tabs.some(tab =>
    Array.isArray(tab) && tab.some(depotItem => String(depotItem?.id) === String(item.id))
  );

  if (alreadyInDepot) return true;

  for (let t = 0; t < state.depot.tabs.length; t++) {
    const tab = state.depot.tabs[t];
    if (!Array.isArray(tab)) continue;

    for (let i = 0; i < tab.length; i++) {
      if (!tab[i]) {
        tab[i] = item;
        return true;
      }
    }
  }

  return false;
}

function removeUnusedLoadoutStashItem(itemId) {
  if (!itemId) return;

  normalizeLoadouts();

  if (isItemUsedByAnyLoadout(itemId)) return;

  const index = state.loadouts.stash.findIndex(item =>
    String(item?.id) === String(itemId)
  );

  if (index === -1) return;

  const [item] = state.loadouts.stash.splice(index, 1);

  if (!item) return;

  const alreadyInDepot = state.depot.tabs.some(tab =>
    Array.isArray(tab) && tab.some(depotItem => String(depotItem?.id) === String(itemId))
  );

  const alreadyEquipped = Object.values(state.equipment || {}).some(equippedItem =>
    String(equippedItem?.id) === String(itemId)
  );

  if (alreadyInDepot || alreadyEquipped) return;

  const inserted = addItemToDepotDirect(item);

  if (!inserted) {
    state.loadouts.stash.push(item);
    showFilterNotification("system", "Loadout stash item could not return to depot because the depot is full.");
  }
}

function setActiveLoadout(index) {
  normalizeLoadouts();
  state.loadouts.activeIndex = Math.max(0, Math.min(index, state.loadouts.sets.length - 1));
  hideItemTooltip();
  renderDepotPanel();
  saveGame();
}

function renameActiveLoadout() {
  const loadout = getActiveLoadout();
  const name = prompt("Loadout name:", loadout.name);

  if (!name) return;

  loadout.name = name.trim().slice(0, 24) || loadout.name;
  renderDepotPanel();
  saveGame();
}

function handleDepotItemDragStart(event, tabIndex, slotIndex) {
  const item = state.depot.tabs?.[tabIndex]?.[slotIndex];
  if (!item) return;

  ensureItemId(item);

  const dragData = {
    source: "depot",
    tabIndex: Number(tabIndex),
    slotIndex: Number(slotIndex),
    itemId: item.id
  };

  window.currentLoadoutDragData = dragData;

  event.stopPropagation();
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
}

function handleStashItemDragStart(event, itemId) {
  event.dataTransfer.setData("text/plain", JSON.stringify({
    source: "stash",
    itemId
  }));
}

function allowLoadoutDrop(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function handleLoadoutPanelDrop(event) {
  const slotElement = event.target.closest(".loadoutSlot");
  if (!slotElement) return;

  const slotKey = slotElement.dataset.slotKey;
  if (!slotKey) return;

  handleLoadoutSlotDrop(event, slotKey);
}

function handleLoadoutSlotsAreaDrop(event) {
  event.preventDefault();
  event.stopPropagation();

  let data = window.currentLoadoutDragData || null;
  const raw = event.dataTransfer.getData("text/plain");

  if (!data && raw) {
    try {
      data = JSON.parse(raw);
    } catch (error) {
      console.warn("Invalid loadout area drop data:", raw);
      return;
    }
  }

  window.currentLoadoutDragData = null;

  if (!data) {
    console.warn("Loadout area drop failed: no drag data.");
    return;
  }

  if (data.source === "depot") {
    assignDepotItemToActiveLoadoutByOwnType(Number(data.tabIndex), Number(data.slotIndex));
    return;
  }

  if (data.source === "equipment") {
    assignEquipmentItemToLoadout(data.slotKey, data.slotKey);
    return;
  }

  if (data.source === "stash") {
    const item = findLoadoutStashItem(data.itemId);
    if (!item) return;

    assignStashItemToLoadout(data.itemId, item.type);
  }
}

function handleLoadoutSlotDrop(event, slotKey) {
  event.preventDefault();
  event.stopPropagation();

  let data = window.currentLoadoutDragData || null;
  const raw = event.dataTransfer.getData("text/plain");

  if (!data && raw) {
    try {
      data = JSON.parse(raw);
    } catch (error) {
      console.warn("Invalid loadout drop data:", raw);
      return;
    }
  }

  window.currentLoadoutDragData = null;

  if (!data) {
    console.warn("Loadout drop failed: no drag data.");
    return;
  }

  if (data.source === "depot") {
    assignDepotItemToLoadout(Number(data.tabIndex), Number(data.slotIndex), slotKey);
    return;
  }

  if (data.source === "equipment") {
    assignEquipmentItemToLoadout(data.slotKey, slotKey);
    return;
  }

  if (data.source === "stash") {
    assignStashItemToLoadout(data.itemId, slotKey);
  }
}

function normalizeLoadoutSlotKey(slotKey) {
  const aliases = {
    boots: "shoes",
    shoe: "shoes",
    amulet: "necklace",
    necklace: "necklace"
  };

  return aliases[slotKey] || slotKey;
}

function assignEquipmentItemToLoadout(equipmentSlotKey, loadoutSlotKey) {
  normalizeLoadouts();

  const item = state.equipment?.[equipmentSlotKey];
  if (!item) return;

  if (equipmentSlotKey !== loadoutSlotKey) {
    showFilterNotification(
      "system",
      `${item.name} belongs in ${getLoadoutSlotLabel(equipmentSlotKey)}, not ${getLoadoutSlotLabel(loadoutSlotKey)}.`
    );
    return;
  }

  if (item.type !== loadoutSlotKey) {
    showFilterNotification(
      "system",
      `${item.name} belongs in ${getLoadoutSlotLabel(item.type)}, not ${getLoadoutSlotLabel(loadoutSlotKey)}.`
    );
    return;
  }

  const loadout = getActiveLoadout();
  const previousItemId = loadout.slots[loadoutSlotKey];

  ensureItemId(item);
  addItemToLoadoutStash(item);

  state.equipment[equipmentSlotKey] = null;
  loadout.slots[loadoutSlotKey] = item.id;

  removeUnusedLoadoutStashItem(previousItemId);

  hideItemTooltip();
  renderEquipmentSlots();
  renderDepotPanel();
  updateUI();
  saveGame();

  showFilterNotification("system", `Saved ${item.name} to ${loadout.name}.`);
}

function assignDepotItemToLoadout(tabIndex, slotIndex, slotKey) {
  normalizeLoadouts();

  tabIndex = Number(tabIndex);
  slotIndex = Number(slotIndex);

  const item = state.depot.tabs?.[tabIndex]?.[slotIndex];
  if (!item) return;

  const targetSlotKey = normalizeLoadoutSlotKey(slotKey);
  const itemSlotKey = normalizeLoadoutSlotKey(item.type);

  if (itemSlotKey !== targetSlotKey) {
    showFilterNotification(
      "system",
      `${item.name} belongs in ${getLoadoutSlotLabel(itemSlotKey)}, not ${getLoadoutSlotLabel(targetSlotKey)}.`
    );
    return;
  }

  ensureItemId(item);

  const loadout = getActiveLoadout();
  const previousItemId = loadout.slots[targetSlotKey];

  // 1. Add item to protected stash
  addItemToLoadoutStash(item);

  // 2. Save the exact item ID into the visible loadout slot
  loadout.slots[targetSlotKey] = item.id;

  // 3. Remove from depot only after slot is saved
  state.depot.tabs[tabIndex][slotIndex] = null;
  compactDepotTab(tabIndex);

  // 4. Return replaced item if no loadout uses it anymore
  if (previousItemId && previousItemId !== item.id) {
    removeUnusedLoadoutStashItem(previousItemId);
  }

  console.log("Loadout saved:", {
    targetSlotKey,
    itemId: item.id,
    loadoutSlots: structuredClone(loadout.slots),
    stashIds: state.loadouts.stash.map(stashItem => stashItem.id)
  });

  hideItemTooltip();
  renderDepotPanel();
  renderLoadoutsPanel();
  saveGame();

  showFilterNotification(
    "system",
    `Saved ${item.name} to ${loadout.name} ${getLoadoutSlotLabel(targetSlotKey)} slot.`
  );
}

function getLoadoutNamesUsingItem(itemId) {
  normalizeLoadouts();

  return state.loadouts.sets
    .filter(loadout =>
      Object.values(loadout.slots || {}).some(slotItemId =>
        String(slotItemId) === String(itemId)
      )
    )
    .map(loadout => loadout.name);
}

function assignDepotItemToActiveLoadoutByOwnType(tabIndex, slotIndex) {
  normalizeLoadouts();

  const item = state.depot.tabs?.[tabIndex]?.[slotIndex];
  if (!item) return;

  const slotKey = normalizeLoadoutSlotKey(item.type);

  if (!LOADOUT_SLOT_KEYS.includes(slotKey)) {
    showFilterNotification("system", `${item.name} cannot be used in loadouts.`);
    return;
  }

  assignDepotItemToLoadout(Number(tabIndex), Number(slotIndex), slotKey);
}

function assignStashItemToLoadout(itemId, slotKey) {
  normalizeLoadouts();

  const item = findLoadoutStashItem(itemId);
  if (!item) return;

  if (item.type !== slotKey) {
    showFilterNotification("system", `${item.name} belongs in ${item.type}, not ${slotKey}.`);
    return;
  }

  const loadout = getActiveLoadout();
  const previousItemId = loadout.slots[slotKey];

  loadout.slots[slotKey] = item.id;
  removeUnusedLoadoutStashItem(previousItemId);

  hideItemTooltip();
  showFilterNotification("system", `Saved ${item.name} to ${loadout.name}.`);
  renderDepotPanel();
  saveGame();
}

function clearActiveLoadoutSlot(slotKey) {
  const loadout = getActiveLoadout();
  const previousItemId = loadout.slots[slotKey];

  loadout.slots[slotKey] = null;
  removeUnusedLoadoutStashItem(previousItemId);

  hideItemTooltip();
  renderDepotPanel();
  saveGame();
}

function clearActiveLoadout() {
  const loadout = getActiveLoadout();
  const removedIds = Object.values(loadout.slots).filter(Boolean);

  loadout.slots = createEmptyLoadoutSlots();

  removedIds.forEach(removeUnusedLoadoutStashItem);

  hideItemTooltip();
  renderDepotPanel();
  saveGame();

  showFilterNotification("system", `Cleared ${loadout.name}.`);
}

function loadActiveLoadout() {
  normalizeLoadouts();

  const loadout = getActiveLoadout();
  let equippedCount = 0;
  let missingCount = 0;

  LOADOUT_SLOT_KEYS.forEach(slotKey => {
    const itemId = loadout.slots[slotKey];
    if (!itemId) return;

    const item = findLoadoutStashItem(itemId);

    if (!item) {
      loadout.slots[slotKey] = null;
      missingCount++;
      return;
    }

    const previous = state.equipment[slotKey];

    if (previous && previous.id !== item.id && !isItemInLoadoutStash(previous.id)) {
      addItemToDepotDirect(previous);
    }

    state.equipment[slotKey] = item;
    equippedCount++;
  });

  hideItemTooltip();
  renderEquipmentSlots();
  renderDepotPanel();
  updateUI();
  saveGame();

  if (equippedCount > 0) {
    showFilterNotification("system", `Loaded ${loadout.name}: equipped ${equippedCount} item${equippedCount === 1 ? "" : "s"}.`);
  } else {
    showFilterNotification("system", `${loadout.name} has no gear saved.`);
  }

  if (missingCount > 0) {
    showFilterNotification("system", `${missingCount} missing loadout item${missingCount === 1 ? "" : "s"} were cleared.`);
  }
}

function getLoadoutSlotLabel(slotKey) {
  return EQUIPMENT_SLOTS.find(slot => slot.key === slotKey)?.name || slotKey;
}

function renderLoadoutsPanel() {
  const depotPanel = document.getElementById("depotPanel");
if (!depotPanel) return;

let wrapper = document.getElementById("depotLoadoutWrapper");

if (!wrapper) {
  wrapper = document.createElement("div");
  wrapper.id = "depotLoadoutWrapper";

  depotPanel.parentNode.insertBefore(wrapper, depotPanel);
  wrapper.appendChild(depotPanel);
}

  normalizeLoadouts();

  let panel = document.getElementById("loadoutsPanel");

  if (!panel) {
    panel = document.createElement("div");
    panel.id = "loadoutsPanel";
    wrapper.appendChild(panel);
  }

  const activeLoadout = getActiveLoadout();

  const tabsHtml = state.loadouts.sets.map((loadout, index) => `
    <button class="loadoutTab ${index === state.loadouts.activeIndex ? "active" : ""}" onclick="setActiveLoadout(${index})">
      ${loadout.name}
    </button>
  `).join("");

  const slotsHtml = LOADOUT_SLOT_KEYS.map(slotKey => {
    const itemId = activeLoadout.slots[slotKey];
    
	const item = itemId ? findLoadoutStashItem(itemId) : null;
	
    const enhance = item?.enhanceLevel || 0;

    return `
      <div class="loadoutSlot"
  data-slot-key="${slotKey}"
  ondragenter="allowLoadoutDrop(event)"
  ondragover="allowLoadoutDrop(event)"
  ondrop="handleLoadoutSlotDrop(event, '${slotKey}')"
>
        <div class="loadoutSlotTitle">${getLoadoutSlotLabel(slotKey)}</div>

        ${item ? `
          <div class="loadoutSlotItem"
  onmouseenter="showItemTooltip(findLoadoutStashItem('${item.id}'), event.clientX, event.clientY, true)"
  onmousemove="moveItemTooltip(event.clientX, event.clientY)"
  onmouseleave="hideItemTooltip()"
>
            <img src="${item.sprite}" class="loadoutItemSprite" onerror="this.style.display='none';">
            ${enhance > 0 ? `<div class="loadoutEnhance">+${enhance}</div>` : ""}
            <div class="loadoutItemName" style="color:${item.rarityColor || "#c7a044"};">T${item.tier} ${item.name}</div>
          </div>
          <button class="loadoutSmallBtn" onclick="clearActiveLoadoutSlot('${slotKey}')">Remove</button>
        ` : `
          <div class="loadoutEmpty">Drop ${getLoadoutSlotLabel(slotKey)} here</div>
        `}
      </div>
    `;
  }).join("");

  const stashHtml = state.loadouts.stash.length > 0
  ? state.loadouts.stash.map(item => {
    const usedBy = getLoadoutNamesUsingItem(item.id);
    const usedByText = usedBy.length > 0 ? usedBy.join(", ") : "Unused";

    return `
      <div class="loadoutStashItem"
        draggable="true"
        ondragstart="handleStashItemDragStart(event, '${item.id}')"
        onmouseenter="showItemTooltip(findLoadoutStashItem('${item.id}'), event.clientX, event.clientY, true)"
        onmousemove="moveItemTooltip(event.clientX, event.clientY)"
        onmouseleave="hideItemTooltip()"
      >
        <img src="${item.sprite}" class="loadoutStashSprite" onerror="this.style.display='none';">
        <div class="loadoutStashName" style="color:${item.rarityColor || "#c7a044"};">
          T${item.tier} ${item.name}
        </div>
        <div class="loadoutStashUsedBy">
          ${usedByText}
        </div>
      </div>
    `;
  }).join("")
  : `<div class="loadoutStashEmpty">No loadout gear stored yet.</div>`;

panel.ondragover = allowLoadoutDrop;
panel.ondrop = handleLoadoutPanelDrop;

  panel.innerHTML = `
    <div class="loadoutsHeader">
      <div>
        <div class="loadoutsTitle">Loadouts</div>
        <div class="loadoutsHint">Drag depot gear into a slot. Loadout gear moves to the stash and cannot be sold or salvaged.</div>
      </div>
      <div class="loadoutsActions">
        <button onclick="loadActiveLoadout()">Load</button>
        <button onclick="renameActiveLoadout()">Rename</button>
        <button onclick="clearActiveLoadout()">Clear</button>
      </div>
    </div>

    <div class="loadoutTabs">${tabsHtml}</div>
    <div class="loadoutSlotsGrid">
  ${slotsHtml}
</div>

    <div class="loadoutStashHeader">Loadout Stash</div>
    <div class="loadoutStashGrid">${stashHtml}</div>
  `;
}