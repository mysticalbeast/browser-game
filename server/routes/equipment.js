const express = require("express");
const authMiddleware = require("../middleware/auth");

const {
  loadPlayerSave,
  savePlayerSave
} = require("../dbSaves");

const router = express.Router();

const VALID_EQUIPMENT_TYPES = [
  "armor",
  "helmet",
  "legs",
  "shoes",
  "necklace",
  "ring",
  "shield"
];

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

function isValidEquipmentItem(item) {
  if (!item || typeof item !== "object") return false;
  if (!VALID_EQUIPMENT_TYPES.includes(item.type)) return false;
  if (!item.id || typeof item.id !== "string") return false;
  if (!item.stats || typeof item.stats !== "object") return false;

  return true;
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

    const slotType = item.type;
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

module.exports = router;