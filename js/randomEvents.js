const SIEGE_GOLD_EXP_BASE_MULTIPLIER = 12;

function getSafeReturnZoneId() {
  const returnZoneId = state.eventReturnZoneId;

  const validZone = ZONES.find(zone =>
    zone.id === returnZoneId &&
    !zone.isEventZone &&
    state.level >= zone.levelReq
  );

  return validZone ? validZone.id : 1;
}

function getHighestUnlockedRewardZone() {
  return [...ZONES]
    .filter(zone =>
      !zone.isEventZone &&
      !zone.noMonsters &&
      state.level >= zone.levelReq &&
      zone.gold &&
      zone.exp
    )
    .sort((a, b) => b.levelReq - a.levelReq)[0] || ZONES[0];
}

function rememberEventReturnZone() {
  const currentId = getCurrentZoneId();

  const current = ZONES.find(zone => zone.id === currentId);

  if (current && !current.isEventZone) {
    state.eventReturnZoneId = currentId;
  }
}

function returnFromEventZone() {
  const returnZoneId = getSafeReturnZoneId();

  if (getCurrentZoneId() !== returnZoneId) {
    travelToZone(returnZoneId);
  }

  state.eventReturnZoneId = null;
}

// =====================
// SIEGE EVENT CONFIG
// =====================

var SIEGE_ZONE_ID = 9998;

const SIEGE_EVENT_DURATION_MS = 15 * 60 * 1000;
const SIEGE_EVENT_CHECK_MS = 60 * 1000;
const SIEGE_EVENT_OPEN_CHANCE = 0.02;

const SIEGE_SPAWN_INTERVAL_MS = 2500;

// =====================
// SHARED EVENT NOTIFICATION ROW
// =====================

function getEventNotificationRow() {
  let row = document.getElementById("eventNotificationRow");

  if (!row) {
    row = document.createElement("div");
    row.id = "eventNotificationRow";
    document.getElementById("arena")?.appendChild(row);
  }

  return row;
}

// =====================
// SIEGE CORE STATE
// =====================

