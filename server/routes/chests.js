const express = require("express");
const authMiddleware = require("../middleware/auth");

const {
  loadPlayerSave,
  savePlayerSave
} = require("../dbSaves");

const {
  applyBackendExpGain
} = require("../backendProgression");

const router = express.Router();

const ZONE_REWARDS = {
  1: { gold: [2, 5], exp: [4, 8], levelReq: 1 },
  2: { gold: [6, 12], exp: [10, 18], levelReq: 5 },
  3: { gold: [12, 22], exp: [18, 32], levelReq: 10 },
  4: { gold: [25, 45], exp: [40, 70], levelReq: 18 },
  5: { gold: [45, 80], exp: [75, 120], levelReq: 26 },
  6: { gold: [75, 130], exp: [120, 190], levelReq: 36 },
  7: { gold: [100, 170], exp: [165, 260], levelReq: 48 },
  8: { gold: [135, 230], exp: [220, 340], levelReq: 60 },
  9: { gold: [190, 320], exp: [310, 480], levelReq: 75 },
  10: { gold: [270, 450], exp: [430, 680], levelReq: 90 },
  11: { gold: [380, 620], exp: [600, 920], levelReq: 110 },
  12: { gold: [520, 850], exp: [820, 1250], levelReq: 130 },
  13: { gold: [690, 1120], exp: [1100, 1650], levelReq: 155 },
  14: { gold: [900, 1450], exp: [1450, 2150], levelReq: 180 },
  15: { gold: [1180, 1900], exp: [1850, 2800], levelReq: 210 },
  16: { gold: [1550, 2500], exp: [2400, 3600], levelReq: 240 },
  17: { gold: [2050, 3300], exp: [3100, 4600], levelReq: 275 },
  18: { gold: [2700, 4300], exp: [4000, 6000], levelReq: 310 },
  19: { gold: [3500, 5600], exp: [5200, 7800], levelReq: 350 },
  20: { gold: [4500, 7200], exp: [6800, 10000], levelReq: 390 },
  21: { gold: [5900, 9300], exp: [8600, 12800], levelReq: 435 },
  22: { gold: [7600, 12000], exp: [11000, 16500], levelReq: 480 },
  23: { gold: [9700, 15300], exp: [14000, 21000], levelReq: 530 },
  24: { gold: [12500, 19500], exp: [18000, 27000], levelReq: 580 },
  25: { gold: [16000, 25000], exp: [23000, 34500], levelReq: 635 },
  26: { gold: [20500, 32000], exp: [29500, 44000], levelReq: 690 },
  27: { gold: [26500, 41000], exp: [38000, 57000], levelReq: 750 },
  28: { gold: [34000, 53000], exp: [49000, 73000], levelReq: 810 },
  29: { gold: [44000, 68000], exp: [63000, 94000], levelReq: 875 },
  30: { gold: [57000, 88000], exp: [82000, 123000], levelReq: 940 }
};

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function ensureObject(parent, key) {
  if (!parent[key] || typeof parent[key] !== "object") {
    parent[key] = {};
  }

  return parent[key];
}

function getInventoryAmount(save, key) {
  return Math.floor(Number(save?.inventory?.[key] || 0));
}

function addInventoryItem(save, key, amount) {
  const inventory = ensureObject(save, "inventory");

  inventory[key] = Math.max(
    0,
    Math.floor(Number(inventory[key] || 0) + Number(amount || 0))
  );
}

function removeInventoryItem(save, key, amount) {
  const inventory = ensureObject(save, "inventory");

  inventory[key] = Math.max(
    0,
    Math.floor(Number(inventory[key] || 0) - Number(amount || 0))
  );
}

function addMaterial(save, key, amount) {
  const materials = ensureObject(save, "materials");

  materials[key] = Math.max(
    0,
    Math.floor(Number(materials[key] || 0) + Number(amount || 0))
  );
}

function getRewardZone(save) {
  const highestZone = Number(save.highestZone || save.zoneId || 1);
  const zone = ZONE_REWARDS[highestZone];

  if (zone) return zone;

  return Object.values(ZONE_REWARDS)
    .filter(item => Number(save.level || 1) >= item.levelReq)
    .sort((a, b) => b.levelReq - a.levelReq)[0] || ZONE_REWARDS[1];
}

