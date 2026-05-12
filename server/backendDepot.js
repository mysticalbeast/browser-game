const DEPOT_TAB_COUNT = 3;
const DEPOT_TAB_SIZE = 40;

function createEmptyDepot() {
  return {
    activeTab: 0,
    tabs: Array.from(
      { length: DEPOT_TAB_COUNT },
      () => Array(DEPOT_TAB_SIZE).fill(null)
    )
  };
}

const {
  ensureDepot
} = require("../backendDepot");

function addItemToBackendDepot(save, item) {
  if (!item || typeof item !== "object") return false;

  ensureDepot(save);

  for (let t = 0; t < DEPOT_TAB_COUNT; t++) {
    const tab = save.depot.tabs[t];

    for (let i = 0; i < DEPOT_TAB_SIZE; i++) {
      if (!tab[i]) {
        tab[i] = item;
        return true;
      }
    }
  }

  if (!Array.isArray(save.equipmentInventory)) {
    save.equipmentInventory = [];
  }

  save.equipmentInventory.push(item);
  return false;
}

function migrateEquipmentInventoryToDepot(save) {
  if (!save || typeof save !== "object") return 0;

  ensureDepot(save);

  if (!Array.isArray(save.equipmentInventory) || save.equipmentInventory.length <= 0) {
    return 0;
  }

  const remaining = [];
  let migrated = 0;

  save.equipmentInventory.forEach(item => {
    const inserted = addItemToBackendDepot(save, item);

    if (inserted) {
      migrated++;
    } else {
      remaining.push(item);
    }
  });

  save.equipmentInventory = remaining;

  return migrated;
}

module.exports = {
  DEPOT_TAB_COUNT,
  DEPOT_TAB_SIZE,
  createEmptyDepot,
  ensureDepot,
  addItemToBackendDepot,
  migrateEquipmentInventoryToDepot
};