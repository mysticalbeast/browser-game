// =====================
// FISHING CONFIG
// =====================

const FISHING_BASE_COOLDOWN_MS = 60 * 1000;
const FISHING_BASE_CATCH_CHANCE = 0.10;

// =====================
// FISHING STATE
// =====================

function getFishingSkinCooldownReduction() {
  const level =
    state.skins?.equipped?.minotaurArcher === "fisherman"
      ? (state.skins.levels?.fisherman || 0)
      : 0;

  return level * 450;
}

function getFishingGoldGainBonus() {
  initializeFishing();
  return 1 + (state.fishing.shopUpgrades?.biggerPouches || 0) * 0.01;
}

function getFishingExpGainBonus() {
  initializeFishing();
  return 1 + (state.fishing.shopUpgrades?.shinierGems || 0) * 0.01;
}

function getAscendedFishermanGolemCooldownReduction() {
  initializeSkins();

  const data = state.skins?.owned?.minotaurFisherman;

  if (!data?.ascended) return 0;

  const ascendedLevel = data.ascendedLevel || 0;

  return ascendedLevel * 450;
}

function getFishingGolemCooldownMs() {
  initializeFishing();

  const upgradeLevel =
    state.fishing.golems?.clockworkCasting || 0;

  let cooldown =
    FISHING_BASE_COOLDOWN_MS - (upgradeLevel * 500);

  cooldown -= getAscendedFishermanGolemCooldownReduction();

  return Math.max(1000, cooldown);
}

function getFishingGolemCatchChance() {
  initializeFishing();

  const precision =
    state.fishing.golems?.mechanicalPrecision || 0;

  return Math.min(
    1,
    FISHING_BASE_CATCH_CHANCE + precision * 0.01
  );
}

function getFishingGolemTimeLeftText() {
  initializeFishing();

  if (getTotalPlacedFishingGolems() <= 0) {
    return "Inactive";
  }

  const now = Date.now();

  if (state.fishing.golems.nextAttemptAt <= now) {
    return "Ready";
  }

  const msLeft = Math.max(0, state.fishing.golems.nextAttemptAt - now);
  const seconds = Math.ceil(msLeft / 1000);

  return `${seconds}s`;
}

function initializeFishing() {
  if (!state.fishing) {
    state.fishing = {
      fish: 0,
      rodOwned: true, // temporary: enabled for testing
      lastAttemptAt: 0,
      nextAttemptAt: Date.now() + FISHING_BASE_COOLDOWN_MS,
      upgrades: {},
      shopUpgrades: {},
      golems: {}
    };
  }

  if (typeof state.fishing.fish !== "number") state.fishing.fish = 0;
  if (typeof state.fishing.rodOwned !== "boolean") state.fishing.rodOwned = true;
  if (typeof state.fishing.lastAttemptAt !== "number") state.fishing.lastAttemptAt = 0;

  if (typeof state.fishing.nextAttemptAt !== "number") {
    state.fishing.nextAttemptAt = Date.now() + FISHING_BASE_COOLDOWN_MS;
  }

  if (!state.fishing.upgrades) state.fishing.upgrades = {};
  if (!state.fishing.shopUpgrades) state.fishing.shopUpgrades = {};
  if (!state.fishing.golems) state.fishing.golems = {};

  const rodDefaults = {
    quickCast: 0,
    luckyHook: 0,
    schoolOverflow: 0,
    doubleHook: 0,
    tripleHook: 0
  };

  Object.entries(rodDefaults).forEach(([key, value]) => {
    if (typeof state.fishing.upgrades[key] !== "number") {
      state.fishing.upgrades[key] = value;
    }
  });

  const shopDefaults = {
    goldenFish: 0,
    powerfulFish: 0,
    empoweredCompanions: 0,
    biggerPouches: 0,
    shinierGems: 0,
    bonusSP: 0
  };

  Object.entries(shopDefaults).forEach(([key, value]) => {
    if (typeof state.fishing.shopUpgrades[key] !== "number") {
      state.fishing.shopUpgrades[key] = value;
    }
  });

  const golemNumberDefaults = {
    owned: 0,
    nextAttemptAt: Date.now() + FISHING_BASE_COOLDOWN_MS,
    clockworkCasting: 0,
    mechanicalPrecision: 0,
    overclockedEfficiency: 0,
    precisionHooking: 0,
    overtunedHooking: 0
  };

  Object.entries(golemNumberDefaults).forEach(([key, value]) => {
    if (typeof state.fishing.golems[key] !== "number") {
      state.fishing.golems[key] = value;
    }
  });

  if (
    !state.fishing.golems.placedByZone ||
    typeof state.fishing.golems.placedByZone !== "object" ||
    Array.isArray(state.fishing.golems.placedByZone)
  ) {
    state.fishing.golems.placedByZone = {};
  }

  if (
    typeof state.fishing.golems.placed === "number" &&
    state.fishing.golems.placed > 0 &&
    Object.keys(state.fishing.golems.placedByZone).length === 0
  ) {
    const zoneId = getCurrentZoneId?.() || 1;

    state.fishing.golems.placedByZone[zoneId] =
      state.fishing.golems.placed;
  }

  delete state.fishing.golems.placed;
}

function getSkinSummonBonus() {
  return 1;
}

