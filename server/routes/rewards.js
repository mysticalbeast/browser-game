const express = require("express");
const authMiddleware = require("../middleware/auth");

const {
  loadPlayerSave,
  savePlayerSave
} = require("../dbSaves");

const router = express.Router();

const SLOT_COIN_INTERVAL_MS = 60 * 60 * 1000;

const SLOT_REWARD_POOL = [
  {
    key: "goldSmall",
    type: "gold",
    amount: 500,
    weight: 100
  },
  {
    key: "goldBig",
    type: "gold",
    amount: 2500,
    weight: 35
  },
  {
    key: "expSmall",
    type: "exp",
    amount: 300,
    weight: 90
  },
  {
    key: "expBig",
    type: "exp",
    amount: 1500,
    weight: 30
  },
  {
    key: "greenEssence",
    type: "material",
    materialKey: "greenEssence",
    amount: 50,
    weight: 75
  },
  {
    key: "blueEssence",
    type: "material",
    materialKey: "blueEssence",
    amount: 35,
    weight: 55
  },
  {
    key: "yellowEssence",
    type: "material",
    materialKey: "yellowEssence",
    amount: 20,
    weight: 35
  },
  {
    key: "redEssence",
    type: "material",
    materialKey: "redEssence",
    amount: 10,
    weight: 18
  },
  {
    key: "whetstones",
    type: "material",
    materialKey: "whetstones",
    amount: 5,
    weight: 15
  },
  {
    key: "fish",
    type: "fish",
    amount: 250,
    weight: 45
  },
  {
    key: "stars",
    type: "stars",
    amount: 150,
    weight: 35
  },
  {
    key: "slotCoin",
    type: "slotCoin",
    amount: 1,
    weight: 22
  },
  {
    key: "skillPoint",
    type: "skillPoint",
    amount: 1,
    weight: 8
  },
  {
    key: "skinShard",
    type: "skinShard",
    amount: 25,
    weight: 18
  },
  {
    key: "jackpot",
    type: "jackpot",
    weight: 4
  }
];

function pickWeightedSlotReward() {
  const total = SLOT_REWARD_POOL.reduce(
    (sum, reward) => sum + reward.weight,
    0
  );

  let roll = Math.random() * total;

  for (const reward of SLOT_REWARD_POOL) {
    roll -= reward.weight;

    if (roll <= 0) {
      return { ...reward };
    }
  }

  return { ...SLOT_REWARD_POOL[0] };
}

function ensureRewards(save) {
  if (!save.rewards || typeof save.rewards !== "object") {
    save.rewards = {};
  }

  if (!Array.isArray(save.rewards.slotOptions)) {
    save.rewards.slotOptions = [];
  }

  if (typeof save.rewards.slotCoins !== "number") {
    save.rewards.slotCoins = 0;
  }

  if (!save.rewards.lastCoinAt) {
    save.rewards.lastCoinAt = Date.now();
  }
}

function updateRewardCoins(save) {
  ensureRewards(save);

  const now = Date.now();

  const elapsed = now - save.rewards.lastCoinAt;

  const coinsToAdd = Math.floor(
    elapsed / SLOT_COIN_INTERVAL_MS
  );

  if (coinsToAdd > 0) {
    save.rewards.slotCoins += coinsToAdd;
    save.rewards.lastCoinAt +=
      coinsToAdd * SLOT_COIN_INTERVAL_MS;
  }
}

router.post("/spin", authMiddleware, async (req, res) => {
  try {
    const save = await loadPlayerSave(req.user.id);

    if (!save) {
      return res.status(400).json({
        success: false,
        message: "No cloud save found."
      });
    }

    ensureRewards(save);
    updateRewardCoins(save);

    if (save.rewards.slotCoins <= 0) {
      return res.status(400).json({
        success: false,
        message: "No Silver Tokens."
      });
    }

    if (save.rewards.slotOptions.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Claim current rewards first."
      });
    }

    save.rewards.slotCoins--;

    save.rewards.slotOptions = [
      pickWeightedSlotReward(),
      pickWeightedSlotReward(),
      pickWeightedSlotReward()
    ];

    save.lastSeenAt = Date.now();

    await savePlayerSave(req.user.id, save);

    res.json({
      success: true,
      rewards: save.rewards
    });
  } catch (error) {
    console.error("Reward spin failed:", error);

    res.status(500).json({
      success: false,
      message: "Reward spin failed."
    });
  }
});

router.post("/claim", authMiddleware, async (req, res) => {
  try {
    const index = Math.floor(Number(req.body?.index));

    const save = await loadPlayerSave(req.user.id);

    if (!save) {
      return res.status(400).json({
        success: false,
        message: "No cloud save found."
      });
    }

    ensureRewards(save);

    const reward = save.rewards.slotOptions[index];

    if (!reward) {
      return res.status(400).json({
        success: false,
        message: "Invalid reward."
      });
    }

    if (!save.materials) {
      save.materials = {};
    }

    if (!save.stats) {
      save.stats = {};
    }

    if (!save.skins) {
      save.skins = {};
    }

    const level = Math.max(1, Number(save.level || 1));

    if (reward.type === "gold") {
      const amount = Math.floor(reward.amount * level);

      save.gold = Math.floor(
        Number(save.gold || 0) + amount
      );

      save.stats.goldEarned = Math.floor(
        Number(save.stats.goldEarned || 0) + amount
      );
    }

    if (reward.type === "exp") {
      const amount = Math.floor(reward.amount * level);

      save.exp = Math.floor(
        Number(save.exp || 0) + amount
      );

      save.stats.expEarned = Math.floor(
        Number(save.stats.expEarned || 0) + amount
      );
    }

    if (reward.type === "material") {
      save.materials[reward.materialKey] =
        Math.floor(
          Number(save.materials[reward.materialKey] || 0) +
          reward.amount
        );
    }

    if (reward.type === "fish") {
      save.fishing = save.fishing || {};

      save.fishing.fish = Math.floor(
        Number(save.fishing.fish || 0) +
        reward.amount
      );
    }

    if (reward.type === "stars") {
      save.stars = Math.floor(
        Number(save.stars || 0) +
        reward.amount
      );
    }

    if (reward.type === "slotCoin") {
      save.rewards.slotCoins += reward.amount;
    }

    if (reward.type === "skillPoint") {
      save.skillPoints = Math.floor(
        Number(save.skillPoints || 0) +
        reward.amount
      );
    }

    if (reward.type === "skinShard") {
      save.skins.shards = Math.floor(
        Number(save.skins.shards || 0) +
        reward.amount
      );
    }

    if (reward.type === "jackpot") {
      const goldAmount = Math.floor(10000 * level);
      const expAmount = Math.floor(5000 * level);

      save.gold += goldAmount;
      save.exp += expAmount;
      save.skillPoints += 2;

      save.materials.redEssence =
        Math.floor(
          Number(save.materials.redEssence || 0) + 10
        );

      save.skins.shards =
        Math.floor(
          Number(save.skins.shards || 0) + 100
        );
    }

    save.rewards.slotOptions = [];

    save.lastSeenAt = Date.now();

    await savePlayerSave(req.user.id, save);

    res.json({
      success: true,
      reward,
      save
    });
  } catch (error) {
    console.error("Reward claim failed:", error);

    res.status(500).json({
      success: false,
      message: "Reward claim failed."
    });
  }
});

module.exports = router;