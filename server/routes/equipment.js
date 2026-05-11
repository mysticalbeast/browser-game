const express = require("express");
const crypto = require("crypto");
const authMiddleware = require("../middleware/auth");

const MAX_ENHANCE_LEVEL = 10;

const ENHANCE_CHANCES = [
  100, // +0 → +1
  90,  // +1 → +2
  80,  // +2 → +3
  70,  // +3 → +4
  60,  // +4 → +5
  50,  // +5 → +6
  40,  // +6 → +7
  30,  // +7 → +8
  20,  // +8 → +9
  10   // +9 → +10
];

const {
  loadPlayerSave,
  savePlayerSave
} = require("../dbSaves");

const router = express.Router();

const VALID_EQUIPMENT_TYPES = [
  "armor",
  "armour",
  "helmet",
  "legs",
  "shoes",
  "necklace",
  "ring",
  "shield"
];

function getEnhanceCost(item) {
  const level = Number(item.enhanceLevel || 0);
  const tier = Number(item.tier || 1);

  return {
    gold: Math.floor(100000 * tier * Math.pow(1.85, level)),
    materialKey: getSalvageMaterialKey(item.rarity),
    materials: Math.ceil((level + 1) * tier * Math.pow(1.35, level)),
    whetstones: Math.ceil(Math.pow(1.25, level)),
    chance: ENHANCE_CHANCES[level] || 0
  };
}

function ensureDepot(save) {
  if (!save.depot || typeof save.depot !== "object") {
    save.depot = {};
  }

  if (!Array.isArray(save.depot.tabs)) {
    save.depot.tabs = [];
  }

  for (let t = 0; t < 5; t++) {
    if (!Array.isArray(save.depot.tabs[t])) {
      save.depot.tabs[t] = Array(40).fill(null);
    }
  }
}

function ensureEquipment(save) {
  if (!save.equipment || typeof save.equipment !== "object") {
    save.equipment = {};
  }

  VALID_EQUIPMENT_TYPES.forEach(type => {
    if (!(type in save.equipment)) {
      save.equipment[type] = null;
    }
  });
}

function findEmptyDepotSlot(save) {
  ensureDepot(save);

  for (let tabIndex = 0; tabIndex < save.depot.tabs.length; tabIndex++) {
    const tab = save.depot.tabs[tabIndex];

    for (let slotIndex = 0; slotIndex < tab.length; slotIndex++) {
      if (!tab[slotIndex]) {
        return {
          tabIndex,
          slotIndex
        };
      }
    }
  }

  return null;
}

function getItemSellValue(item) {
  if (!item) return 0;

  const tier = Number(item.tier || 1);
  const rarityMulti = getRarityValueMultiplier(item.rarity);

  return Math.floor(100 * tier * rarityMulti);
}

function isValidEquipmentItem(item) {
  if (!item || typeof item !== "object") return false;

  if (item.type === "armour") {
    item.type = "armor";
  }

  if (!VALID_EQUIPMENT_TYPES.includes(item.type)) {
    return false;
  }

  if (!item.stats || typeof item.stats !== "object") {
    item.stats = {};
  }

  return true;
}

function ensureBackendItemId(item) {
  if (!item || typeof item !== "object") return item;

  if (!item.id || typeof item.id !== "string") {
    item.id = crypto.randomUUID();
  }

  return item;
}

function getSalvageMaterialKey(rarityKey) {
  if (rarityKey === "common") return "commonMaterial";
  if (rarityKey === "uncommon") return "uncommonMaterial";
  if (rarityKey === "rare") return "rareMaterial";
  if (rarityKey === "legendary") return "legendaryMaterial";
  return "commonMaterial";
}

function getRarityValueMultiplier(rarityKey) {
  if (rarityKey === "common") return 1;
  if (rarityKey === "uncommon") return 2.5;
  if (rarityKey === "rare") return 6;
  if (rarityKey === "legendary") return 20;
  return 1;
}

function getSalvageAmount(item) {
  if (!item) return 0;

  const tier = Number(item.tier || 1);
  const rarityMulti = getRarityValueMultiplier(item.rarity);

  return Math.max(1, Math.floor(tier * rarityMulti));
}

