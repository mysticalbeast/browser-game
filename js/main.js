window.addEventListener("beforeunload", () => {
  state.lastSeenAt = Date.now();
  saveGame();
});

function isMinotaurEffectDebugEnabled() {
  return state.settings?.minotaurEffectDebug === true;
}

function notifyMinotaurEffect(effectName, text) {
  if (!isMinotaurEffectDebugEnabled()) return;

  const message = `🏹 ${effectName}: ${text}`;

  addLog(message);

  if (typeof showFilterNotification === "function") {
    showFilterNotification(message, effectName);
  }
}

function hasSkill(key) {
  return (state.skills?.[key] || 0) > 0;
}

const minotaurCombatState = {
  targetHits: {},
  hitTargets: {}
};

function getMonsterHpPercent(monster) {
  if (!monster || !monster.maxHp) return 100;
  return (monster.hp / monster.maxHp) * 100;
}

function hasMinotaurHitTarget(monsterId) {
  return !!minotaurCombatState.hitTargets[monsterId];
}

function markMinotaurHitTarget(monsterId) {
  minotaurCombatState.hitTargets[monsterId] = true;
}

function getBattleRhythmMultiplier(monsterId) {
  if (!hasSkill("battleRhythm")) return 1;

  const hits = minotaurCombatState.targetHits[monsterId] || 0;
  const stacks = Math.min(10, hits);

  return 1 + stacks * 0.05;
}

function recordBattleRhythmHit(monsterId) {
  if (!hasSkill("battleRhythm")) return;

  minotaurCombatState.targetHits[monsterId] =
    (minotaurCombatState.targetHits[monsterId] || 0) + 1;
}

const SUMMON_GROUND_OFFSET = 32;

const SUMMON_CONFIG = {
  sprite: "assets/summons/Minotaur.gif",
  width: 200,
  height: 200,
  name: "Minotaur Archer"
};

const NECRO_CONFIG = {
  sprite: "assets/summons/Necromancer.gif",
  width: 200,
  height: 200,
  name: "Necromancer"
};

function initBackpack() {
  for (let i = 0; i < 24; i++) {
    const slot = document.createElement("div");
    slot.className = "slot";
    backpack.appendChild(slot);
  }
}

function initSummonVisual() {
  if (document.getElementById("summonVisual")) return;

  const style = document.createElement("style");
  style.textContent = `
    #summonVisual {
      position: absolute;
      right: 20px;
      bottom: ${SUMMON_GROUND_OFFSET}px;
      width: ${SUMMON_CONFIG.width}px;
      height: ${SUMMON_CONFIG.height}px;
      z-index: 35;
      pointer-events: none;
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
      animation: summonIdle 1.8s ease-in-out infinite;
    }

    #necromancerVisual {
      position: absolute;
      right: ${SUMMON_CONFIG.width + 0}px;
      bottom: ${SUMMON_GROUND_OFFSET}px;
      width: ${SUMMON_CONFIG.width}px;
      height: ${SUMMON_CONFIG.height}px;
      z-index: 35;
      pointer-events: none;
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
      animation: summonIdle 1.8s ease-in-out infinite;
    }

    #summonVisual img,
    #necromancerVisual img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      object-position: bottom right;
      image-rendering: pixelated;
      filter: drop-shadow(0 6px 6px rgba(0,0,0,.6));
    }

    .summonNameplate {
      position: absolute;
      top: 100%;
      left: 100%;
      transform: translateX(-100%);
      margin-top: 6px;
      font-size: 11px;
      color: #ffcf4a;
      background: rgba(0,0,0,.75);
      padding: 3px 6px;
      border-radius: 4px;
      border: 1px solid #8b650f;
      white-space: nowrap;
    }

    .arrowProjectile {
      position: absolute;
      width: 18px;
      height: 4px;
      background: #d8d1ad;
      border-radius: 2px;
      z-index: 36;
      pointer-events: none;
      transform-origin: center center;
      filter: drop-shadow(0 0 3px rgba(255,220,120,.7));
    }

    .arrowProjectile::after {
      content: "";
      position: absolute;
      right: -6px;
      top: -4px;
      border-left: 8px solid #d8d1ad;
      border-top: 5px solid transparent;
      border-bottom: 5px solid transparent;
    }

    @keyframes summonIdle {
      0%,100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }

  `;
  document.head.appendChild(style);

  const summon = document.createElement("div");
  summon.id = "summonVisual";

  summon.innerHTML = `
    <img src="${SUMMON_CONFIG.sprite}" onerror="this.style.display='none'">
    <div class="summonNameplate">${SUMMON_CONFIG.name}</div>
  `;

  arena.appendChild(summon);

  // Remove old necromancer if exists
  document.getElementById("necromancerVisual")?.remove();

  // Add necromancer if unlocked
  if (state.rebirthUpgrades?.necromancer > 0) {
    const necro = document.createElement("div");
    necro.id = "necromancerVisual";

    necro.innerHTML = `
      <img src="${NECRO_CONFIG.sprite}" onerror="this.style.display='none'">
      <div class="summonNameplate">${NECRO_CONFIG.name}</div>
    `;

    arena.appendChild(necro);
  }
}