function getResearchSummonBonus() {
  return 1;
}

function getTotalSummonDamageMultiplier() {
  let multiplier = 1;

  multiplier *= getFishingSummonDamageBonus?.() || 1;
  multiplier *= getSkinSummonBonus?.() || 1;
  multiplier *= getResearchSummonBonus?.() || 1;

  return multiplier;
}

function getFishingSummonDamageBonus() {
  initializeFishing();

  const level = state.fishing.shopUpgrades?.empoweredCompanions || 0;

  return 1 + level * 0.01;
}

function getFish() {
  initializeFishing();
  return state.fishing.fish || 0;
}

function getFishingShopBonus(key) {
  initializeFishing();
  return state.fishing.shopUpgrades?.[key] || 0;
}

function addFish(amount) {
  initializeFishing();

  const gained = Math.max(0, Math.floor(amount));
  if (gained <= 0) return;

  state.fishing.fish += gained;
  applyFishingShopRewards(gained);
  
  const keyChance =
  0.005 + ((state.fishing.upgrades?.luckyHook || 0) * 0.00005);

if (Math.random() < keyChance) {
  addInventoryItem?.("chestKey", 1);

  showFilterNotification(
    "loot",
    "🗝️ You fished up a Chest Key!"
  );
}

  showFilterNotification(
    "system",
    `🎣 Caught ${fmt(gained)} fish.`
  );

  if (typeof showFloatingText === "function" && arena) {
    showFloatingText(
      `+${fmt(gained)} 🐟`,
      arena.clientWidth - 140,
      arena.clientHeight - 180,
      "loot"
    );
  }

  updateUI();
  saveGame();
}

// =====================
// FISHING LOGIC
// =====================

function getFishingRewardZone() {
  const zone = currentZone();

  if (
    zone &&
    !zone.isEventZone &&
    !zone.noMonsters &&
    zone.gold &&
    zone.exp
  ) {
    return zone;
  }

  return [...ZONES]
    .filter(z =>
      !z.isEventZone &&
      !z.noMonsters &&
      state.level >= z.levelReq &&
      z.gold &&
      z.exp
    )
    .sort((a, b) => b.levelReq - a.levelReq)[0] || ZONES[0];
}

function getFishingGoldRewardPerFish() {
  initializeFishing();

  const level = state.fishing.shopUpgrades?.goldenFish || 0;
  if (level <= 0) return 0;

  const zone = getFishingRewardZone();
  const averageGold = (zone.gold[0] + zone.gold[1]) / 2;

  return Math.floor(averageGold * (level * 0.01));
}

function getFishingExpRewardPerFish() {
  initializeFishing();

  const level = state.fishing.shopUpgrades?.powerfulFish || 0;
  if (level <= 0) return 0;

  const zone = getFishingRewardZone();
  const averageExp = (zone.exp[0] + zone.exp[1]) / 2;

  return Math.floor(averageExp * (level * 0.01));
}