function applyGoldAndExp(save, goldReward, expReward) {
  save.gold = Math.floor(Number(save.gold || 0) + goldReward);

  const stats = ensureObject(save, "stats");

  stats.goldEarned = Math.floor(
    Number(stats.goldEarned || 0) + goldReward
  );

  stats.expEarned = Math.floor(
    Number(stats.expEarned || 0) + expReward
  );

  applyBackendExpGain(save, expReward);
}

function addSkinShardsBackend(save, amount) {
  const skins = ensureObject(save, "skins");

  skins.shards = Math.floor(
    Number(skins.shards || 0) + Number(amount || 0)
  );
}

function openTreasureChestBackend(save) {
  if (getInventoryAmount(save, "treasureChest") <= 0) {
    return {
      ok: false,
      message: "You do not have any Treasure Chests."
    };
  }

  if (getInventoryAmount(save, "chestKey") <= 0) {
    return {
      ok: false,
      message: "You need a Chest Key to open this Treasure Chest."
    };
  }

  removeInventoryItem(save, "treasureChest", 1);
  removeInventoryItem(save, "chestKey", 1);

  const zone = getRewardZone(save);

  const goldReward = Math.floor(
    rand(zone.gold[0], zone.gold[1]) * rand(10, 30)
  );

  const expReward = Math.floor(
    rand(zone.exp[0], zone.exp[1]) * rand(10, 30)
  );

  applyGoldAndExp(save, goldReward, expReward);

  const rewardsText = [
    `+${goldReward} gold`,
    `+${expReward} EXP`
  ];

  const rewards = {
    gold: goldReward,
    exp: expReward,
    materials: {},
    inventory: {},
    rewards: {},
    skins: {}
  };

  if (Math.random() < 0.45) {
    const roll = Math.random();

    let essenceKey = "greenEssence";
    let essenceName = "Green Essence";

    if (roll >= 0.99) {
      essenceKey = "redEssence";
      essenceName = "Red Essence";
    } else if (roll >= 0.95) {
      essenceKey = "yellowEssence";
      essenceName = "Yellow Essence";
    } else if (roll >= 0.70) {
      essenceKey = "blueEssence";
      essenceName = "Blue Essence";
    }

    const essenceAmount = rand(1, 3);

    addMaterial(save, essenceKey, essenceAmount);
    rewards.materials[essenceKey] = essenceAmount;
    rewardsText.push(`+${essenceAmount} ${essenceName}`);
  }

  if (Math.random() < 0.12) {
    const saveRewards = ensureObject(save, "rewards");

    saveRewards.slotCoins = Math.floor(
      Number(saveRewards.slotCoins || 0) + 1
    );

    rewards.rewards.slotCoins = 1;
    rewardsText.push("+1 Silver Token");
  }

  if (Math.random() < 0.05) {
    const shardAmount = rand(3, 8);

    addSkinShardsBackend(save, shardAmount);
    rewards.skins.shards = shardAmount;
    rewardsText.push(`+${shardAmount} Skin Shards`);
  }

  if (Math.random() < 0.10) {
    addInventoryItem(save, "chestKey", 1);
    rewards.inventory.chestKey = 1;
    rewardsText.push("+1 Chest Key refunded");
  }

  if (Math.random() < 0.03) {
    addInventoryItem(save, "treasureChest", 1);
    rewards.inventory.treasureChest = 1;
    rewardsText.push("+1 bonus Treasure Chest");
  }

  return {
    ok: true,
    rewards,
    rewardsText
  };
}

