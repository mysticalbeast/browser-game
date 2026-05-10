const express = require("express");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const ZONE_REWARDS = {
  1: { gold: [2, 5], exp: [4, 8] },
  2: { gold: [4, 10], exp: [8, 15] },
  3: { gold: [8, 18], exp: [15, 28] },
  4: { gold: [15, 35], exp: [30, 55] },
  5: { gold: [25, 60], exp: [55, 95] },
  6: { gold: [40, 95], exp: [95, 150] },
  7: { gold: [65, 140], exp: [150, 230] }
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

router.post("/kill", authMiddleware, (req, res) => {
  const {
    zoneId,
    isBoss,
    isUber,
    goldMultiplier,
    expMultiplier,

    essenceMultiplier,
    bossLootMultiplier,
    equipmentDropMultiplier,
    whetstoneDropMultiplier,
    doubleDropChance,
    extraUberLootRolls
  } = req.body || {};

  const zone = ZONE_REWARDS[Number(zoneId)];

  if (!zone) {
    return res.status(400).json({
      success: false,
      message: "Invalid zone."
    });
  }

  const bossMultiplier = isUber ? 100 : isBoss ? 25 : 1;

  const safeGoldMultiplier = clampMultiplier(goldMultiplier);
  const safeExpMultiplier = clampMultiplier(expMultiplier);

  const safeEssenceMultiplier = clampMultiplier(essenceMultiplier, 1, 100);
  const safeBossLootMultiplier = clampMultiplier(bossLootMultiplier, 1, 100);
  const safeEquipmentDropMultiplier = clampMultiplier(equipmentDropMultiplier, 1, 100);
  const safeWhetstoneDropMultiplier = clampMultiplier(whetstoneDropMultiplier, 1, 100);
  const safeDoubleDropChance = Math.max(0, Math.min(1, Number(doubleDropChance) || 0));
  const safeExtraUberLootRolls = Math.max(0, Math.min(5, Math.floor(Number(extraUberLootRolls) || 0)));

  const gold = Math.floor(
    rand(zone.gold[0], zone.gold[1]) *
    bossMultiplier *
    safeGoldMultiplier
  );

  const exp = Math.floor(
    rand(zone.exp[0], zone.exp[1]) *
    bossMultiplier *
    safeExpMultiplier
  );

  const loot = rollBackendLoot({
    zoneId: Number(zoneId),
    isBoss: isBoss === true,
    isUber: isUber === true,
    essenceMultiplier: safeEssenceMultiplier,
    bossLootMultiplier: safeBossLootMultiplier,
    equipmentDropMultiplier: safeEquipmentDropMultiplier,
    whetstoneDropMultiplier: safeWhetstoneDropMultiplier,
    doubleDropChance: safeDoubleDropChance,
    extraUberLootRolls: safeExtraUberLootRolls
  });

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