async function requestBackendFishingShopReward(fishCaught) {
  if (isLocalDevGame?.()) {
    return {
      success: true,
      localOnly: true
    };
  }

  const token = getAuthToken?.();

  if (!token) {
    showFilterNotification?.("system", "Login required for fishing rewards.");
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/fishing/shop-reward`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ fishCaught })
    });

    const data = await response.json();

    if (!response.ok || !data?.success) {
      showFilterNotification?.("system", data?.message || "Fishing reward failed.");
      return null;
    }

    return data.reward;
  } catch (error) {
    console.warn("Fishing reward request failed:", error);
    showFilterNotification?.("system", "Fishing reward request failed.");
    return null;
  }
}

async function applyFishingShopRewards(fishCaught) {
  initializeFishing();

  const amount = Math.max(0, Math.floor(fishCaught));
  if (amount <= 0) return;

  if (isLocalDevGame?.()) {
    const goldGain = getFishingGoldRewardPerFish() * amount;
    const expGain = getFishingExpRewardPerFish() * amount;

    if (goldGain > 0) {
      state.gold = (state.gold || 0) + goldGain;

      if (!state.stats) state.stats = {};
      state.stats.goldEarned = (state.stats.goldEarned || 0) + goldGain;
    }

    if (expGain > 0) {
      state.exp = (state.exp || 0) + expGain;

      if (!state.stats) state.stats = {};
      state.stats.expEarned = (state.stats.expEarned || 0) + expGain;

      checkLevelUp();
    }

    if (goldGain > 0 || expGain > 0) {
      showFilterNotification(
        "system",
        `🎣 Fishing bonus: +${fmt(goldGain)} gold, +${fmt(expGain)} EXP.`
      );
    }

    return;
  }

  const reward = await requestBackendFishingShopReward(amount);

  if (!reward) return;

  const goldGain = Number(reward.gold || 0);
  const expGain = Number(reward.exp || 0);

  if (goldGain > 0) {
    state.gold = (state.gold || 0) + goldGain;
  }

  if (typeof reward.level === "number") {
    state.level = reward.level;
  }

  if (typeof reward.currentExp === "number") {
    state.exp = reward.currentExp;
  }

  if (typeof reward.skillPoints === "number") {
    state.skillPoints = reward.skillPoints;
  }

  if (goldGain > 0 || expGain > 0) {
    showFilterNotification(
      "system",
      `🎣 Fishing bonus: +${fmt(goldGain)} gold, +${fmt(expGain)} EXP.`
    );
  }

  updateUI?.();
  saveGame?.();
}

function buyFishingShopUpgrade(key, baseCost, maxLevel) {
  initializeFishing();

  const current =
    state.fishing.shopUpgrades[key] || 0;

  const cost =
    getScaledUpgradeCost(baseCost, current, 1.025);

  if (current >= maxLevel) return;

  if ((state.fishing.fish || 0) < cost) {
    showFilterNotification(
      "system",
      `Need ${fmt(cost)} fish.`
    );

    return;
  }

  state.fishing.fish -= cost;

  state.fishing.shopUpgrades[key] =
    current + 1;

  if (key === "bonusSP") {
    state.skillPoints =
      (state.skillPoints || 0) + 1;

    showFilterNotification(
      "system",
      `🧠 Bonus SP upgraded for ${fmt(cost)} fish. +1 Skill Point gained.`
    );
  } else {
    showFilterNotification(
      "system",
      `🎣 Fishing shop upgraded ${key} for ${fmt(cost)} fish.`
    );
  }

  updateUI();

  renderFishingPanel?.(
    state.activeFishingTab || "shop"
  );

  saveGame();
}

function getFishingFishMultiplier() {
  initializeFishing();

  const schoolLevel =
    state.fishing.upgrades?.schoolOverflow || 0;

  const overclockLevel =
    state.fishing.golems?.overclockedEfficiency || 0;

  const schoolMultiplier =
    1 + schoolLevel * 0.05;

  const overclockMultiplier =
    1 + overclockLevel * 0.02;

  return schoolMultiplier * overclockMultiplier;
}

function getFishingCatchAmount() {
  initializeFishing();

  const overflowMultiplier = getFishingFishMultiplier();

  const guaranteed = Math.floor(overflowMultiplier);
  const extraChance = overflowMultiplier - guaranteed;

  let amount = guaranteed;

  if (Math.random() < extraChance) {
    amount++;
  }

  amount = Math.max(1, amount);

  const doubleChance =
    (state.fishing.upgrades?.doubleHook || 0) * 0.005;

  const tripleChance =
    (state.fishing.upgrades?.tripleHook || 0) * 0.005;

  let doubleTriggered = false;
  let tripleTriggered = false;

  // Double catch roll
  if (Math.random() < doubleChance) {
    amount *= 2;
    doubleTriggered = true;

    showFilterNotification(
      "loot",
      "🎣 Double Hook triggered!"
    );

    // Triple roll only after successful double
    if (Math.random() < tripleChance) {
      amount *= 3;
      tripleTriggered = true;

      showFilterNotification(
        "loot",
        "🎣 Triple Hook triggered!"
      );
    }
  }

  // Bonus visual flavor for huge catches
  if (amount >= 10) {
    showFilterNotification(
      "loot",
      `🐟 Massive catch! +${fmt(amount)} fish`
    );
  }

  return Math.max(1, Math.floor(amount));
}

function canFishInCurrentZone() {
  const zone = currentZone();
  if (!zone) return false;
  if (zone.noMonsters) return false;
  if (zone.isEventZone) return false;

  return true;
}

function getFishingCooldownMs() {
  initializeFishing();

  const quickCastLevel =
    state.fishing.upgrades?.quickCast || 0;

  let cooldown =
    FISHING_BASE_COOLDOWN_MS - (quickCastLevel * 500);

  const activeMinotaurSkin =
    state.skins?.active?.minotaur;

  if (activeMinotaurSkin === "minotaurFisherman") {
    const fishermanLevel =
      state.skins?.owned?.minotaurFisherman?.level || 0;

    cooldown -= fishermanLevel * 450;
  }

  return Math.max(1000, cooldown);
}

function getFishingCatchChance() {
  initializeFishing();

  const bonus =
    (state.fishing.upgrades?.luckyHook || 0) * 0.01;

  return Math.min(
    1,
    FISHING_BASE_CATCH_CHANCE + bonus
  );
}

function rollFishingTreasureChest(chanceMultiplier = 1) {
  const chance = 0.00002 * chanceMultiplier;

  if (Math.random() > chance) return false;

  addInventoryItem("goldenTreasureChest", 1);

  showFilterNotification(
    "loot",
    "🟨 Golden Treasure Chest found while fishing!"
  );

  renderBackpack?.();
  saveGame();

  return true;
}

function attemptFishing(now = Date.now()) {
  initializeFishing();

  if (!state.fishing.rodOwned) return;
  if (!canFishInCurrentZone()) return;

  if (now < state.fishing.nextAttemptAt) return;

  state.fishing.lastAttemptAt = now;
  state.fishing.nextAttemptAt = now + getFishingCooldownMs();

  const chance = getFishingCatchChance();

  if (Math.random() <= chance) {
    const fishCaught = getFishingCatchAmount();

    addFish(fishCaught);
    rollFishingTreasureChest(fishCaught);

    if (state.skins?.active?.minotaur === "minotaurFisherman") {
      addSkinProgress?.("fishingCatches", 1);
    }

    showFilterNotification(
      "loot",
      `🎣 Fishing Rod caught ${fmt(fishCaught)} fish.`
    );
  } else {
    showFilterNotification("system", "🎣 Fishing attempt failed.");
  }

  renderFishingPanel?.(state.activeFishingTab || "rod");
  saveGame();
}

function attemptFishingGolems(now = Date.now()) {
  initializeFishing();

  const golemsPlaced = getTotalPlacedFishingGolems();

  if (golemsPlaced <= 0) return;

  if (now < state.fishing.golems.nextAttemptAt) return;

  state.fishing.golems.nextAttemptAt = now + getFishingGolemCooldownMs();

  const catchChance = getFishingGolemCatchChance();

  const doubleChance =
    (state.fishing.golems?.precisionHooking || 0) * 0.005;

  const tripleChance =
    (state.fishing.golems?.overtunedHooking || 0) * 0.005;

  let totalFish = 0;
  let successfulGolems = 0;
  let doubleTriggered = false;
  let tripleTriggered = false;

  for (let i = 0; i < golemsPlaced; i++) {
    if (Math.random() > catchChance) continue;

    successfulGolems++;

    let fishCaught = getFishingCatchAmount();

    if (Math.random() < doubleChance) {
      fishCaught *= 2;
      doubleTriggered = true;

      if (Math.random() < tripleChance) {
        fishCaught *= 3;
        tripleTriggered = true;
      }
    }

    totalFish += Math.floor(fishCaught);
  }

  if (totalFish > 0) {
    addFish(totalFish);
    rollFishingTreasureChest(totalFish);

    if (state.skins?.active?.minotaur === "minotaurFisherman") {
      addAscendedSkinProgress?.("minotaurFisherman", successfulGolems);
    }

    showFilterNotification(
      "loot",
      `🤖 Golems caught ${fmt(totalFish)} fish.`
    );

    if (doubleTriggered) {
      showFilterNotification("loot", "🤖 Precision Hooking triggered!");
    }

    if (tripleTriggered) {
      showFilterNotification("loot", "🤖 Overtuned Hooking triggered!");
    }
  } else {
    showFilterNotification(
      "system",
      "🤖 Golems tried fishing but caught nothing."
    );
  }

  renderFishingPanel?.(state.activeFishingTab || "golems");
  saveGame();
}

function getFishingGolemCost() {
  initializeFishing();

  const owned = state.fishing.golems?.owned || 0;

  return Math.floor(250 * Math.pow(1.35, owned));
}

function buyFishingGolem() {
  initializeFishing();

  const cost = getFishingGolemCost();
  const maxGolems = getMaxFishingGolems();

  if (state.fishing.golems.owned >= maxGolems) {
    showFilterNotification("system", "Maximum Fishing Golems owned.");
    return;
  }

  if ((state.fishing.fish || 0) < cost) {
    showFilterNotification("system", `Need ${fmt(cost)} fish to buy a Fishing Golem.`);
    return;
  }

  state.fishing.fish -= cost;
  state.fishing.golems.owned++;

  showFilterNotification(
    "system",
    `🤖 Bought 1 Fishing Golem for ${fmt(cost)} fish.`
  );

  renderFishingPanel?.(state.activeFishingTab || "golems");
  updateUI();
  saveGame();
}

function buyFishingGolemUpgrade(key, baseCost, maxLevel) {
  initializeFishing();

  const current =
    state.fishing.golems[key] || 0;

  const cost =
    getScaledUpgradeCost(baseCost, current, 1.04);

  if (current >= maxLevel) {
    showFilterNotification(
      "system",
      "Upgrade already maxed."
    );

    return;
  }

  if (getFish() < cost) {
    showFilterNotification(
      "system",
      `Need ${fmt(cost)} fish.`
    );

    return;
  }

  state.fishing.fish -= cost;
  state.fishing.golems[key]++;

  showFilterNotification(
    "system",
    `🤖 Fishing Golem upgraded for ${fmt(cost)} fish.`
  );

  renderFishingPanel("golems");
  updateUI();
  saveGame();
}

function getCurrentFishingZoneId() {
  return getCurrentZoneId();
}

function getPlacedFishingGolemsInCurrentZone() {
  initializeFishing();

  const zoneId = getCurrentFishingZoneId();

  return state.fishing.golems.placedByZone?.[zoneId] || 0;
}

function getTotalPlacedFishingGolems() {
  initializeFishing();

  return Object.values(state.fishing.golems.placedByZone || {})
    .reduce((sum, amount) => sum + amount, 0);
}

function placeFishingGolem() {
  initializeFishing();

  const zone = currentZone();
  const zoneId = getCurrentFishingZoneId();

  if (!zone || zone.noMonsters || zone.isEventZone) {
    showFilterNotification("system", "Fishing Golems can only be placed in monster zones.");
    return;
  }

  const totalPlaced = getTotalPlacedFishingGolems();

  if (totalPlaced >= state.fishing.golems.owned) {
    showFilterNotification("system", "No unplaced Fishing Golems available.");
    return;
  }

  state.fishing.golems.placedByZone[zoneId] =
    (state.fishing.golems.placedByZone[zoneId] || 0) + 1;

  showFilterNotification(
    "system",
    `🤖 Placed 1 Fishing Golem in ${zone.name}.`
  );

  renderFishingPanel?.(state.activeFishingTab || "golems");
  saveGame();
}

function removeFishingGolem() {
  initializeFishing();

  const zone = currentZone();
  const zoneId = getCurrentFishingZoneId();

  const placedHere = getPlacedFishingGolemsInCurrentZone();

  if (placedHere <= 0) {
    showFilterNotification("system", "No Fishing Golem placed in this zone.");
    return;
  }

  state.fishing.golems.placedByZone[zoneId]--;

  if (state.fishing.golems.placedByZone[zoneId] <= 0) {
    delete state.fishing.golems.placedByZone[zoneId];
  }

  showFilterNotification(
    "system",
    `🤖 Removed 1 Fishing Golem from ${zone?.name || "this zone"}.`
  );

  renderFishingPanel?.(state.activeFishingTab || "golems");
  saveGame();
}

function getMaxFishingGolems() {
  return ZONES.filter(zone => !zone.isEventZone && !zone.noMonsters).length;
}

function updateFishing(now = Date.now()) {
  initializeFishing();

  attemptFishing(now);
  attemptFishingGolems(now);
}

function getFishingTimeLeftText() {
  initializeFishing();

  if (!state.fishing.rodOwned) {
    return "Inactive";
  }

  const now = Date.now();

  if (state.fishing.nextAttemptAt <= now) {
    return "Ready";
  }

  const msLeft = Math.max(0, state.fishing.nextAttemptAt - now);
  const seconds = Math.ceil(msLeft / 1000);

  return `${seconds}s`;
}

function placeFishingGolemInZone(zoneId) {
  initializeFishing();

  const zone = ZONES.find(z => z.id === zoneId);
  if (!zone || zone.noMonsters || zone.isEventZone) {
    showFilterNotification("system", "Fishing Golems can only be placed in monster zones.");
    return;
  }

  const totalPlaced = getTotalPlacedFishingGolems();

  if (totalPlaced >= state.fishing.golems.owned) {
    showFilterNotification("system", "No unplaced Fishing Golems available.");
    return;
  }

  state.fishing.golems.placedByZone[zoneId] =
    (state.fishing.golems.placedByZone[zoneId] || 0) + 1;

  showFilterNotification(
    "system",
    `🤖 Placed 1 Fishing Golem in ${zone.name}.`
  );

  renderZoneList?.();
  renderFishingPanel?.(state.activeFishingTab || "golems");
  saveGame();
}

function removeFishingGolemFromZone(zoneId) {
  initializeFishing();

  const zone = ZONES.find(z => z.id === zoneId);
  const placedHere = state.fishing.golems.placedByZone?.[zoneId] || 0;

  if (placedHere <= 0) {
    showFilterNotification("system", "No Fishing Golem placed in this zone.");
    return;
  }

  state.fishing.golems.placedByZone[zoneId]--;

  if (state.fishing.golems.placedByZone[zoneId] <= 0) {
    delete state.fishing.golems.placedByZone[zoneId];
  }

  showFilterNotification(
    "system",
    `🤖 Removed 1 Fishing Golem from ${zone?.name || "this zone"}.`
  );

  renderZoneList?.();
  renderFishingPanel?.(state.activeFishingTab || "golems");
  saveGame();
}

function renderFishingPanel(tab = state.activeFishingTab || "rod") {
  initializeFishing();

  state.activeFishingTab = tab;

  const panel = document.getElementById("fishingPanel");
  if (!panel) return;

  const fish = getFish();

  const catchChancePercent = Math.floor(getFishingCatchChance() * 100);
  const cooldownSeconds = Math.floor(getFishingCooldownMs() / 1000);

  const quickCastLevel = state.fishing.upgrades?.quickCast || 0;
  const luckyHookLevel = state.fishing.upgrades?.luckyHook || 0;
  const schoolOverflowLevel = state.fishing.upgrades?.schoolOverflow || 0;
  const doubleHookLevel = state.fishing.upgrades?.doubleHook || 0;
  const tripleHookLevel = state.fishing.upgrades?.tripleHook || 0;

  const goldenFishLevel = state.fishing.shopUpgrades?.goldenFish || 0;
  const powerfulFishLevel = state.fishing.shopUpgrades?.powerfulFish || 0;
  const empoweredCompanionsLevel = state.fishing.shopUpgrades?.empoweredCompanions || 0;
  const biggerPouchesLevel = state.fishing.shopUpgrades?.biggerPouches || 0;
  const shinierGemsLevel = state.fishing.shopUpgrades?.shinierGems || 0;
  const bonusSPLevel = state.fishing.shopUpgrades?.bonusSP || 0;

  const golemsOwned = state.fishing.golems?.owned || 0;
  const golemsPlaced = getTotalPlacedFishingGolems?.() || 0;
  const golemsPlacedHere = getPlacedFishingGolemsInCurrentZone?.() || 0;
  const maxGolems = getMaxFishingGolems?.() || 0;
  const currentFishingZone = currentZone?.();

  const clockworkCastingLevel = state.fishing.golems?.clockworkCasting || 0;
  const mechanicalPrecisionLevel = state.fishing.golems?.mechanicalPrecision || 0;
  const overclockedEfficiencyLevel = state.fishing.golems?.overclockedEfficiency || 0;
  const precisionHookingLevel = state.fishing.golems?.precisionHooking || 0;
  const overtunedHookingLevel = state.fishing.golems?.overtunedHooking || 0;

  const quickCastCost = getScaledUpgradeCost(10, quickCastLevel, 1.035);
  const luckyHookCost = getScaledUpgradeCost(15, luckyHookLevel, 1.035);
  const schoolOverflowCost = getScaledUpgradeCost(20, schoolOverflowLevel, 1.035);
  const doubleHookCost = getScaledUpgradeCost(30, doubleHookLevel, 1.035);
  const tripleHookCost = getScaledUpgradeCost(50, tripleHookLevel, 1.035);

  const goldenFishCost = getScaledUpgradeCost(25, goldenFishLevel, 1.025);
  const powerfulFishCost = getScaledUpgradeCost(25, powerfulFishLevel, 1.025);
  const empoweredCompanionsCost = getScaledUpgradeCost(50, empoweredCompanionsLevel, 1.025);
  const biggerPouchesCost = getScaledUpgradeCost(50, biggerPouchesLevel, 1.025);
  const shinierGemsCost = getScaledUpgradeCost(50, shinierGemsLevel, 1.025);
  const bonusSPCost = getScaledUpgradeCost(100, bonusSPLevel, 1.025);

  const golemCost = getFishingGolemCost();
  const clockworkCastingCost = getScaledUpgradeCost(100, clockworkCastingLevel, 1.04);
  const mechanicalPrecisionCost = getScaledUpgradeCost(125, mechanicalPrecisionLevel, 1.04);
  const overclockedEfficiencyCost = getScaledUpgradeCost(150, overclockedEfficiencyLevel, 1.04);
  const precisionHookingCost = getScaledUpgradeCost(200, precisionHookingLevel, 1.04);
  const overtunedHookingCost = getScaledUpgradeCost(300, overtunedHookingLevel, 1.04);

  const fishMultiplier = getFishingFishMultiplier();
  const doubleHookChance = (doubleHookLevel * 0.5).toFixed(1);
  const tripleHookChance = (tripleHookLevel * 0.5).toFixed(1);

  const golemCooldownSeconds = Math.floor(getFishingGolemCooldownMs() / 1000);
  const golemCatchChancePercent = Math.floor(getFishingGolemCatchChance() * 100);

  const rodContent = `
    <div class="starSection">
      <div class="starSectionTitle">Fishing Rod</div>

      <div class="uiListCard">
        <div class="uiListCardInner">
          <div class="uiListIcon">🎣</div>
          <div class="uiListText">
            <div class="uiListTitle">Basic Fishing Rod</div>
            <div class="uiListSub">Automatically fishes while near water zones.</div>
            <div class="uiListSub">Next attempt: ${getFishingTimeLeftText()}</div>
            <div class="uiListSub">Current cooldown: ${cooldownSeconds}s</div>
            <div class="uiListSub">Catch chance: ${catchChancePercent}%</div>
            <div class="uiListSub">Fish multiplier: x${fishMultiplier.toFixed(2)}</div>
          </div>
        </div>
      </div>

      ${renderFishingUpgradeCard("⚡", "Quick Cast", "Reduces fishing cooldown by 0.5 seconds per level.", `Level ${quickCastLevel}/100`, `Current reduction: ${(quickCastLevel * 0.5).toFixed(1)}s`, fish < quickCastCost || quickCastLevel >= 100, quickCastLevel >= 100 ? "Maxed" : `${fmt(quickCastCost)} Fish`, `buyFishingUpgrade('quickCast', 10, 100)`)}
      ${renderFishingUpgradeCard("🍀", "Lucky Hook", "Increases capture rate by 1% per level.", `Level ${luckyHookLevel}/90`, `Current bonus: +${luckyHookLevel}%`, fish < luckyHookCost || luckyHookLevel >= 90, luckyHookLevel >= 90 ? "Maxed" : `${fmt(luckyHookCost)} Fish`, `buyFishingUpgrade('luckyHook', 15, 90)`)}
      ${renderFishingUpgradeCard("🐟", "School Overflow", "Increases fish catch multiplier by 5% per level.", `Level ${schoolOverflowLevel}/100`, `Current multiplier: x${fishMultiplier.toFixed(2)}`, fish < schoolOverflowCost || schoolOverflowLevel >= 100, schoolOverflowLevel >= 100 ? "Maxed" : `${fmt(schoolOverflowCost)} Fish`, `buyFishingUpgrade('schoolOverflow', 20, 100)`)}
      ${renderFishingUpgradeCard("🎣", "Double Hook", "Successful catches gain a 0.5% chance per level to double fish caught.", `Level ${doubleHookLevel}/100`, `Chance: ${doubleHookChance}%`, fish < doubleHookCost || doubleHookLevel >= 100, doubleHookLevel >= 100 ? "Maxed" : `${fmt(doubleHookCost)} Fish`, `buyFishingUpgrade('doubleHook', 30, 100)`)}
      ${renderFishingUpgradeCard("🪝", "Triple Hook", "Successful Double Hooks gain a 0.5% chance per level to triple the catch.", `Level ${tripleHookLevel}/100`, `Chance: ${tripleHookChance}%`, fish < tripleHookCost || tripleHookLevel >= 100, tripleHookLevel >= 100 ? "Maxed" : `${fmt(tripleHookCost)} Fish`, `buyFishingUpgrade('tripleHook', 50, 100)`)}
    </div>
  `;

  const shopContent = `
    <div class="starSection">
      <div class="starSectionTitle">Fishing Shop</div>

      ${renderFishingUpgradeCard("🪙", "Golden Fish", "Each caught fish gives gold based on your current zone.", `Level ${goldenFishLevel}/1000`, `Current gold per fish: ${fmt(getFishingGoldRewardPerFish())}`, fish < goldenFishCost || goldenFishLevel >= 1000, goldenFishLevel >= 1000 ? "Maxed" : `${fmt(goldenFishCost)} Fish`, `buyFishingShopUpgrade('goldenFish', 25, 1000)`)}
      ${renderFishingUpgradeCard("✨", "Powerful Fish", "Each caught fish gives EXP based on your current zone.", `Level ${powerfulFishLevel}/1000`, `Current EXP per fish: ${fmt(getFishingExpRewardPerFish())}`, fish < powerfulFishCost || powerfulFishLevel >= 1000, powerfulFishLevel >= 1000 ? "Maxed" : `${fmt(powerfulFishCost)} Fish`, `buyFishingShopUpgrade('powerfulFish', 25, 1000)`)}
      ${renderFishingUpgradeCard("🐺", "Empowered Companions", "Increases all summon damage by 1% per level.", `Level ${empoweredCompanionsLevel}/500`, `Current bonus: +${empoweredCompanionsLevel}%`, fish < empoweredCompanionsCost || empoweredCompanionsLevel >= 500, empoweredCompanionsLevel >= 500 ? "Maxed" : `${fmt(empoweredCompanionsCost)} Fish`, `buyFishingShopUpgrade('empoweredCompanions', 50, 500)`)}
      ${renderFishingUpgradeCard("💰", "Bigger Pouches", "Increases gold gained by 1% per level.", `Level ${biggerPouchesLevel}/500`, `Current bonus: +${biggerPouchesLevel}%`, fish < biggerPouchesCost || biggerPouchesLevel >= 500, biggerPouchesLevel >= 500 ? "Maxed" : `${fmt(biggerPouchesCost)} Fish`, `buyFishingShopUpgrade('biggerPouches', 50, 500)`)}
      ${renderFishingUpgradeCard("💎", "Shinier Gems", "Increases EXP gained by 1% per level.", `Level ${shinierGemsLevel}/500`, `Current bonus: +${shinierGemsLevel}%`, fish < shinierGemsCost || shinierGemsLevel >= 500, shinierGemsLevel >= 500 ? "Maxed" : `${fmt(shinierGemsCost)} Fish`, `buyFishingShopUpgrade('shinierGems', 50, 500)`)}
      ${renderFishingUpgradeCard("🧠", "Bonus SP", "Gives +1 Skill Point per level.", `Level ${bonusSPLevel}/100`, `Total gained: +${bonusSPLevel} Skill Points`, fish < bonusSPCost || bonusSPLevel >= 100, bonusSPLevel >= 100 ? "Maxed" : `${fmt(bonusSPCost)} Fish`, `buyFishingShopUpgrade('bonusSP', 100, 100)`)}
    </div>
  `;

  const golemContent = `
    <div class="starSection">
      <div class="starSectionTitle">Fishing Golems</div>

      <div class="uiListCard">
        <div class="uiListCardInner">
          <div class="uiListIcon">🤖</div>

          <div class="uiListText">
            <div class="uiListTitle">Fishing Golems</div>
            <div class="uiListSub">Golems automatically fish alongside your rod.</div>
            <div class="uiListSub">Owned: ${fmt(golemsOwned)} / ${fmt(maxGolems)}</div>
            <div class="uiListSub">Total placed: ${fmt(golemsPlaced)}</div>
            <div class="uiListSub">Current zone: ${currentFishingZone?.name || "Unknown"}</div>
            <div class="uiListSub">Placed here: ${fmt(golemsPlacedHere)}</div>
            <div class="uiListSub">Next attempt: ${getFishingGolemTimeLeftText?.() || "0s"}</div>
            <div class="uiListSub">Cooldown: ${golemCooldownSeconds}s</div>
            <div class="uiListSub">Catch chance: ${golemCatchChancePercent}%</div>
          </div>

          <div class="uiListAction rightAligned">
            <button
              class="rebirthBuyBtn"
              ${(fish < golemCost || golemsOwned >= maxGolems) ? "disabled" : ""}
              onclick="buyFishingGolem()"
            >
              ${golemsOwned >= maxGolems ? "Maxed" : `${fmt(golemCost)} Fish`}
            </button>

            <button
              class="rebirthBuyBtn"
              ${(golemsPlaced >= golemsOwned || currentFishingZone?.noMonsters || currentFishingZone?.isEventZone) ? "disabled" : ""}
              onclick="placeFishingGolem()"
            >
              Place
            </button>

            <button
              class="rebirthBuyBtn"
              ${(golemsPlacedHere <= 0) ? "disabled" : ""}
              onclick="removeFishingGolem()"
            >
              Remove
            </button>
          </div>
        </div>
      </div>

      ${renderFishingUpgradeCard("⚙️", "Clockwork Casting", "Reduces Fishing Golem cooldown by 0.5 seconds per level.", `Level ${clockworkCastingLevel}/100`, `Current reduction: ${(clockworkCastingLevel * 0.5).toFixed(1)}s`, fish < clockworkCastingCost || clockworkCastingLevel >= 100, clockworkCastingLevel >= 100 ? "Maxed" : `${fmt(clockworkCastingCost)} Fish`, `buyFishingGolemUpgrade('clockworkCasting', 100, 100)`)}
      ${renderFishingUpgradeCard("🎯", "Mechanical Precision", "Increases Fishing Golem catch chance by 1% per level.", `Level ${mechanicalPrecisionLevel}/90`, `Current bonus: +${mechanicalPrecisionLevel}%`, fish < mechanicalPrecisionCost || mechanicalPrecisionLevel >= 90, mechanicalPrecisionLevel >= 90 ? "Maxed" : `${fmt(mechanicalPrecisionCost)} Fish`, `buyFishingGolemUpgrade('mechanicalPrecision', 125, 90)`)}
      ${renderFishingUpgradeCard("🔥", "Overclocked Efficiency", "Increases global fish multiplier by 2% per level.", `Level ${overclockedEfficiencyLevel}/100`, `Total fish multiplier: x${fishMultiplier.toFixed(2)}`, fish < overclockedEfficiencyCost || overclockedEfficiencyLevel >= 100, overclockedEfficiencyLevel >= 100 ? "Maxed" : `${fmt(overclockedEfficiencyCost)} Fish`, `buyFishingGolemUpgrade('overclockedEfficiency', 150, 100)`)}
      ${renderFishingUpgradeCard("🎣", "Precision Hooking", "Fishing Golems gain a 0.5% chance per level to double catches.", `Level ${precisionHookingLevel}/100`, `Chance: ${(precisionHookingLevel * 0.5).toFixed(1)}%`, fish < precisionHookingCost || precisionHookingLevel >= 100, precisionHookingLevel >= 100 ? "Maxed" : `${fmt(precisionHookingCost)} Fish`, `buyFishingGolemUpgrade('precisionHooking', 200, 100)`)}
      ${renderFishingUpgradeCard("🪝", "Overtuned Hooking", "Successful Precision Hooks gain a 0.5% chance per level to triple catches.", `Level ${overtunedHookingLevel}/100`, `Chance: ${(overtunedHookingLevel * 0.5).toFixed(1)}%`, fish < overtunedHookingCost || overtunedHookingLevel >= 100, overtunedHookingLevel >= 100 ? "Maxed" : `${fmt(overtunedHookingCost)} Fish`, `buyFishingGolemUpgrade('overtunedHooking', 300, 100)`)}
    </div>
  `;

  panel.innerHTML = `
    <div class="rebirthHero ready">
      <div class="rebirthHeroTop">
        <div>
          <div class="rebirthTitle">🎣 Fishing</div>
          <div class="rebirthSub">Your fishing rod and golems automatically attempt to catch fish near water.</div>
        </div>

        <div class="rebirthCoinBox">
          <div class="rebirthCoinAmount">${fmt(fish)}</div>
          <div class="rebirthCoinLabel">Fish</div>
        </div>
      </div>
    </div>

    <div class="starTabs">
      <button class="starTab ${tab === "rod" ? "active" : ""}" onclick="renderFishingPanel('rod')">Rod Upgrades</button>
      <button class="starTab ${tab === "shop" ? "active" : ""}" onclick="renderFishingPanel('shop')">Fishing Shop</button>
      <button class="starTab ${tab === "golems" ? "active" : ""}" onclick="renderFishingPanel('golems')">Golems</button>
    </div>

    ${
      tab === "rod"
        ? rodContent
        : tab === "shop"
          ? shopContent
          : golemContent
    }
  `;
}

function renderFishingUpgradeCard(icon, title, desc, levelText, bonusText, disabled, buttonText, onclick) {
  return `
    <div class="uiListCard">
      <div class="uiListCardInner">
        <div class="uiListIcon">${icon}</div>

        <div class="uiListText">
          <div class="uiListTitle">${title}</div>
          <div class="uiListSub">${desc}</div>
          <div class="uiListSub">${levelText}</div>
          <div class="uiListSub">${bonusText}</div>
        </div>

        <div class="uiListAction rightAligned">
          <button
            class="rebirthBuyBtn"
            ${disabled ? "disabled" : ""}
            onclick="${onclick}"
          >
            ${buttonText}
          </button>
        </div>
      </div>
    </div>
  `;
}

function getScaledUpgradeCost(baseCost, currentLevel, growth) {
  return Math.floor(baseCost * Math.pow(growth, currentLevel));
}

function buyFishingUpgrade(key, baseCost, maxLevel) {
  initializeFishing();

  const current = state.fishing.upgrades[key] || 0;
  const cost = getScaledUpgradeCost(baseCost, current, 1.035);

  if (current >= maxLevel) return;

  if (state.fishing.fish < cost) {
    showFilterNotification(
      "system",
      `Need ${fmt(cost)} fish.`
    );
    return;
  }

  state.fishing.fish -= cost;
  state.fishing.upgrades[key]++;

  showFilterNotification(
    "system",
    `🎣 Upgraded ${key} for ${fmt(cost)} fish.`
  );

  renderFishingPanel?.(state.activeFishingTab || "rod");
  updateUI();
  saveGame();
}