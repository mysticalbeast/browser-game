const express = require("express");
const crypto = require("crypto");
const authMiddleware = require("../middleware/auth");
const db = require("../database");

const {
  loadPlayerSave,
  savePlayerSave
} = require("../dbSaves");

const router = express.Router();

async function saveCombatSession(token, session) {
  await db.query(
    `
    INSERT INTO combat_sessions (
      token,
      session_data,
      created_at
    )
    VALUES ($1, $2, $3)
    ON CONFLICT (token)
    DO UPDATE SET
      session_data = EXCLUDED.session_data,
      created_at = EXCLUDED.created_at
    `,
    [
      token,
      JSON.stringify(session),
      Number(session.createdAt || Date.now())
    ]
  );
}

async function loadCombatSession(token) {
  const result = await db.query(
    `
    SELECT session_data
    FROM combat_sessions
    WHERE token = $1
    `,
    [String(token || "")]
  );

  return result.rows[0]?.session_data || null;
}

async function deleteCombatSession(token) {
  await db.query(
    `
    DELETE FROM combat_sessions
    WHERE token = $1
    `,
    [String(token || "")]
  );
}

async function markCombatSessionUsed(token, session) {
  session.used = true;

  await saveCombatSession(token, session);
}

function saveCombatSessions(sessions) {
  fs.writeFileSync(COMBAT_SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

function getUberDifficultyLevelFromSave(save) {
  return Number(save?.skills?.uberDifficulty || 0);
}

function getLikeABossLevelFromSave(save) {
  return Number(save?.skills?.likeABoss || 0);
}

function rollBackendMonsterFlags(save) {
  const bossChance = 0.01 + getLikeABossLevelFromSave(save) * 0.001;

  const uberLevel = getUberDifficultyLevelFromSave(save);
  const uberChance = uberLevel > 0 ? uberLevel * 0.005 : 0;

  const isBoss = Math.random() < bossChance;
  const isUber = isBoss && Math.random() < uberChance;
  const isMythicUber = isUber && uberLevel >= 10 && Math.random() < 0.10;

  return {
    isBoss,
    isUber,
    isMythicUber
  };
}

function saveSaves(saves) {
  fs.writeFileSync(SAVES_FILE, JSON.stringify(saves, null, 2));
}

function isPotionActive(save, key) {
  return Number(save?.[key] || 0) > Date.now();
}

function getEnhancedItemStatValue(item, statKey, baseValue) {
  const enhance = Number(item?.enhanceLevel || 0);

  if (statKey === "critChance") {
    return Number((baseValue + baseValue * enhance * 0.33).toFixed(2));
  }

  if (String(statKey).toLowerCase().includes("skill")) {
    return baseValue + Math.floor(enhance * 0.75);
  }

  return Math.floor(baseValue * (1 + enhance * 0.33));
}

function getTotalEquipmentStat(save, statKey) {
  let total = 0;

  Object.values(save?.equipment || {}).forEach(item => {
    if (!item || !item.stats) return;

    const baseValue = Number(item.stats[statKey] || 0);
    if (!baseValue) return;

    total += getEnhancedItemStatValue(item, statKey, baseValue);
  });

  return Math.floor(total);
}

const RESEARCH_MILESTONES = [
  { kills: 1000, bonus: { damage: 0.03 } },
  { kills: 5000, bonus: { gold: 0.03 } },
  { kills: 10000, bonus: { exp: 0.03 } },
  { kills: 50000, bonus: { materials: 0.05 } },
  { kills: 100000, bonus: { critDamage: 0.10 } },
  { kills: 500000, bonus: { overkillSplash: 0.20 } },
  { kills: 1000000, bonus: { rareDrops: 0.10 } }
];

function getTotalResearchBonus(save, stat) {
  let total = 0;

  Object.values(save?.monsterResearch || {}).forEach(progress => {
    const unlocked = Array.isArray(progress?.unlocked) ? progress.unlocked : [];

    unlocked.forEach(index => {
      const bonus = RESEARCH_MILESTONES[index]?.bonus;
      if (bonus?.[stat]) total += bonus[stat];
    });
  });

  return total;
}

function getPhoenixBonusMultiplier(save) {
  const phoenixLevel = Number(save?.constellations?.phoenix || 0);

  if (phoenixLevel <= 0) return 1;
  if (Number(save?.level || 1) > 100) return 1;

  return 1 + phoenixLevel * 0.05;
}

function getFishingGoldGainBonus(save) {
  return 1 + Number(save?.fishing?.shopUpgrades?.biggerPouches || 0) * 0.01;
}

function getFishingExpGainBonus(save) {
  return 1 + Number(save?.fishing?.shopUpgrades?.shinierGems || 0) * 0.01;
}

function getUberDifficultyLevel(save) {
  return Number(save?.skills?.uberDifficulty || 0);
}

function getUberLootBonusMultiplier(save) {
  const level = getUberDifficultyLevel(save);

  let bonus = 0;

  if (level >= 2) bonus += 0.10;
  if (level >= 6) bonus += 0.10;

  return 1 + bonus;
}

function getUberExpBonusMultiplier(save) {
  const level = getUberDifficultyLevel(save);

  let bonus = 0;

  if (level >= 3) bonus += 0.10;
  if (level >= 7) bonus += 0.10;

  return 1 + bonus;
}

function getUberExtraLootRolls(save) {
  const level = getUberDifficultyLevel(save);

  let rolls = 0;

  if (level >= 5) rolls += 1;
  if (level >= 9) rolls += 1;

  return rolls;
}

function getBackendRewardMultipliers(save, isBoss, isUber) {
  const skills = save?.skills || {};

  const skillGoldBoost = 1 + Number(skills.deepPockets || 0) * 0.10;
  const skillExpBoost = 1 + Number(skills.experiencedHunter || 0) * 0.10;

  const potionGoldBoost = isPotionActive(save, "wealthUntil") ? 1.25 : 1;
  const potionExpBoost = isPotionActive(save, "wisdomUntil") ? 1.25 : 1;

  const researchGoldBoost = 1 + getTotalResearchBonus(save, "gold");
  const researchExpBoost = 1 + getTotalResearchBonus(save, "exp");

  const fishingGoldBoost = getFishingGoldGainBonus(save);
  const fishingExpBoost = getFishingExpGainBonus(save);

  const phoenixBoost = getPhoenixBonusMultiplier(save);

  const skinBossBonus =
    isBoss && save?.skins?.equipped?.minotaurArcher
      ? 1
      : 1;

  const uberLootMultiplier = isUber ? getUberLootBonusMultiplier(save) : 1;
  const uberExpMultiplier = isUber ? getUberExpBonusMultiplier(save) : 1;

  return {
    goldMultiplier:
      skillGoldBoost *
      potionGoldBoost *
      researchGoldBoost *
      phoenixBoost *
      fishingGoldBoost *
      skinBossBonus *
      uberLootMultiplier,

    expMultiplier:
      skillExpBoost *
      potionExpBoost *
      researchExpBoost *
      phoenixBoost *
      fishingExpBoost *
      skinBossBonus *
      uberExpMultiplier,

    essenceMultiplier:
      (1 + Number(skills.materialistic || 0) * 0.02) *
      (1 + getTotalResearchBonus(save, "materials")),

    bossLootMultiplier:
      isBoss
        ? 1 + Number(skills.lootHungry || 0) * 0.05
        : 1,

    equipmentDropMultiplier:
      (1 + Number(skills.gearingUp || 0) * 0.10) *
      (1 + getTotalResearchBonus(save, "rareDrops")) *
      (1 + getTotalEquipmentStat(save, "lootChance") / 100),

    whetstoneDropMultiplier:
      (1 + getTotalResearchBonus(save, "rareDrops")) *
      (1 + getTotalEquipmentStat(save, "lootChance") / 100) *
      (1 + getTotalEquipmentStat(save, "whetstoneChance") / 100),

    doubleDropChance:
      Math.max(0, Math.min(1, getTotalEquipmentStat(save, "doubleDrop") / 100)),

    extraUberLootRolls:
      isUber ? getUberExtraLootRolls(save) : 0
  };
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const ZONE_REWARDS = {
  1: { gold: [2, 5], exp: [4, 8] },
  2: { gold: [6, 12], exp: [10, 18] },
  3: { gold: [12, 22], exp: [18, 32] },
  4: { gold: [25, 45], exp: [40, 70] },
  5: { gold: [45, 80], exp: [75, 120] },
  6: { gold: [75, 130], exp: [120, 190] },
  7: { gold: [100, 170], exp: [165, 260] },
  8: { gold: [135, 230], exp: [220, 340] },
  9: { gold: [190, 320], exp: [310, 480] },
  10: { gold: [270, 450], exp: [430, 680] },
  11: { gold: [380, 620], exp: [600, 920] },
  12: { gold: [520, 850], exp: [820, 1250] },
  13: { gold: [690, 1120], exp: [1100, 1650] },
  14: { gold: [900, 1450], exp: [1450, 2150] },
  15: { gold: [1180, 1900], exp: [1850, 2800] },
  16: { gold: [1550, 2500], exp: [2400, 3600] },
  17: { gold: [2050, 3300], exp: [3100, 4600] },
  18: { gold: [2700, 4300], exp: [4000, 6000] },
  19: { gold: [3500, 5600], exp: [5200, 7800] },
  20: { gold: [4500, 7200], exp: [6800, 10000] },
  21: { gold: [5900, 9300], exp: [8600, 12800] },
  22: { gold: [7600, 12000], exp: [11000, 16500] },
  23: { gold: [9700, 15300], exp: [14000, 21000] },
  24: { gold: [12500, 19500], exp: [18000, 27000] },
  25: { gold: [16000, 25000], exp: [23000, 34500] },
  26: { gold: [20500, 32000], exp: [29500, 44000] },
  27: { gold: [26500, 41000], exp: [38000, 57000] },
  28: { gold: [34000, 53000], exp: [49000, 73000] },
  29: { gold: [44000, 68000], exp: [63000, 94000] },
  30: { gold: [57000, 88000], exp: [82000, 123000] }
};

function clampMultiplier(value, min = 1, max = 1000) {
  const number = Number(value);

  if (!Number.isFinite(number)) return min;

  return Math.max(min, Math.min(max, number));
}

const EQUIPMENT_ITEM_TYPES = [
  "armor",
  "helmet",
  "legs",
  "shoes",
  "necklace",
  "ring",
  "shield"
];

const EQUIPMENT_TIER_NAMES = {
  armor: ["Jacket", "Doublet", "Studded Armor", "Chain Armor", "Brass Armor", "Gnomish Cuirass", "Elven Mail", "Dwarven Armor", "Albino Plate", "Knight Armor"],
  helmet: ["Leather Helmet", "Studded Helmet", "Chain Helmet", "Brass Helmet", "Legion Helmet", "Iron Helmet", "Dark Helmet", "Dwarven Helmet", "Steel Helmet", "Devil Helmet"],
  legs: ["Leather Legs", "Studded Legs", "Chain Legs", "Brass Legs", "Alloy Legs", "Wereboar Loincloth", "Dwarven Legs", "Plate Legs", "Grasshopper Legs", "Blue Legs"],
  shoes: ["Boots of Haste", "Coconut Shoes", "Sandals", "Crocodile Boots", "Metal Spats", "Fur Boots", "Draken Boots", "Firewalker Boots", "Void Boots", "Frostflower Boots"],
  necklace: ["Crystal Necklace", "Dragon Necklace", "Elven Amulet", "Gearwheel Chain", "Leviathans Amulet", "Foxtail Amulet", "Collar of Red Plasma", "Prismatic Necklace", "Turtle Amulet", "Enchanted Turtle Amulet"],
  ring: ["Sword Ring", "Butterfly Ring", "Claw of the Noxious Spawn", "Ring of Red Plasma", "Prismatic Ring", "Ring of Souls", "Alicorn Ring", "Ethereal Ring", "Arcanomancer Sigil", "Spiritthorn Ring"],
  shield: ["Wooden Shield", "Studded Shield", "Brass Shield", "Plate Shield", "Steel Shield", "Battle Shield", "Dark Shield", "Ancient Shield", "Guardian Shield", "Tower Shield"]
};

const EQUIPMENT_TYPE_ICONS = {
  armor: "🥋",
  helmet: "⛑",
  legs: "👖",
  shoes: "🥾",
  necklace: "📿",
  ring: "💍",
  shield: "🛡"
};

const ITEM_RARITIES = [
  { key: "common", name: "Common", weight: 70, multiplier: 1.0, color: "#b8b8b8" },
  { key: "uncommon", name: "Uncommon", weight: 22, multiplier: 1.35, color: "#53ff7a" },
  { key: "rare", name: "Rare", weight: 7, multiplier: 1.8, color: "#4dabf7" },
  { key: "legendary", name: "Legendary", weight: 1, multiplier: 2.8, color: "#ffb84d" }
];

const ITEM_STATS = {
  damage: { min: 1, max: 2 },
  gold: { min: 1, max: 3 },
  exp: { min: 1, max: 2 },
  crit: { min: 0.25, max: 1 },
  attackSpeed: { min: 0.5, max: 2.5 },
  critDamage: { min: 5, max: 20 },
  doubleDrop: { min: 1, max: 3 },
  whetstoneChance: { min: 1, max: 3 },
  lootChance: { min: 2, max: 8 },
  researchEcho: { min: 1, max: 3 }
};

const EQUIPMENT_STAT_POOLS = {
  armor: ["damage", "gold", "exp", "crit", "attackSpeed", "critDamage", "doubleDrop", "whetstoneChance", "lootChance", "researchEcho"],
  helmet: ["damage", "gold", "exp", "crit", "attackSpeed", "critDamage", "doubleDrop", "whetstoneChance", "lootChance", "researchEcho"],
  legs: ["damage", "gold", "exp", "crit", "attackSpeed", "critDamage", "doubleDrop", "whetstoneChance", "lootChance", "researchEcho"],
  shoes: ["damage", "gold", "exp", "crit", "attackSpeed", "critDamage", "doubleDrop", "whetstoneChance", "lootChance", "researchEcho"],
  necklace: ["damage", "gold", "exp", "crit", "attackSpeed", "critDamage", "doubleDrop", "whetstoneChance", "lootChance", "researchEcho"],
  ring: ["damage", "gold", "exp", "crit", "attackSpeed", "critDamage", "doubleDrop", "whetstoneChance", "lootChance", "researchEcho"],
  shield: ["damage", "gold", "exp", "crit", "attackSpeed", "critDamage", "doubleDrop", "whetstoneChance", "lootChance", "researchEcho"]
};

function pickWeighted(items) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const item of items) {
    roll -= item.weight;

    if (roll <= 0) {
      return item;
    }
  }

  return items[items.length - 1];
}

function getTierWeightsForZone(zoneId) {
  const zone = Math.max(1, Number(zoneId) || 1);
  const maxTier = Math.max(1, Math.min(10, Math.ceil(zone * 1.35)));

  const weights = [];

  for (let tier = 1; tier <= maxTier; tier++) {
    weights.push({
      tier,
      weight: Math.max(1, 100 - tier * 8)
    });
  }

  return weights;
}

function rollItemTier(zoneId) {
  const weights = getTierWeightsForZone(zoneId);
  const result = pickWeighted(weights);

  return Math.min(10, result.tier);
}

function rollItemRarity() {
  return pickWeighted(ITEM_RARITIES);
}

function getTierMultiplier(tier) {
  return 1 + (tier - 1) * 0.75;
}

function getItemStatCountByRarity(rarityKey) {
  if (rarityKey === "common") return 1;
  if (rarityKey === "uncommon") return 2;
  if (rarityKey === "rare") return 3;
  if (rarityKey === "legendary") return 4;
  return 1;
}

function getEquipmentSprite(type, name) {
  const fileName = name.toLowerCase().replaceAll(" ", "_").replaceAll("'", "");
  return `assets/equipment/${type}/${fileName}.gif`;
}

function generateBackendEquipmentItem(zoneId) {
  const type = EQUIPMENT_ITEM_TYPES[rand(0, EQUIPMENT_ITEM_TYPES.length - 1)];
  const tier = rollItemTier(zoneId);
  const rarity = rollItemRarity();

  const name = EQUIPMENT_TIER_NAMES[type][tier - 1];

  const statPool = [...EQUIPMENT_STAT_POOLS[type]];
  const statCount = Math.min(
    getItemStatCountByRarity(rarity.key),
    statPool.length
  );

  const stats = {};

  for (let i = 0; i < statCount; i++) {
    const index = rand(0, statPool.length - 1);
    const statKey = statPool.splice(index, 1)[0];
    const statDef = ITEM_STATS[statKey];

    const baseRoll = rand(statDef.min, statDef.max);
    const rawValue =
      baseRoll *
      getTierMultiplier(tier) *
      rarity.multiplier;

    const value =
      statKey === "crit"
        ? Number(rawValue.toFixed(2))
        : Math.floor(rawValue);

    stats[statKey] = value;
  }

  return {
    id: crypto.randomUUID(),
    type,
    tier,
    rarity: rarity.key,
    rarityName: rarity.name,
    rarityColor: rarity.color,
    name,
    icon: EQUIPMENT_TYPE_ICONS[type],
    sprite: getEquipmentSprite(type, name),
    stats,
    enhanceLevel: 0
  };
}

function addLootAmount(target, key, amount) {
  if (!amount || amount <= 0) return;
  target[key] = (target[key] || 0) + amount;
}

function rollDoubleAmount(amount, doubleDropChance) {
  if (Math.random() < doubleDropChance) {
    return amount * 2;
  }

  return amount;
}

function rollBackendLoot(options) {
  const {
    zoneId,
    isBoss,
    isUber,
    essenceMultiplier,
    bossLootMultiplier,
    equipmentDropMultiplier,
    whetstoneDropMultiplier,
    doubleDropChance,
    extraUberLootRolls
  } = options;

  const loot = {
    materials: {},
    equipmentDrops: 0,
    treasureChests: 0,
    goldenTreasureChests: 0
  };

  // =========================
  // NORMAL ESSENCES
  // =========================

  const essenceDrops = [
    { key: "greenEssence", chance: 0.01 },
    { key: "blueEssence", chance: 0.005 },
    { key: "yellowEssence", chance: 0.0025 },
    { key: "redEssence", chance: 0.001 }
  ];

  essenceDrops.forEach(drop => {
    const chance = drop.chance * essenceMultiplier * bossLootMultiplier;

    if (Math.random() < chance) {
      const amount = rollDoubleAmount(1, doubleDropChance);
      addLootAmount(loot.materials, drop.key, amount);
    }
  });

  // =========================
  // BOSS ESSENCES
  // =========================

  if (isBoss) {
    const bossEssencePool = [
      { key: "greenEssence", min: 1, max: 3, weight: 60 },
      { key: "blueEssence", min: 1, max: 2, weight: 35 },
      { key: "yellowEssence", min: 1, max: 1, weight: 18 },
      { key: "redEssence", min: 1, max: 1, weight: 6 }
    ];

    const guaranteedRolls =
      (isUber ? rand(6, 10) : rand(2, 4)) +
      (isUber ? extraUberLootRolls : 0);

    const totalWeight = bossEssencePool.reduce((sum, drop) => sum + drop.weight, 0);

    for (let i = 0; i < guaranteedRolls; i++) {
      let roll = Math.random() * totalWeight;
      let selected = bossEssencePool[0];

      for (const drop of bossEssencePool) {
        roll -= drop.weight;

        if (roll <= 0) {
          selected = drop;
          break;
        }
      }

      let amount = rand(selected.min, selected.max);

      if (isUber) {
        const boostedAmount = amount * bossLootMultiplier;
        const guaranteedAmount = Math.floor(boostedAmount);
        const bonusChance = boostedAmount - guaranteedAmount;

        amount = guaranteedAmount;

        if (Math.random() < bonusChance) {
          amount += 1;
        }

        amount = Math.max(1, amount);
      }

      amount = rollDoubleAmount(amount, doubleDropChance);

      addLootAmount(loot.materials, selected.key, amount);
    }
  }

  // =========================
  // EQUIPMENT DROPS
  // =========================

  let equipmentChance = 0.005;

  if (isBoss) equipmentChance = 0.025;
  if (isUber) equipmentChance = 0.05;

  equipmentChance *= equipmentDropMultiplier;

  if (Math.random() < equipmentChance) {
  let totalDrops = 1;

  if (Math.random() < doubleDropChance) {
    totalDrops++;
  }

  if (isUber) {
    totalDrops += extraUberLootRolls;
  }

  loot.equipmentDrops = totalDrops;
  loot.equipmentItems = [];

  for (let i = 0; i < totalDrops; i++) {
    loot.equipmentItems.push(generateBackendEquipmentItem(zoneId));
  }
}

  // =========================
  // WHETSTONES
  // =========================

  const whetstoneChance =
    ((0.005 + zoneId * 0.0005) / 25) *
    whetstoneDropMultiplier;

  if (Math.random() < whetstoneChance) {
    const amount = rollDoubleAmount(1, doubleDropChance);
    addLootAmount(loot.materials, "whetstones", amount);
  }

  // =========================
  // TREASURE CHESTS
  // =========================

  let treasureChance = 0.002;

  if (isBoss) treasureChance = 0.05;
  if (isUber) treasureChance = 0.25;

  if (Math.random() < treasureChance) {
    loot.treasureChests += 1;
  }

  if (Math.random() < 0.00001) {
    loot.goldenTreasureChests += 1;
  }

  return loot;
}

function createStarterCombatSave() {
  return {
    level: 1,
    exp: 0,
    gold: 0,
    stars: 0,
    rebirthCoins: 0,
    zoneId: 1,
    skills: {},
    equipment: {},
    equipmentInventory: [],
    inventory: {},
    materials: {},
    stats: {
      monstersKilled: 0,
      goldEarned: 0,
      expEarned: 0
    },
    monsterResearch: {},
    fishing: {
      shopUpgrades: {}
    },
    constellations: {},
    skins: {
      equipped: {}
    },
    lastSeenAt: Date.now()
  };
}

router.post("/spawn", authMiddleware, async (req, res) => {
  try {
    let save = await loadPlayerSave(req.user.id);

    if (!save) {
      save = createStarterCombatSave();
      await savePlayerSave(req.user.id, save);
    }

    const flags = rollBackendMonsterFlags(save);
    const combatToken = crypto.randomUUID();

    await saveCombatSession(combatToken, {
      userId: req.user.id,
      createdAt: Date.now(),
      used: false,
      isBoss: flags.isBoss,
      isUber: flags.isUber,
      isMythicUber: flags.isMythicUber
    });

    res.json({
      success: true,
      combatToken,
      isBoss: flags.isBoss,
      isUber: flags.isUber,
      isMythicUber: flags.isMythicUber
    });
  } catch (error) {
    console.error("Combat spawn failed:", error);

    res.status(500).json({
      success: false,
      message: "Combat spawn failed."
    });
  }
});

router.post("/kill", authMiddleware, async (req, res) => {
  const {
    zoneId,
    combatToken
  } = req.body || {};

  const zone = ZONE_REWARDS[Number(zoneId)];

  if (!zone) {
    return res.status(400).json({
      success: false,
      message: "Invalid zone."
    });
  }

    const session = await loadCombatSession(combatToken);

  if (!session || session.userId !== req.user.id || session.used) {
    return res.status(400).json({
      success: false,
      message: "Invalid or already used combat token."
    });
  }

  const maxTokenAgeMs = 5 * 60 * 1000;

  if (Date.now() - Number(session.createdAt || 0) > maxTokenAgeMs) {
    await deleteCombatSession(combatToken);

    return res.status(400).json({
      success: false,
      message: "Expired combat token."
    });
  }

  await markCombatSessionUsed(combatToken, session);

  const safeIsBoss = session.isBoss === true;
  const safeIsUber = session.isUber === true;

    const save = await loadPlayerSave(req.user.id);

  if (!save) {
    return res.status(400).json({
      success: false,
      message: "No cloud save found."
    });
  }

  const multipliers = getBackendRewardMultipliers(
    save,
    safeIsBoss,
    safeIsUber
  );

  const bossMultiplier =
    safeIsUber ? 100 :
    safeIsBoss ? 25 :
    1;

  const gold = Math.floor(
    rand(zone.gold[0], zone.gold[1]) *
    bossMultiplier *
    clampMultiplier(multipliers.goldMultiplier)
  );

  const exp = Math.floor(
    rand(zone.exp[0], zone.exp[1]) *
    bossMultiplier *
    clampMultiplier(multipliers.expMultiplier)
  );

  const loot = rollBackendLoot({
    zoneId: Number(zoneId),
    isBoss: safeIsBoss,
    isUber: safeIsUber,

    essenceMultiplier: clampMultiplier(
      multipliers.essenceMultiplier,
      1,
      100
    ),

    bossLootMultiplier: clampMultiplier(
      multipliers.bossLootMultiplier,
      1,
      100
    ),

    equipmentDropMultiplier: clampMultiplier(
      multipliers.equipmentDropMultiplier,
      1,
      100
    ),

    whetstoneDropMultiplier: clampMultiplier(
      multipliers.whetstoneDropMultiplier,
      1,
      100
    ),

    doubleDropChance: multipliers.doubleDropChance,

    extraUberLootRolls: multipliers.extraUberLootRolls
  });

  save.gold = Math.floor(
    Number(save.gold || 0) + gold
  );

  save.exp = Math.floor(
    Number(save.exp || 0) + exp
  );

  if (!save.stats || typeof save.stats !== "object") {
    save.stats = {};
  }

  save.stats.monstersKilled = Math.floor(
    Number(save.stats.monstersKilled || 0) + 1
  );

  save.stats.goldEarned = Math.floor(
    Number(save.stats.goldEarned || 0) + gold
  );

  save.stats.expEarned = Math.floor(
    Number(save.stats.expEarned || 0) + exp
  );

  if (!save.materials || typeof save.materials !== "object") {
    save.materials = {};
  }

  Object.entries(loot.materials || {}).forEach(([key, amount]) => {
    save.materials[key] = Math.floor(
      Number(save.materials[key] || 0) + Number(amount || 0)
    );
  });

  if (!save.inventory || typeof save.inventory !== "object") {
    save.inventory = {};
  }

  if (loot.treasureChests > 0) {
    save.inventory.treasureChest = Math.floor(
      Number(save.inventory.treasureChest || 0) +
      loot.treasureChests
    );
  }

  if (loot.goldenTreasureChests > 0) {
    save.inventory.goldenTreasureChest = Math.floor(
      Number(save.inventory.goldenTreasureChest || 0) +
      loot.goldenTreasureChests
    );
  }

  if (!Array.isArray(save.equipmentInventory)) {
    save.equipmentInventory = [];
  }

  if (
    Array.isArray(loot.equipmentItems) &&
    loot.equipmentItems.length > 0
  ) {
    save.equipmentInventory.push(...loot.equipmentItems);
  }

  save.lastSeenAt = Date.now();

  await savePlayerSave(req.user.id, save);

  res.json({
    success: true,
    reward: {
      gold,
      exp,
      loot
    }
  });
});

module.exports = router;