// =====================
// MONSTER SYSTEM
// =====================

function pickMonsterFromZone(zone) {
  const total = zone.monsters.reduce((sum, m) => sum + m.weight, 0);
  let roll = Math.random() * total;

  for (const m of zone.monsters) {
    roll -= m.weight;
    if (roll <= 0) return m;
  }

  return zone.monsters[0];
}

function monsterMaxHp(template = null) {
  const zone = currentZone();

  if (!zone) return 50;

  const baseHp = template?.hp || zone.hp || 50;
  const zoneMultiplier =
    typeof getZoneHpMultiplier === "function"
      ? getZoneHpMultiplier(zone)
      : 1;

  return Math.floor(
    baseHp *
    zoneMultiplier *
    (1 + Math.max(0, state.level - zone.levelReq) * 0.025)
  );
}

function getUberDifficultyLevel() {
  return state.skills?.uberDifficulty || 0;
}

function isUberUnlocked() {
  return getUberDifficultyLevel() >= 1;
}

function getUberLootBonusMultiplier() {
  const level = getUberDifficultyLevel();

  let bonus = 0;

  if (level >= 2) bonus += 0.10;
  if (level >= 6) bonus += 0.10;

  return 1 + bonus;
}

function getUberExpBonusMultiplier() {
  const level = getUberDifficultyLevel();

  let bonus = 0;

  if (level >= 3) bonus += 0.10;
  if (level >= 7) bonus += 0.10;

  return 1 + bonus;
}

function getUberExtraLootRolls() {
  const level = getUberDifficultyLevel();

  let rolls = 0;

  if (level >= 5) rolls += 1;
  if (level >= 9) rolls += 1;

  return rolls;
}

function isMythicUberUnlocked() {
  return getUberDifficultyLevel() >= 10;
}

function createMonster() {
  if (state.monsters.length >= getMaxMonsters()) return;

  const zone = currentZone();

  // Observatory / no-combat zones
  if (zone.noMonsters || !zone.monsters || zone.monsters.length === 0) {
    return;
  }

  const template = pickMonsterFromZone(zone);
  if (!template) return;

  const rect = arena.getBoundingClientRect();

  const bossChance = 0.01 + (state.skills.likeABoss || 0) * 0.001;
  const isBoss = Math.random() < bossChance;

const uberLevel = state.skills.uberDifficulty || 0;
const uberChance = uberLevel > 0 ? uberLevel * 0.005 : 0;
const isUber = isBoss && Math.random() < uberChance;

const isMythicUber =
  isUber &&
  isMythicUberUnlocked() &&
  Math.random() < 0.10;

const baseHp = monsterMaxHp(template);
const hpMultiplier = isMythicUber ? 30 : isUber ? 15 : isBoss ? 5 : 1;

const monster = {
  id: crypto.randomUUID(),
  name: isMythicUber ? `Mythic ${template.name}` : template.name,
  sprite: template.sprite,
  x: rand(80, rect.width - 80),
  y: rand(80, rect.height - 220),

  isBoss,
  isUber,
  isMythicUber,
  maxHp: baseHp * hpMultiplier,
  hp: baseHp * hpMultiplier
};

  state.monsters.push(monster);
  renderMonster(monster);
}

function renderMonster(monster) {
  let el = document.querySelector(`[data-monster-id="${monster.id}"]`);

  if (!el) {
    el = document.createElement("div");
    el.className = "monster";
    el.dataset.monsterId = monster.id;

    el.onclick = () => hitMonster(monster.id);

    arena.appendChild(el);
  }

  el.style.left = monster.x + "px";
  el.style.top = monster.y + "px";

el.classList.toggle("bossMonster", monster.isBoss);
el.classList.toggle("uberMonster", monster.isUber);

const name = monster.isMythicUber
  ? `[MYTHIC UBER] ${monster.name.replace("Mythic ", "")}`
  : monster.isUber
    ? `[UBER BOSS] ${monster.name}`
    : monster.isBoss
      ? `[BOSS] ${monster.name}`
      : monster.name;

  const hpPercent = Math.max(0, (monster.hp / monster.maxHp) * 100);

  el.innerHTML = `
    <div class="monsterName ${monster.isBoss ? "bossName" : ""}">
      ${name}
    </div>

    <div class="hpBar">
      <div class="hpFill" style="width:${hpPercent}%"></div>
    </div>

    <img class="monsterSprite"
     src="${monster.sprite}"
     onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">

<div class="fallbackMonster" style="display:none;"></div>
  `;
}

function spawnDamageText(x, y, amount) {
  const el = document.createElement("div");
  el.className = "damageText";
  el.textContent = amount;

  el.style.left = x + "px";
  el.style.top = y + "px";

  arena.appendChild(el);

  setTimeout(() => el.remove(), 600);
}

function rollWhetstoneDrop() {
  const zone = currentZone();

  const researchRareDropBoost = 1 + getTotalResearchBonus("rareDrops");
  const gearLootBoost = 1 + getTotalEquipmentStat("lootChance") / 100;
  const gearWhetstoneBoost = 1 + getTotalEquipmentStat("whetstoneChance") / 100;

  const chance =
    ((0.005 + zone.id * 0.0005) / 25) *
    researchRareDropBoost *
    gearLootBoost *
    gearWhetstoneBoost;

  if (Math.random() < chance) {
    if (!state.materials) state.materials = { ...DEFAULT_MATERIALS };

    let amount = 1;

    if (Math.random() < getTotalEquipmentStat("doubleDrop") / 100) {
      amount++;
    }

    state.materials.whetstones = (state.materials.whetstones || 0) + amount;

    showFilterNotification(
      "salvage",
      amount > 1 ? `🪨 Found ${amount} Whetstones!` : "🪨 Found a Whetstone!"
    );

    renderBlacksmithPanel();
    saveGame();
  }
}

function clearMonsters() {
  state.monsters = [];

  document.querySelectorAll(".monster").forEach(el => el.remove());
}