function openGoldenTreasureChestBackend(save) {
  if (getInventoryAmount(save, "goldenTreasureChest") <= 0) {
    return {
      ok: false,
      message: "You do not have any Golden Treasure Chests."
    };
  }

  if (getInventoryAmount(save, "chestKey") <= 0) {
    return {
      ok: false,
      message: "You need a Chest Key to open this Golden Treasure Chest."
    };
  }

  removeInventoryItem(save, "goldenTreasureChest", 1);
  removeInventoryItem(save, "chestKey", 1);

  const zone = getRewardZone(save);

  const goldReward = Math.floor(
    rand(zone.gold[0], zone.gold[1]) * rand(75, 150)
  );

  const expReward = Math.floor(
    rand(zone.exp[0], zone.exp[1]) * rand(75, 150)
  );

  applyGoldAndExp(save, goldReward, expReward);

  const rewardsText = [
    `+${goldReward} gold`,
    `+${expReward} EXP`
  ];

  const rewards = {
    gold: goldReward,
    exp: expReward,
    materials: {},
    inventory: {},
    rewards: {},
    skins: {}
  };

  const greenAmount = rand(5, 12);
  const blueAmount = rand(3, 8);
  const yellowAmount = rand(1, 4);
  const redAmount = Math.random() < 0.35 ? rand(1, 2) : 0;

  addMaterial(save, "greenEssence", greenAmount);
  addMaterial(save, "blueEssence", blueAmount);
  addMaterial(save, "yellowEssence", yellowAmount);

  rewards.materials.greenEssence = greenAmount;
  rewards.materials.blueEssence = blueAmount;
  rewards.materials.yellowEssence = yellowAmount;

  rewardsText.push(`+${greenAmount} Green Essence`);
  rewardsText.push(`+${blueAmount} Blue Essence`);
  rewardsText.push(`+${yellowAmount} Yellow Essence`);

  if (redAmount > 0) {
    addMaterial(save, "redEssence", redAmount);
    rewards.materials.redEssence = redAmount;
    rewardsText.push(`+${redAmount} Red Essence`);
  }

  const silverTokens = rand(2, 5);
  const saveRewards = ensureObject(save, "rewards");

  saveRewards.slotCoins = Math.floor(
    Number(saveRewards.slotCoins || 0) + silverTokens
  );

  rewards.rewards.slotCoins = silverTokens;
  rewardsText.push(`+${silverTokens} Silver Tokens`);

  const skinShards = rand(10, 25);

  addSkinShardsBackend(save, skinShards);
  rewards.skins.shards = skinShards;
  rewardsText.push(`+${skinShards} Skin Shards`);

  if (Math.random() < 0.35) {
    addInventoryItem(save, "chestKey", 1);
    rewards.inventory.chestKey = 1;
    rewardsText.push("+1 Chest Key refunded");
  }

  if (Math.random() < 0.10) {
    addInventoryItem(save, "treasureChest", 1);
    rewards.inventory.treasureChest = 1;
    rewardsText.push("+1 bonus Treasure Chest");
  }

  if (Math.random() < 0.02) {
    addInventoryItem(save, "goldenTreasureChest", 1);
    rewards.inventory.goldenTreasureChest = 1;
    rewardsText.push("+1 bonus Golden Treasure Chest");
  }

  if (Math.random() < 0.001) {
    addInventoryItem(save, "skinAscender", 1);
    rewards.inventory.skinAscender = 1;
    rewardsText.push("+1 Skin Ascender");
  }

  return {
    ok: true,
    rewards,
    rewardsText
  };
}

router.post("/open", authMiddleware, async (req, res) => {
  try {
    const type = String(req.body?.type || "");

    if (!["treasureChest", "goldenTreasureChest"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chest type."
      });
    }

    const save = await loadPlayerSave(req.user.id);

    if (!save) {
      return res.status(400).json({
        success: false,
        message: "No cloud save found."
      });
    }

    if (!save.inventory || typeof save.inventory !== "object") {
      save.inventory = {};
    }

    const result =
      type === "goldenTreasureChest"
        ? openGoldenTreasureChestBackend(save)
        : openTreasureChestBackend(save);

    if (!result.ok) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    save.lastSeenAt = Date.now();

    await savePlayerSave(req.user.id, save);

    res.json({
      success: true,
      rewards: result.rewards,
      rewardsText: result.rewardsText,
      save: {
        gold: save.gold,
        exp: save.exp,
        level: save.level,
        skillPoints: save.skillPoints,
        inventory: save.inventory,
        materials: save.materials,
        rewards: save.rewards,
        skins: save.skins
      }
    });
  } catch (error) {
    console.error("Open chest failed:", error);

    res.status(500).json({
      success: false,
      message: "Open chest failed."
    });
  }
});

module.exports = router;