function renderNecromancerVisual() {
  document.getElementById("necromancerVisual")?.remove();

  if (!(state.rebirthUpgrades?.necromancer > 0)) return;

  const necro = document.createElement("div");
  necro.id = "necromancerVisual";
  necro.className = "summonUnit";

  necro.innerHTML = `
    <img src="${NECRO_CONFIG.sprite}" onerror="this.style.display='none'">
    <div class="summonNameplate">${NECRO_CONFIG.name}</div>
  `;

  arena.appendChild(necro);
}

function spawnArrowProjectile(target, onHit, options = {}) {
  const summon = document.getElementById("summonVisual");
  if (!summon || !target) return;

  summon.classList.remove("attack");
  void summon.offsetWidth;
  summon.classList.add("attack");

  const arenaRect = arena.getBoundingClientRect();
  const summonRect = summon.getBoundingClientRect();

  const startX = options.startX ?? (summonRect.left - arenaRect.left + summonRect.width * 0.8);
  const startY = options.startY ?? (summonRect.top - arenaRect.top + summonRect.height * 0.6);

  const endX = target.x;
  const endY = target.y;

  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  const arrow = document.createElement("div");
  arrow.className = options.className || "arrowProjectile";
  arrow.style.left = `${startX}px`;
  arrow.style.top = `${startY}px`;
  arrow.style.transform = `rotate(${angle}rad)`;

  arena.appendChild(arrow);

  const speed = options.speed || 17000;
  const duration = Math.max(20, (distance / speed) * 1000);

  const startTime = performance.now();

  function animate(now) {
    const progress = Math.min(1, (now - startTime) / duration);

    const x = startX + dx * progress;
    const y = startY + dy * progress;

    arrow.style.left = `${x}px`;
    arrow.style.top = `${y}px`;

    if (progress >= 1) {
      arrow.remove();

      if (typeof onHit === "function") {
        onHit({
          target,
          endX,
          endY,
          startX,
          startY
        });
      }

      return;
    }

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}

function spawnNecromancerProjectile(target, onHit) {
  const arena = document.getElementById("arena");
  const necro = document.getElementById("necromancerVisual");

  if (!arena || !necro || !target) {
    onHit();
    return;
  }

  const arenaRect = arena.getBoundingClientRect();
  const necroRect = necro.getBoundingClientRect();

  const startX = necroRect.left - arenaRect.left + necroRect.width / 2;
  const startY = necroRect.top - arenaRect.top + necroRect.height / 2;

  const endX = target.x;
  const endY = target.y;

  const projectile = document.createElement("div");
  projectile.className = "necromancerProjectile";
  
  // random size variation
const scale = 0.8 + Math.random() * 0.6;
projectile.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${Math.random() * 360}deg)`;

// slight color variation
const hue = 110 + Math.random() * 40;
projectile.style.filter = `hue-rotate(${hue}deg) blur(1px)`;

  projectile.style.left = `${startX}px`;
  projectile.style.top = `${startY}px`;

  arena.appendChild(projectile);

  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const speed = 5000;
  const duration = Math.max(180, (distance / speed) * 1000);

  projectile.animate(
    [
      {
        transform: "translate(-50%, -50%) scale(0.8)",
        opacity: 1
      },
      {
        transform: `translate(${dx}px, ${dy}px) translate(-50%, -50%) scale(1.25)`,
        opacity: 0.95
      }
    ],
    {
      duration,
      easing: "ease-out",
      fill: "forwards"
    }
  );

  setTimeout(() => {
    projectile.remove();
    spawnNecromancerImpact(endX, endY);
    onHit();
  }, duration);
}

function spawnNecromancerImpact(x, y) {
  const arena = document.getElementById("arena");
  if (!arena) return;

  const impact = document.createElement("div");
  impact.className = "necromancerImpact";

  impact.style.left = `${x}px`;
  impact.style.top = `${y}px`;

  // ADD IT HERE
  impact.style.transform = `translate(-50%, -50%) rotate(${Math.random() * 360}deg)`;

  arena.appendChild(impact);

  setTimeout(() => {
    impact.remove();
  }, 450);
}

// ===== GLOBAL FUNCTIONS =====

let skeletonRenderLoopRunning = false;

function startSkeletonRenderLoop() {
  if (skeletonRenderLoopRunning) return;

  skeletonRenderLoopRunning = true;

  function loop() {
    renderSkeletons();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

function gameLoop() {
	
  if (window.gamePausedForAuth) return;
  
  const zone = currentZone();

  if (!zone.noMonsters && state.monsters.length < getMaxMonsters()) {
    createMonster();
  }

  const now = Date.now();

  cleanupSkeletons(now);
  moveSkeletons(now);
  handleSkeletonAttacks(now);
  handleNecromancerAttack(now);

  updateFishing?.(now);

  updateStarSystem(now);
  updateObservatoryEvent(now);
  updateResearchBreakthroughEvent(now);
  updateSiegeEvent(now);
  updateSiegeNotification();
  updateStarZoneVisual();

  if (
    state.settings?.minotaurAttacks !== false &&
    state.monsters.length > 0 &&
    now - lastSummonAttack >= summonInterval()
  ) {
    lastSummonAttack = now;

    const targets = getSummonTargets();

    targets.forEach((target, arrowIndex) => {
      const roll = rollSummonDamage(arrowIndex);

      spawnArrowProjectile(target, () => {
        const monster = state.monsters.find(m => m.id === target.id);
        if (!monster) return;

        let finalDamage = roll.damage;
        const isCritical = roll.critical;

        // Opening Strike: first Minotaur hit on a monster deals 50% bonus damage.
        if (hasSkill("openingStrike") && !hasMinotaurHitTarget(monster.id)) {
          finalDamage *= 1.5;
          notifyMinotaurEffect("Opening Strike", `First hit bonus applied to ${monster.name || "monster"}.`);
        }

        // Executioner Shot: +40% damage against monsters below 30% HP.
        if (hasSkill("executionerShot") && getMonsterHpPercent(monster) <= 30) {
          finalDamage *= 1.4;
          notifyMinotaurEffect("Executioner Shot", `Low-health bonus applied to ${monster.name || "monster"}.`);
        }

        // Battle Rhythm: +5% damage per consecutive hit on same target, max +50%.
        if (hasSkill("battleRhythm")) {
          const rhythmMultiplier = getBattleRhythmMultiplier(monster.id);

          finalDamage *= rhythmMultiplier;

          if (rhythmMultiplier > 1) {
            notifyMinotaurEffect(
              "Battle Rhythm",
              `Damage multiplier x${rhythmMultiplier.toFixed(2)} on ${monster.name || "monster"}.`
            );
          }
        }

        finalDamage *= getTotalSummonDamageMultiplier();
	    finalDamage = Math.floor(finalDamage);

        hitMonster(
          monster.id,
          finalDamage,
          arrowIndex === 0 ? "summon" : "summonMulti",
          isCritical ? "crit" : "normal"
        );

        markMinotaurHitTarget(monster.id);
        recordBattleRhythmHit(monster.id);

        if (isCritical) {
          addLog(`💀 Minotaur Archer crit for ${fmt(finalDamage)}!`);
        }
      });
    });
  }

  castFireball(now);
  castLightMagic(now);
  castHeavyMagic(now);

  autoBuyWeapons();
  autoTravelZones();
  autoAllocateSkills();
}

function bindEvents() {
  document.addEventListener("mousedown", event => {
    const depotLoadoutWrapper = document.getElementById("depotLoadoutWrapper");
    const depotWrapperOpen = depotLoadoutWrapper?.classList.contains("open");

    const openPanel = document.querySelector(".panel[style*='display: block']");
    const clickedMenuButton = event.target.closest(".menuBtn");

    if (clickedMenuButton) return;

    if (depotWrapperOpen) {
      const clickedInsideDepotWrapper = depotLoadoutWrapper.contains(event.target);

      if (clickedInsideDepotWrapper) return;

      depotLoadoutWrapper.classList.remove("open");

      const depotPanel = document.getElementById("depotPanel");
      if (depotPanel) depotPanel.style.display = "none";

      updateMenuIndicators();
      return;
    }

    if (!openPanel) return;

    const clickedInsidePanel = openPanel.contains(event.target);

    if (clickedInsidePanel) return;

    openPanel.style.display = "none";
    updateMenuIndicators();
  });

  document.querySelectorAll("[data-log-filter]").forEach(button => {
    button.onclick = () => {
      setLogFilter(button.dataset.logFilter);
    };
  });

  document.getElementById("depotBtn").onclick = () => {
  togglePanel("depotPanel");

  requestAnimationFrame(() => {
    renderDepotTabs?.();
    renderDepotPanel?.();
    renderLoadoutsPanel?.();
  });
};

  document.querySelectorAll(".depotTab").forEach(button => {
    button.onclick = () => {
      setDepotTab(Number(button.dataset.depotTab));
    };
  });

  document.getElementById("weaponsBtn").onclick = () => togglePanel("weaponsPanel");
  document.getElementById("travelBtn").onclick = () => togglePanel("travelPanel");
  document.getElementById("skillsBtn").onclick = () => togglePanel("upgradePanel");
  document.getElementById("craftingBtn").onclick = () => togglePanel("craftingPanel");
  document.getElementById("rewardsBtn").onclick = () => togglePanel("rewardsPanel");
  document.getElementById("testingBtn").onclick = () => togglePanel("testingPanel");
  document.getElementById("statsBtn").onclick = () => togglePanel("statsPanel");
  document.getElementById("scoreBtn").onclick = () => togglePanel("scorePanel");

  document.getElementById("fishingBtn").onclick = () => {
    togglePanel("fishingPanel");
    renderFishingPanel?.(state.activeFishingTab || "rod");
  };

  document.getElementById("skinsBtn")?.addEventListener("click", () => {
    togglePanel("skinsPanel");
    renderSkinsPanel?.("select");
  });

  document.getElementById("rebirthBtn").onclick = () => {
    togglePanel("rebirthPanel");
    renderRebirthMenu();
  };

  document.getElementById("rebirthShopBtn").onclick = () => togglePanel("rebirthShopPanel");
  document.getElementById("starforgeBtn").onclick = () => togglePanel("starforgePanel");
  document.getElementById("settingsBtn").onclick = () => togglePanel("settingsPanel");

  document.getElementById("researchBtn")?.addEventListener("click", () => {
    togglePanel("researchPanel");
    renderResearchPanel();
  });

  document.getElementById("blacksmithBtn")?.addEventListener("click", () => {
    togglePanel("blacksmithPanel");
    renderBlacksmithPanel();
  });

  document.querySelectorAll(".treeTab").forEach(button => {
    button.onclick = () => {
      document.querySelectorAll(".treeTab").forEach(tab => tab.classList.remove("active"));
      button.classList.add("active");
      state.activeSkillTree = button.dataset.tree;
      renderSkillTree();
    };
  });

  document.getElementById("logoutBtn").onclick = () => {
  saveGame();

if (pendingCloudSave) {
  uploadCloudSave(pendingCloudSave);
  pendingCloudSave = null;
}

  localStorage.removeItem("loggedInUser");
  
  localStorage.removeItem("authToken");

  window.gamePausedForAuth = !isLocalDevGame?.();

  document.getElementById("authScreen").style.display = "flex";

  const messageEl = document.getElementById("authMessage");
  if (messageEl) {
    messageEl.textContent = "Logged out.";
  }
};

  bindTestingButtons();

  window.addEventListener("resize", () => {
    state.monsters.forEach(monster => {
      const rect = arena.getBoundingClientRect();
      monster.x = Math.min(monster.x, rect.width - 60);
      monster.y = Math.min(monster.y, rect.height - 260);
      renderMonster(monster);
    });
  });
}

function initGame() {
  arena = document.getElementById("arena");
  logEl = document.getElementById("log");
  backpack = document.getElementById("backpack");

  loadGame();

  initializeInventory?.();
  initializeFishing?.();
  initializeSkins?.();

  initMonsterNameCache();

  //calculateOfflineGains();
  //renderOfflinePopup();

  initBackpack();

  renderBackpack?.();

  bindEvents();

  //setupOfflineGainTracking();

  initSummonVisual();

  updateUI();

  startSkeletonRenderLoop();
  startSiegeRenderLoop?.();

  setLogFilter(state.activeLogFilter || "all");

  gameLoop();

  setInterval(() => {
    if (window.gamePausedForAuth) return;

    gameLoop();
  }, 150);

  setInterval(() => {
    if (window.gamePausedForAuth) return;

    updateRewardCoins();

    renderLeftSpellBox();
    renderSpellInfo();

    updateObservatoryNotification();
    updateResearchBreakthroughNotification();

    updateSiegeNotification?.();
    cleanupSiegeIfInactiveOrWrongZone?.();

    if (document.getElementById("travelPanel")?.style.display === "block") {
      renderZoneList();
    }

    if (document.getElementById("fishingPanel")?.style.display === "block") {
      renderFishingPanel?.(state.activeFishingTab || "rod");
    }

    updateMenuIndicators();
  }, 1000);

  setInterval(() => {
    if (window.gamePausedForAuth) return;

    saveGame();
  }, 15000);

  setInterval(() => {
    if (window.gamePausedForAuth) return;

    const scorePanel = document.getElementById("scorePanel");

    if (scorePanel?.style.display === "block") {
      renderScorePanel?.();
    }
  }, 5000);

  // =========================
  // ONLINE HEARTBEAT
  // =========================

  setInterval(() => {
    if (window.gamePausedForAuth) return;

    sendOnlineHeartbeat?.();
  }, 10000);

  // =========================
  // ONLINE PLAYER LIST
  // =========================

  setInterval(() => {
    updateOnlinePlayersUI?.();
  }, 5000);

  // =========================
  // ZONE PLAYER RENDERING
  // =========================

  setInterval(() => {
    if (window.gamePausedForAuth) return;

    renderZonePlayers?.();
  }, 5000);

  // =========================
  // GLOBAL EVENT SYNC
  // =========================

  setInterval(() => {
    if (window.gamePausedForAuth) return;

    syncGlobalEvents?.();
  }, 250);

  sendOnlineHeartbeat?.();

  updateOnlinePlayersUI?.();

  renderZonePlayers?.();

  syncGlobalEvents?.();
}

initGame();