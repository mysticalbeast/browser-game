function ensureDepot(save) {
  if (!save.depot || typeof save.depot !== "object") {
    save.depot = {};
  }

  if (!Array.isArray(save.depot.tabs)) {
    save.depot.tabs = [];
  }

  for (let t = 0; t < 3; t++) {
    if (!Array.isArray(save.depot.tabs[t])) {
      save.depot.tabs[t] = Array(40).fill(null);
    }
  }
}

function addItemToBackendDepot(save, item) {
  if (!item || typeof item !== "object") return false;

  ensureDepot(save);

  for (let t = 0; t < save.depot.tabs.length; t++) {
    const tab = save.depot.tabs[t];

    for (let i = 0; i < tab.length; i++) {
      if (!tab[i]) {
        tab[i] = item;
        return true;
      }
    }
  }

  return false;
}

function migrateEquipmentInventoryToDepot(save) {
  if (!save || typeof save !== "object") return 0;

  if (!Array.isArray(save.equipmentInventory) || save.equipmentInventory.length <= 0) {
    return 0;
  }

  ensureDepot(save);

  let migrated = 0;

  save.equipmentInventory.forEach(item => {
    if (addItemToBackendDepot(save, item)) {
      migrated++;
    }
  });

  save.equipmentInventory = [];

  return migrated;
}

module.exports = {
  ensureDepot,
  addItemToBackendDepot,
  migrateEquipmentInventoryToDepot
};