function compactDepotTab(save, tabIndex) {
  const tab = save.depot?.tabs?.[tabIndex];
  if (!Array.isArray(tab)) return;

  const compacted = tab.filter(item => item);
  const emptySlots = Array(tab.length - compacted.length).fill(null);

  save.depot.tabs[tabIndex] = [...compacted, ...emptySlots];
}

router.post("/equip", authMiddleware, async (req, res) => {
  try {
    const tabIndex = Math.floor(Number(req.body?.tabIndex));
    const slotIndex = Math.floor(Number(req.body?.slotIndex));

    if (!Number.isInteger(tabIndex) || !Number.isInteger(slotIndex)) {
      return res.status(400).json({
        success: false,
        message: "Invalid depot slot."
      });
    }

    const save = await loadPlayerSave(req.user.id);

    if (!save) {
      return res.status(400).json({
        success: false,
        message: "No cloud save found."
      });
    }

    ensureDepot(save);
    ensureEquipment(save);

    const tab = save.depot.tabs[tabIndex];

    if (!tab || slotIndex < 0 || slotIndex >= tab.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid depot slot."
      });
    }

    const item = tab[slotIndex];

    if (!isValidEquipmentItem(item)) {
      return res.status(400).json({
        success: false,
        message: "Invalid equipment item."
      });
    }

	ensureBackendItemId(item);

    const slotType = item.type === "armour" ? "armor" : item.type;
    const previous = save.equipment[slotType] || null;

    tab[slotIndex] = null;
    save.equipment[slotType] = item;

    if (previous) {
      const emptySlot = findEmptyDepotSlot(save);

      if (!emptySlot) {
        tab[slotIndex] = item;
        save.equipment[slotType] = previous;

        return res.status(400).json({
          success: false,
          message: "Depot is full."
        });
      }

      save.depot.tabs[emptySlot.tabIndex][emptySlot.slotIndex] = previous;
    }

    save.lastSeenAt = Date.now();

    await savePlayerSave(req.user.id, save);

    res.json({
      success: true,
      equipment: save.equipment,
      depot: save.depot,
      equippedItem: item,
      returnedItem: previous
    });
  } catch (error) {
    console.error("Equip item failed:", error);

    res.status(500).json({
      success: false,
      message: "Equip item failed."
    });
  }
});

router.post("/salvage", authMiddleware, async (req, res) => {
  try {
    const tabIndex = Math.floor(Number(req.body?.tabIndex));
    const slotIndex = Math.floor(Number(req.body?.slotIndex));

    if (!Number.isInteger(tabIndex) || !Number.isInteger(slotIndex)) {
      return res.status(400).json({
        success: false,
        message: "Invalid depot slot."
      });
    }

    const save = await loadPlayerSave(req.user.id);

    if (!save) {
      return res.status(400).json({
        success: false,
        message: "No cloud save found."
      });
    }

    ensureDepot(save);

    if (!save.salvageMaterials || typeof save.salvageMaterials !== "object") {
      save.salvageMaterials = {
        commonMaterial: 0,
        uncommonMaterial: 0,
        rareMaterial: 0,
        legendaryMaterial: 0
      };
    }

    const tab = save.depot.tabs[tabIndex];

    if (!tab || slotIndex < 0 || slotIndex >= tab.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid depot slot."
      });
    }

    const item = tab[slotIndex];

    if (!isValidEquipmentItem(item)) {
      return res.status(400).json({
        success: false,
        message: "Invalid equipment item."
      });
    }

	ensureBackendItemId(item);

    const materialKey = getSalvageMaterialKey(item.rarity);
    const amount = getSalvageAmount(item);

    save.salvageMaterials[materialKey] = Math.floor(
      Number(save.salvageMaterials[materialKey] || 0) + amount
    );

    tab[slotIndex] = null;
    compactDepotTab(save, tabIndex);

    save.lastSeenAt = Date.now();

    await savePlayerSave(req.user.id, save);

    res.json({
      success: true,
      item,
      materialKey,
      amount,
      depot: save.depot,
      salvageMaterials: save.salvageMaterials
    });
  } catch (error) {
    console.error("Salvage item failed:", error);

    res.status(500).json({
      success: false,
      message: "Salvage item failed."
    });
  }
});