async function joinGlobalSiege() {
  const user = JSON.parse(localStorage.getItem("loggedInUser") || "null");

  if (!user?.id) return;

  try {
    await fetch(`${API_URL}/events/siege/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId: user.id
      })
    });

    syncGlobalEvents?.();
  } catch (error) {
    console.warn("Failed to join siege:", error);
  }
}

function initializeSiegeEvent(now = Date.now()) {
  if (!state.siegeEvent) {
    state.siegeEvent = {
      active: false,
      endsAt: 0,
      nextCheckAt: now + SIEGE_EVENT_CHECK_MS,
      nextSpawnAt: 0,
      wallHp: 0,
      wallMaxHp: 0,
      kills: 0,
      monsters: []
    };
  }

  if (!Array.isArray(state.siegeEvent.monsters)) {
    state.siegeEvent.monsters = [];
  }
}

function isSiegeEventActive() {
  return state.siegeEvent?.active === true &&
    Date.now() < (state.siegeEvent?.endsAt || 0);
}

function isInSiegeZone() {
  return getCurrentZoneId() === SIEGE_ZONE_ID;
}

function getSiegeTimeLeftText() {
  if (!isSiegeEventActive()) return "Closed";

  const msLeft = Math.max(0, state.siegeEvent.endsAt - Date.now());
  const minutes = Math.floor(msLeft / 60000);
  const seconds = Math.floor((msLeft % 60000) / 1000);

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getSiegeWallMaxHp() {
  return 50 + (state.level || 1) * 2 + (state.rebirth?.count || 0) * 25;
}

// =====================
// SIEGE OPEN / CLOSE / FINISH
// =====================

function openSiegeEvent(now = Date.now()) {
  initializeSiegeEvent(now);

  rememberEventReturnZone();

  state.siegeEvent.active = true;
  state.siegeEvent.endsAt = now + SIEGE_EVENT_DURATION_MS;
  state.siegeEvent.nextCheckAt = state.siegeEvent.endsAt + SIEGE_EVENT_CHECK_MS;
  state.siegeEvent.nextSpawnAt = now + 1000;
  state.siegeEvent.wallMaxHp = getSiegeWallMaxHp();
  state.siegeEvent.wallHp = state.siegeEvent.wallMaxHp;
  state.siegeEvent.kills = 0;
  state.siegeEvent.monsters = [];
  state.siegeEvent.joined = false;
  
  state.siegeEvent.rewards = {
  gold: 0,
  exp: 0,
  stars: 0,
  whetstones: 0,
  silverTokens: 0,
  greenEssence: 0,
  blueEssence: 0,
  yellowEssence: 0,
  redEssence: 0,
  salvageMaterials: 0
};

  showFilterNotification(
    "system",
    "🏰 Siege Battlefield opened! Defend the wall for 15 minutes."
  );

  updateSiegeNotification();

  if (document.getElementById("travelPanel")?.style.display === "block") {
    renderZoneList();
  }

  saveGame();
}

function closeSiegeEvent(now = Date.now()) {
  initializeSiegeEvent(now);

  state.siegeEvent.active = false;
  state.siegeEvent.endsAt = 0;
  state.siegeEvent.nextCheckAt = now + SIEGE_EVENT_CHECK_MS;
  state.siegeEvent.nextSpawnAt = 0;
  state.siegeEvent.monsters = [];

if (isInSiegeZone()) {
  returnFromEventZone();
}

  clearSiegeVisuals();
  updateSiegeNotification();

  if (document.getElementById("travelPanel")?.style.display === "block") {
    renderZoneList();
  }

  saveGame();
}

function finishSiegeEvent(reason = "ended") {
  if (!state.siegeEvent?.active) return;

  const joined = state.siegeEvent.joined === true;

  // Player never entered Siege, so close silently.
  if (!joined) {
    closeSiegeEvent(Date.now());
    return;
  }

  const kills = state.siegeEvent.kills || 0;
  const survivedSeconds = getSiegeElapsedSeconds();

  const rewards = state.siegeEvent.rewards || {};

  const goldReward = rewards.gold || 0;
  const expReward = rewards.exp || 0;
  const starReward = rewards.stars || 0;

  state.gold = (state.gold || 0) + goldReward;
  state.exp = (state.exp || 0) + expReward;
  state.stars = (state.stars || 0) + starReward;

  if (!state.materials) state.materials = {};
  if (!state.rewards) state.rewards = {};
  if (!state.stats) state.stats = {};

  state.materials.whetstones =
    (state.materials.whetstones || 0) + (rewards.whetstones || 0);

  state.materials.greenEssence =
    (state.materials.greenEssence || 0) + (rewards.greenEssence || 0);

  state.materials.blueEssence =
    (state.materials.blueEssence || 0) + (rewards.blueEssence || 0);

  state.materials.yellowEssence =
    (state.materials.yellowEssence || 0) + (rewards.yellowEssence || 0);

  state.materials.redEssence =
    (state.materials.redEssence || 0) + (rewards.redEssence || 0);

  state.materials.salvageMaterials =
    (state.materials.salvageMaterials || 0) + (rewards.salvageMaterials || 0);

  state.rewards.slotCoins =
    (state.rewards.slotCoins || 0) + (rewards.silverTokens || 0);

  state.stats.starsCollected = (state.stats.starsCollected || 0) + starReward;
  state.stats.starsEarned = (state.stats.starsEarned || 0) + starReward;

  checkLevelUp();

  const resultText =
    reason === "wallDestroyed"
      ? "The wall fell"
      : "The siege ended";

  showFilterNotification(
    "system",
    `🏰 ${resultText}. ${fmt(kills)} kills. Reward: +${fmt(goldReward)} gold, +${fmt(expReward)} EXP, +${fmt(starReward)} stars.`
  );

  const minutes = Math.floor(survivedSeconds / 60);
  const seconds = survivedSeconds % 60;

  showSiegeResultPopup({
    reason,
    kills,
    timeSurvived: `${minutes}:${String(seconds).padStart(2, "0")}`,
    goldReward,
    expReward,
    starReward,
    rewards
  });

  closeSiegeEvent(Date.now());
  updateUI();

  if (document.getElementById("scorePanel")?.style.display === "block") {
    renderScorePanel();
  }

  saveGame();
}

// =====================
// SIEGE GAMEPLAY
// =====================

async function syncGlobalEvents() {
  try {
    const response = await fetch(`${API_URL}/events`);
    const data = await response.json();

    if (!data.success || !data.events) return;

    if (data.events.siege) {
      const wasActive = state.siegeEvent?.active === true;

      state.siegeEvent = {
        ...state.siegeEvent,
        ...data.events.siege
      };

      if (!state.siegeEvent.active && wasActive) {
        clearSiegeVisuals();
      }

      if (state.siegeEvent.active && isInSiegeZone()) {
        renderServerSiegeState();
      }
    }

    updateSiegeNotification?.();

    if (document.getElementById("travelPanel")?.style.display === "block") {
      renderZoneList?.();
    }
  } catch (error) {
    console.warn("Failed to sync global events:", error);
  }
}

function renderServerSiegeState() {
  if (!isSiegeEventActive() || !isInSiegeZone()) {
    clearSiegeVisuals();
    return;
  }

  renderSiegeWall();

  const serverMonsterIds = new Set(
    (state.siegeEvent.monsters || []).map(monster => String(monster.id))
  );

  document.querySelectorAll("[data-siege-monster-id]").forEach(el => {
    if (!serverMonsterIds.has(String(el.dataset.siegeMonsterId))) {
      el.remove();
    }
  });

  (state.siegeEvent.monsters || []).forEach(monster => {
    renderSiegeMonster(monster);
  });
}

function updateSiegeGameplay(now = Date.now()) {
  if (!isSiegeEventActive() || !isInSiegeZone()) {
    clearSiegeVisuals();
    return;
  }

  // Siege monsters, movement, wall HP, and kills are now controlled by the backend.
  // Frontend only renders synced server state.
  renderServerSiegeState();
}

function getSiegeElapsedSeconds() {
  if (!state.siegeEvent?.endsAt) return 0;

  const startedAt = state.siegeEvent.endsAt - SIEGE_EVENT_DURATION_MS;
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

function getSiegeSpawnInterval() {
  const elapsed = getSiegeElapsedSeconds();

  const step = Math.floor(elapsed / 30); // every 30s
  const base = 2500;

  // reduce 200ms per step
  const interval = base - (step * 200);

  // clamp minimum so it doesn’t break gameplay
  return Math.max(400, interval);
}

function getSiegeMonsterTemplate() {
  const startedAt = state.siegeEvent.endsAt - SIEGE_EVENT_DURATION_MS;
  const elapsed = Date.now() - startedAt;

  const seconds = Math.floor(elapsed / 1000);

  // < 60s → only Grunts
  if (seconds < 60) {
    return {
      name: "Siege Grunt",
      hp: 4,
      speed: 150,
      wallDamage: 2,
      sprite: "assets/siege/siege_grunt.gif"
    };
  }

  // 60–120s → Grunts + Runners
  if (seconds < 120) {
    if (Math.random() < 0.35) {
      return {
        name: "Siege Runner",
        hp: 2,
        speed: 200,
        wallDamage: 1,
        sprite: "assets/siege/siege_runner.gif"
      };
    }

    return {
      name: "Siege Grunt",
      hp: 4,
      speed: 150,
      wallDamage: 2,
      sprite: "assets/siege/siege_grunt.gif"
    };
  }

  // 120s+ → all types
  const roll = Math.random();

  if (roll < 0.20) {
    return {
      name: "Siege Brute",
      hp: 8,
      speed: 100,
      wallDamage: 4,
      sprite: "assets/siege/siege_brute.gif"
    };
  }

  if (roll < 0.45) {
    return {
      name: "Siege Runner",
      hp: 2,
      speed: 200,
      wallDamage: 1,
      sprite: "assets/siege/siege_runner.gif"
    };
  }

  return {
    name: "Siege Grunt",
    hp: 4,
    speed: 150,
    wallDamage: 2,
    sprite: "assets/siege/siege_grunt.gif"
  };
}

function startSiegeRenderLoop() {
  function loop() {
    const now = Date.now();

    if (isSiegeEventActive() && isInSiegeZone()) {
      updateSiegeGameplay(now);
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

function spawnSiegeMonster() {
  const arenaEl = document.getElementById("arena");
  if (!arenaEl) return;

  const template = getSiegeMonsterTemplate();

  const monster = {
    id: crypto.randomUUID(),
    name: template.name,
    sprite: template.sprite,
    hp: template.hp,
    maxHp: template.hp,
    x: rand(50, Math.max(60, arenaEl.clientWidth - 50)),
    y: -40,
    speed: template.speed,
    wallDamage: template.wallDamage,
    attackingWall: false,
    lastWallAttackAt: 0
  };

  state.siegeEvent.monsters.push(monster);
  renderSiegeMonster(monster);
}

function moveSiegeMonsters(now = Date.now()) {
  const arenaEl = document.getElementById("arena");
  if (!arenaEl) return;

  const wallY = arenaEl.clientHeight - 860;

  state.siegeEvent.monsters.forEach(monster => {
    if (monster.attackingWall) {
      if (now - (monster.lastWallAttackAt || 0) >= 1000) {
        monster.lastWallAttackAt = now;
        damageSiegeWall(monster.wallDamage);
      }

      return;
    }

    if (!monster.lastMoveAt) monster.lastMoveAt = now;

const deltaSeconds = Math.min(0.25, (now - monster.lastMoveAt) / 1000);
monster.lastMoveAt = now;

monster.y += monster.speed * deltaSeconds;

    if (monster.y >= wallY) {
      monster.y = wallY;
      monster.attackingWall = true;
      monster.lastWallAttackAt = now;
    }

    renderSiegeMonster(monster);
  });
}

async function hitSiegeMonster(id) {
  if (!isSiegeEventActive()) return;
  if (!isInSiegeZone()) return;

  const monster = state.siegeEvent.monsters.find(m => String(m.id) === String(id));
  if (!monster) return;

  showFloatingText("1", monster.x, monster.y, "spell");

  try {
    const response = await fetch(`${API_URL}/events/siege/hit/${encodeURIComponent(id)}`, {
      method: "POST"
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.warn("Siege hit failed:", data.message || data.error);
      return;
    }

    if (data.siege) {
      const killed = data.killed === true;

      state.siegeEvent = {
        ...state.siegeEvent,
        ...data.siege
      };

      if (killed) {
        addSkinProgress?.("siegeKills", 1);
        rollSiegeKillReward(monster);
      }

      renderServerSiegeState();
      updateSiegeNotification();
    }
  } catch (error) {
    console.warn("Failed to hit siege monster:", error);
  }
}

function damageSiegeWall(amount) {
  state.siegeEvent.wallHp = Math.max(0, (state.siegeEvent.wallHp || 0) - amount);

  updateSiegeNotification();

  if (state.siegeEvent.wallHp <= 0) {
    finishSiegeEvent(false);
  }
}

// =====================
// SIEGE RENDERING
// =====================

function renderSiegeWall() {
  const arenaEl = document.getElementById("arena");
  if (!arenaEl) return;

  let wall = document.getElementById("siegeWall");

  if (!wall) {
    wall = document.createElement("div");
    wall.id = "siegeWall";
    arenaEl.appendChild(wall);
  }

  const hp = state.siegeEvent?.wallHp || 0;
  const max = state.siegeEvent?.wallMaxHp || 1;
  const percent = Math.max(0, Math.min(100, (hp / max) * 100));

  wall.innerHTML = `
    <div class="siegeWallTitle">🏰 Castle Wall</div>
    <div class="siegeWallHpBar">
      <div class="siegeWallHpFill" style="width:${percent}%"></div>
    </div>
    <div class="siegeWallHpText">${fmt(hp)} / ${fmt(max)}</div>
  `;
}

function renderSiegeMonster(monster) {
  const arenaEl = document.getElementById("arena");
  if (!arenaEl) return;

  let el = document.querySelector(`[data-siege-monster-id="${monster.id}"]`);

  if (!el) {
    el = document.createElement("div");
    el.className = "siegeMonster";
    el.dataset.siegeMonsterId = monster.id;

    el.onclick = event => {
      event.stopPropagation();
      hitSiegeMonster(monster.id);
    };

    arenaEl.appendChild(el);
  }

  const hpPercent = Math.max(0, Math.min(100, (monster.hp / monster.maxHp) * 100));

  el.style.left = `${monster.x}px`;
  el.style.top = `${monster.y}px`;

  el.innerHTML = `
    <div class="siegeMonsterName">${monster.name}</div>
    <div class="siegeMonsterHp">
      <div class="siegeMonsterHpFill" style="width:${hpPercent}%"></div>
    </div>
    <img src="${monster.sprite}" onerror="this.style.display='none';">
    <div class="siegeMonsterFallback">☠</div>
  `;
}

function removeSiegeMonster(id) {
  if (state.siegeEvent?.monsters) {
    state.siegeEvent.monsters = state.siegeEvent.monsters.filter(m => String(m.id) !== String(id));
  }

  document.querySelectorAll(`[data-siege-monster-id="${id}"]`).forEach(el => el.remove());
}

function cleanupSiegeIfInactiveOrWrongZone() {
  if (!isSiegeEventActive() || !isInSiegeZone()) {
    clearSiegeVisuals();
  }
}

function clearSiegeVisuals() {
  document.querySelectorAll(".siegeMonster").forEach(el => el.remove());
  document.querySelectorAll("[data-siege-monster-id]").forEach(el => el.remove());

  const wall = document.getElementById("siegeWall");
  if (wall) wall.remove();
}

// =====================
// SIEGE NOTIFICATION
// =====================

function updateSiegeNotification() {
  let box = document.getElementById("siegeNotification");

  if (!box) {
    box = document.createElement("div");
    box.id = "siegeNotification";
    getEventNotificationRow()?.appendChild(box);
  }

  if (!isSiegeEventActive()) {
    box.style.display = "none";
    return;
  }

  const wallHp = state.siegeEvent?.wallHp || 0;
  const wallMax = state.siegeEvent?.wallMaxHp || 1;
  const wallPercent = Math.max(0, Math.floor((wallHp / wallMax) * 100));

  box.style.display = "block";
  box.innerHTML = `
    🏰 <b>Siege Battlefield!</b><br>
    Defend the wall manually.<br>
    Wall: <b>${fmt(wallHp)}/${fmt(wallMax)} (${wallPercent}%)</b><br>
    Ends in: <b>${getSiegeTimeLeftText()}</b>
  `;
}

function getSiegeLootMultiplier() {
  const survivedSeconds = getSiegeElapsedSeconds();

  // +10% loot every 30 seconds survived
  const steps = Math.floor(survivedSeconds / 30);

  return 1 + steps * 0.10;
}

function getSiegeRewardZone() {
  return getHighestUnlockedRewardZone();
}

function rollSiegeKillReward(monster) {
  if (!state.siegeEvent.rewards) {
    state.siegeEvent.rewards = {};
  }

  const rewards = state.siegeEvent.rewards;
  const zone = getSiegeRewardZone();
  
  const skinSiegeBonus =
  1 + (getActiveMinotaurSkinBonus?.("siegeRewards") || 0);

const multiplier =
  getSiegeLootMultiplier() * skinSiegeBonus;

  const goldGain = Math.floor(
    rand(zone.gold[0], zone.gold[1]) *
    SIEGE_GOLD_EXP_BASE_MULTIPLIER *
    multiplier
  );

  const expGain = Math.floor(
    rand(zone.exp[0], zone.exp[1]) *
    SIEGE_GOLD_EXP_BASE_MULTIPLIER *
    multiplier
  );

  rewards.gold = (rewards.gold || 0) + goldGain;
  rewards.exp = (rewards.exp || 0) + expGain;

  // Track for Gold/h and EXP/h immediately, but do NOT pay the player yet.
  if (!state.stats) state.stats = {};
  state.stats.goldEarned = (state.stats.goldEarned || 0) + goldGain;
  state.stats.expEarned = (state.stats.expEarned || 0) + expGain;

  rewards.stars =
    (rewards.stars || 0) +
    Math.floor((1 + Math.floor((state.level || 1) / 10)) * multiplier);

  if (Math.random() < 0.06 * multiplier) {
    rewards.whetstones = (rewards.whetstones || 0) + 1;
  }

  if (Math.random() < 0.025 * multiplier) {
    rewards.silverTokens = (rewards.silverTokens || 0) + 1;
  }

  if (Math.random() < 0.12 * multiplier) {
    rewards.salvageMaterials =
      (rewards.salvageMaterials || 0) + Math.max(1, Math.floor(multiplier));
  }

  if (Math.random() < 0.12 * multiplier) {
    rewards.greenEssence = (rewards.greenEssence || 0) + 1;
  }

  if (Math.random() < 0.07 * multiplier) {
    rewards.blueEssence = (rewards.blueEssence || 0) + 1;
  }

  if (Math.random() < 0.035 * multiplier) {
    rewards.yellowEssence = (rewards.yellowEssence || 0) + 1;
  }

  if (Math.random() < 0.015 * multiplier) {
    rewards.redEssence = (rewards.redEssence || 0) + 1;
  }
}

function showSiegeResultPopup(data) {
  const existing = document.getElementById("siegeResultPopup");
  if (existing) existing.remove();

  const popup = document.createElement("div");
  popup.id = "siegeResultPopup";

  popup.innerHTML = `
    <div class="siegeResultBox">
      <div class="siegeResultTitle">🏰 The Siege has ended</div>

      <div class="siegeResultSub">
        ${data.reason === "wallDestroyed"
          ? "The castle wall was destroyed."
          : "You held the line until the siege ended."}
      </div>

      <div class="siegeResultStats">
        <div><span>Monsters defeated</span><b>${fmt(data.kills)}</b></div>
        <div><span>Time survived</span><b>${data.timeSurvived}</b></div>
        <div><span>Gold reward</span><b>+${fmt(data.goldReward)}</b></div>
        <div><span>Star reward</span><b>+${fmt(data.starReward)}</b></div>
		<div><span>EXP reward</span><b>+${fmt(data.expReward || 0)}</b></div>
<div><span>Whetstones</span><b>+${fmt(data.rewards?.whetstones || 0)}</b></div>
<div><span>Salvage materials</span><b>+${fmt(data.rewards?.salvageMaterials || 0)}</b></div>
<div><span>Silver tokens</span><b>+${fmt(data.rewards?.silverTokens || 0)}</b></div>
<div><span>Essences</span><b>
  +${fmt(data.rewards?.greenEssence || 0)}G /
  +${fmt(data.rewards?.blueEssence || 0)}B /
  +${fmt(data.rewards?.yellowEssence || 0)}Y /
  +${fmt(data.rewards?.redEssence || 0)}R
</b></div>
      </div>

      <button onclick="document.getElementById('siegeResultPopup')?.remove()">
        Continue
      </button>
    </div>
  `;

  document.body.appendChild(popup);
}

// =====================
// SIEGE EVENT LOOP
// =====================

function updateSiegeEvent(now = Date.now()) {
  initializeSiegeEvent(now);

  // Siege opening is now controlled globally by the backend /events route.
  // Do not roll local random siege events per player.

  if (state.siegeEvent.active && now >= state.siegeEvent.endsAt) {
    finishSiegeEvent("timerEnded");
  }
}

// =====================
// GLOBAL EXPORTS
// =====================

window.SIEGE_ZONE_ID = SIEGE_ZONE_ID;
window.updateSiegeEvent = updateSiegeEvent;
window.openSiegeEvent = openSiegeEvent;
window.closeSiegeEvent = closeSiegeEvent;
window.isSiegeEventActive = isSiegeEventActive;
window.updateSiegeNotification = updateSiegeNotification;
window.hitSiegeMonster = hitSiegeMonster;