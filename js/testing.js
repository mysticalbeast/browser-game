function spawnForcedBoss(isUber = false) {
  const zone = currentZone();

  if (zone.noMonsters || !zone.monsters || zone.monsters.length === 0) {
    showFilterNotification("system", "🧪 Testing: No monsters allowed in this zone.");
    return;
  }

  const template = pickMonsterFromZone(zone);
  if (!template) {
    showFilterNotification("system", "🧪 Testing: No valid monster template.");
    return;
  }

  const rect = arena.getBoundingClientRect();
  const baseHp = monsterMaxHp(template);
  const hpMultiplier = isUber ? 15 : 5;

  const monster = {
    id: crypto.randomUUID(),
    name: template.name,
    sprite: template.sprite,
    x: rand(120, rect.width - 120),
    y: rand(120, rect.height - 260),
    isBoss: true,
    isUber,
    maxHp: baseHp * hpMultiplier,
    hp: baseHp * hpMultiplier
  };

  state.monsters.push(monster);
  renderMonster(monster);

  showFilterNotification(
    "system",
    isUber ? "🧪 Testing: spawned Uber Boss." : "🧪 Testing: spawned Boss."
  );
}

function bindTestingButtons() {
  document.getElementById("addGoldBtn").onclick = () => {
    state.gold += 1000;
    showFilterNotification("system", "🧪 Testing: +1,000 gold.");
    updateUI();
    saveGame();
  };

  document.getElementById("removeGoldBtn").onclick = () => {
    state.gold = Math.max(0, state.gold - 1000);
    showFilterNotification("system", "🧪 Testing: -1,000 gold.");
    updateUI();
    saveGame();
  };

  document.getElementById("addLevelBtn").onclick = () => {
    state.level++;
    state.skillPoints++;
    state.exp = 0;

    showFilterNotification(
      "system",
      `🧪 Testing: level increased to ${state.level}. (+1 skill point)`
    );

    updateUI();
    saveGame();
  };

  document.getElementById("removeLevelBtn").onclick = () => {
    state.level = Math.max(1, state.level - 1);

    if (state.level < currentZone().levelReq) {
      state.zoneId = 1;
      clearMonsters();
    }

    showFilterNotification("system", `🧪 Testing: level decreased to ${state.level}.`);
    updateUI();
    saveGame();
  };

  const addStarsBtn = document.createElement("button");
  addStarsBtn.className = "upgradeBtn";
  addStarsBtn.textContent = "+10,000 Stars";

  addStarsBtn.onclick = () => {
    state.stars = (state.stars || 0) + 10000;

    showFilterNotification("system", "🧪 Testing: +10,000 Stars.");
    updateUI();

    if (document.getElementById("starforgePanel")?.style.display === "block") {
      renderStarforgePanel(state.activeStarforgeTab || "stars");
    }

    saveGame();
  };

  const moveStarZoneBtn = document.createElement("button");
  moveStarZoneBtn.className = "upgradeBtn";
  moveStarZoneBtn.textContent = "Move Active Star Zone → Current Zone";

  moveStarZoneBtn.onclick = () => {
    const zone = currentZone();

    if (!zone) {
      showFilterNotification("system", "🧪 Testing: No current zone.");
      return;
    }

    if (!state.starSystem) state.starSystem = {};

    state.starSystem.activeZoneId = zone.id;
    state.starSystem.nextZoneSwapAt = Date.now() + STAR_ZONE_DURATION_MS;
    state.starSystem.nextSpawnCheckAt = Date.now() + STAR_SPAWN_CHECK_MS;

    showFilterNotification("system", `🧪 Testing: Star zone moved to ${zone.name}.`);

    updateUI();
    updateStarZoneVisual();

    if (document.getElementById("travelPanel")?.style.display === "block") {
      renderZoneList();
    }

    if (document.getElementById("starforgePanel")?.style.display === "block") {
      renderStarforgePanel(state.activeStarforgeTab || "stars");
    }

    saveGame();
  };

  const openObservatoryBtn = document.createElement("button");
  openObservatoryBtn.className = "upgradeBtn";
  openObservatoryBtn.textContent = "Open Observatory";

  openObservatoryBtn.onclick = () => {
    openObservatory(Date.now());
    updateUI();

    if (document.getElementById("travelPanel")?.style.display === "block") {
      renderZoneList();
    }

    saveGame();
  };

  const startBreakthroughBtn = document.createElement("button");
  startBreakthroughBtn.className = "upgradeBtn";
  startBreakthroughBtn.textContent = "Start Research Breakthrough";

  startBreakthroughBtn.onclick = () => {
    openResearchBreakthrough(Date.now());
    updateUI();
    saveGame();
  };

  const startSiegeBtn = document.createElement("button");
  startSiegeBtn.className = "upgradeBtn";
  startSiegeBtn.textContent = "Start Siege Event";

  startSiegeBtn.onclick = () => {
    openSiegeEvent(Date.now());
    updateUI();

    if (document.getElementById("travelPanel")?.style.display === "block") {
      renderZoneList();
    }

    saveGame();
  };

  const addEssenceBtn = document.createElement("button");
  addEssenceBtn.className = "upgradeBtn";
  addEssenceBtn.textContent = "+100 All Essences";

  addEssenceBtn.onclick = () => {
    state.materials.greenEssence += 100;
    state.materials.blueEssence += 100;
    state.materials.yellowEssence += 100;
    state.materials.redEssence += 100;

    showFilterNotification("system", "🧪 Testing: +100 all essences.");
    updateUI();
    saveGame();
  };

  const addSilverTokenBtn = document.createElement("button");
  addSilverTokenBtn.className = "upgradeBtn";
  addSilverTokenBtn.textContent = "+10 Silver Tokens";

  addSilverTokenBtn.onclick = () => {
    state.rewards.slotCoins += 10;

    showFilterNotification("system", "🧪 Testing: +10 Silver Tokens.");
    updateUI();
    saveGame();
  };

  const spawnBossBtn = document.createElement("button");
  spawnBossBtn.className = "upgradeBtn";
  spawnBossBtn.textContent = "Spawn Boss";

  spawnBossBtn.onclick = () => {
    spawnForcedBoss(false);
    updateUI();
    saveGame();
  };

const addSkinShardsBtn = document.createElement("button");
addSkinShardsBtn.className = "upgradeBtn";
addSkinShardsBtn.textContent = "+25 Skin Shards";

addSkinShardsBtn.onclick = () => {
  addSkinShards?.(25);
};

  const spawnUberBossBtn = document.createElement("button");
  spawnUberBossBtn.className = "upgradeBtn";
  spawnUberBossBtn.textContent = "Spawn Uber Boss";

  spawnUberBossBtn.onclick = () => {
    spawnForcedBoss(true);
    updateUI();
    saveGame();
  };

  const addRebirthCoinsBtn = document.createElement("button");
  addRebirthCoinsBtn.className = "upgradeBtn";
  addRebirthCoinsBtn.textContent = "+10 Rebirth Coins";

  addRebirthCoinsBtn.onclick = () => {
    if (!state.rebirth) {
      state.rebirth = {
        count: 0,
        coins: 0
      };
    }

    state.rebirth.coins += 10;

    showFilterNotification("system", "🧪 Testing: +10 Rebirth Coins.");
    updateUI();
    saveGame();
  };

  const resetBtn = document.getElementById("resetSaveBtn");

  resetBtn.parentNode.insertBefore(addStarsBtn, resetBtn);
  resetBtn.parentNode.insertBefore(moveStarZoneBtn, resetBtn);
  resetBtn.parentNode.insertBefore(openObservatoryBtn, resetBtn);
  resetBtn.parentNode.insertBefore(startBreakthroughBtn, resetBtn);
  resetBtn.parentNode.insertBefore(startSiegeBtn, resetBtn);
  resetBtn.parentNode.insertBefore(addEssenceBtn, resetBtn);
  resetBtn.parentNode.insertBefore(addSilverTokenBtn, resetBtn);
  resetBtn.parentNode.insertBefore(spawnBossBtn, resetBtn);
  resetBtn.parentNode.insertBefore(spawnUberBossBtn, resetBtn);
  resetBtn.parentNode.insertBefore(addRebirthCoinsBtn, resetBtn);

  if (resetBtn) {
    resetBtn.onclick = () => {
      const confirmed = confirm("Reset all save data? This cannot be undone.");
      if (!confirmed) return;

      window.isResettingSave = true;

      localStorage.setItem("forceResetSave", "1");

      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem("localTapMonsterGameSave_modular_v1");
      localStorage.removeItem("browserGameSave");
      localStorage.removeItem("idleGameSave");

      location.reload();
    };
  }
}