router.post("/enhance", authMiddleware, async (req, res) => {
  try {
    const slot = String(req.body?.slot || "");

    if (!VALID_EQUIPMENT_TYPES.includes(slot)) {
      return res.status(400).json({
        success: false,
        message: "Invalid equipment slot."
      });
    }

    const save = await loadPlayerSave(req.user.id);

    if (!save) {
      return res.status(400).json({
        success: false,
        message: "No cloud save found."
      });
    }

    ensureEquipment(save);

    if (!save.materials || typeof save.materials !== "object") {
      save.materials = {};
    }

    if (!save.salvageMaterials || typeof save.salvageMaterials !== "object") {
      save.salvageMaterials = {
        commonMaterial: 0,
        uncommonMaterial: 0,
        rareMaterial: 0,
        legendaryMaterial: 0
      };
    }

    const item = save.equipment[slot];

    if (!isValidEquipmentItem(item)) {
      return res.status(400).json({
        success: false,
        message: "No valid item equipped in this slot."
      });
    }

	ensureBackendItemId(item);

    const level = Number(item.enhanceLevel || 0);

    if (level >= MAX_ENHANCE_LEVEL) {
      return res.status(400).json({
        success: false,
        message: "Item is already fully enhanced."
      });
    }

    const cost = getEnhanceCost(item);

    const ownedGold = Number(save.gold || 0);
    const ownedMaterial = Number(save.salvageMaterials[cost.materialKey] || 0);
    const ownedWhetstones = Number(save.materials.whetstones || 0);

    const missing = [];

    if (ownedGold < cost.gold) missing.push("gold");
    if (ownedMaterial < cost.materials) missing.push("materials");
    if (ownedWhetstones < cost.whetstones) missing.push("whetstones");

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Not enough ${missing.join(", ")}.`
      });
    }

    save.gold = Math.floor(ownedGold - cost.gold);

    save.salvageMaterials[cost.materialKey] = Math.floor(
      ownedMaterial - cost.materials
    );

    save.materials.whetstones = Math.floor(
      ownedWhetstones - cost.whetstones
    );

    const roll = Math.random() * 100;
    const success = roll <= cost.chance;

    if (success) {
      item.enhanceLevel = level + 1;
    }

    save.lastSeenAt = Date.now();

    await savePlayerSave(req.user.id, save);

    res.json({
      success: true,
      enhanced: success,
      slot,
      item,
      cost,
      roll,
      equipment: save.equipment,
      materials: save.materials,
      salvageMaterials: save.salvageMaterials,
      gold: save.gold,
      message: success
        ? `Enhanced ${item.name} to +${item.enhanceLevel}`
        : `Enhancement failed. ${item.name} stayed +${level}`
    });
  } catch (error) {
    console.error("Enhance item failed:", error);

    res.status(500).json({
      success: false,
      message: "Enhance item failed."
    });
  }
});

router.post("/sell", authMiddleware, async (req, res) => {
  try {
    const tabIndex = Math.floor(Number(req.body?.tabIndex));
    const slotIndex = Math.floor(Number(req.body?.slotIndex));

    if (!Number.isInteger(tabIndex) || !Number.isInteger(slotIndex)) {
      return res.status(400).json({
        success: false,
        message: "Invalid depot slot."
      });
    }

    const save = await loadPlayerSave(req.user.id);

    if (!save) {
      return res.status(400).json({
        success: false,
        message: "No cloud save found."
      });
    }

    ensureDepot(save);

    const tab = save.depot.tabs[tabIndex];

    if (!tab || slotIndex < 0 || slotIndex >= tab.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid depot slot."
      });
    }

    const item = tab[slotIndex];

    if (!isValidEquipmentItem(item)) {
      return res.status(400).json({
        success: false,
        message: "Invalid equipment item."
      });
    }

	ensureBackendItemId(item);

    const value = getItemSellValue(item);

    save.gold = Math.floor(Number(save.gold || 0) + value);

    if (!save.stats || typeof save.stats !== "object") {
      save.stats = {};
    }

    save.stats.goldEarned = Math.floor(
      Number(save.stats.goldEarned || 0) + value
    );

    tab[slotIndex] = null;
    compactDepotTab(save, tabIndex);

    save.lastSeenAt = Date.now();

    await savePlayerSave(req.user.id, save);

    res.json({
      success: true,
      item,
      value,
      depot: save.depot,
      gold: save.gold,
      stats: save.stats
    });
  } catch (error) {
    console.error("Sell item failed:", error);

    res.status(500).json({
      success: false,
      message: "Sell item failed."
    });
  }
});

module.exports = router;