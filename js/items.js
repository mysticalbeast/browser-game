const INVENTORY_ITEMS = {
  treasureChest: {
    key: "treasureChest",
    name: "Treasure Chest",
    icon: "📦",
    image: "assets/items/treasure_chest.gif",
    desc: "A locked chest containing random rewards."
  },

  chestKey: {
    key: "chestKey",
    name: "Chest Key",
    icon: "🗝️",
    image: "assets/items/chest_key.gif",
    desc: "Used to open Treasure Chests."
  },
  goldenTreasureChest: {
  key: "goldenTreasureChest",
  name: "Golden Treasure Chest",
  icon: "🟨",
  image: "assets/items/golden_treasure_chest.gif",
  desc: "An extremely valuable treasure chest."
},
skinAscender: {
  key: "skinAscender",
  name: "Skin Ascender",
  icon: "🔮",
  image: "assets/items/skin_ascender.gif",
  desc: "Used to ascend a max-level summon skin."
}
};

function initializeInventory() {
  if (!state.inventory) {
    state.inventory = {};
  }

  Object.keys(INVENTORY_ITEMS).forEach(key => {
    if (typeof state.inventory[key] !== "number") {
      state.inventory[key] = 0;
    }
  });
}

function getInventoryAmount(key) {
  initializeInventory();
  return state.inventory[key] || 0;
}

function addInventoryItem(key, amount = 1) {
  initializeInventory();

  if (!INVENTORY_ITEMS[key]) return;

  const gained = Math.max(0, Math.floor(amount));
  if (gained <= 0) return;

  state.inventory[key] = (state.inventory[key] || 0) + gained;

  showFilterNotification(
    "system",
    `${INVENTORY_ITEMS[key].icon} +${fmt(gained)} ${INVENTORY_ITEMS[key].name}.`
  );

  renderBackpack();
  saveGame();
}

function renderBackpack() {
  const backpackEl = document.getElementById("backpack");
  if (!backpackEl) return;

  initializeInventory();

  const BACKPACK_SLOT_COUNT = 24;

  const visibleItems = Object.values(INVENTORY_ITEMS)
    .filter(item => getInventoryAmount(item.key) > 0);

  const slots = [];

  visibleItems.forEach(item => {
    const amount = getInventoryAmount(item.key);

    slots.push(`
      <button
        class="backpackSlot"
        title="${item.name}: ${item.desc}"
        onclick="useInventoryItem('${item.key}')"
      >
        ${
          item.image
            ? `
              <img
                class="backpackItemImage"
                src="${item.image}"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
              >
              <div class="backpackIcon" style="display:none;">${item.icon}</div>
            `
            : `
              <div class="backpackIcon">${item.icon}</div>
            `
        }

        <div class="backpackAmount">x${fmt(amount)}</div>
      </button>
    `);
  });

  while (slots.length < BACKPACK_SLOT_COUNT) {
    slots.push(`
      <div class="backpackSlot empty"></div>
    `);
  }

  backpackEl.innerHTML = `
    <div class="backpackGrid">
      ${slots.join("")}
    </div>
  `;
}

function openTreasureChest() {
  initializeInventory();

  if (getInventoryAmount("treasureChest") <= 0) {
    showFilterNotification("system", "📦 You do not have any Treasure Chests.");
    return;
  }

  if (getInventoryAmount("chestKey") <= 0) {
    showFilterNotification("system", "🗝️ You need a Chest Key to open this Treasure Chest.");
    return;
  }

  removeInventoryItem("treasureChest", 1);
  removeInventoryItem("chestKey", 1);

  const zone =
    typeof getHighestUnlockedRewardZone === "function"
      ? getHighestUnlockedRewardZone()
      : currentZone();

  const goldReward = Math.floor(
    rand(zone.gold[0], zone.gold[1]) * rand(10, 30)
  );

  const expReward = Math.floor(
    rand(zone.exp[0], zone.exp[1]) * rand(10, 30)
  );

  state.gold = (state.gold || 0) + goldReward;
  state.exp = (state.exp || 0) + expReward;

  if (!state.stats) state.stats = {};
  state.stats.goldEarned = (state.stats.goldEarned || 0) + goldReward;
  state.stats.expEarned = (state.stats.expEarned || 0) + expReward;

  const rewardsText = [
    `+${fmt(goldReward)} gold`,
    `+${fmt(expReward)} EXP`
  ];

  if (!state.materials) state.materials = {};

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

    state.materials[essenceKey] =
      (state.materials[essenceKey] || 0) + essenceAmount;

    rewardsText.push(`+${essenceAmount} ${essenceName}`);
  }

  if (Math.random() < 0.12) {
    if (!state.rewards) state.rewards = {};
    state.rewards.slotCoins = (state.rewards.slotCoins || 0) + 1;

    rewardsText.push("+1 Silver Token");
  }

  if (Math.random() < 0.05) {
    const shardAmount = rand(3, 8);

    if (typeof addSkinShards === "function") {
      addSkinShards(shardAmount);
    } else {
      if (!state.skins) state.skins = {};
      state.skins.shards = (state.skins.shards || 0) + shardAmount;
    }

    rewardsText.push(`+${shardAmount} Skin Shards`);
  }

  if (Math.random() < 0.10) {
    addInventoryItem("chestKey", 1);
    rewardsText.push("+1 Chest Key refunded");
  }

  if (Math.random() < 0.03) {
    addInventoryItem("treasureChest", 1);
    rewardsText.push("+1 bonus Treasure Chest");
  }

  showFilterNotification(
    "system",
    `📦 Treasure Chest opened: ${rewardsText.join(", ")}.`
  );

  checkLevelUp();

  renderBackpack?.();
  updateUI();
  saveGame();
}

function openGoldenTreasureChest() {
  initializeInventory();

  if (getInventoryAmount("goldenTreasureChest") <= 0) {
    showFilterNotification("system", "✨ You do not have any Golden Treasure Chests.");
    return;
  }

  if (getInventoryAmount("chestKey") <= 0) {
    showFilterNotification(
      "system",
      "🗝️ You need a Chest Key to open this Golden Treasure Chest."
    );
    return;
  }

  removeInventoryItem("goldenTreasureChest", 1);
  removeInventoryItem("chestKey", 1);

  const zone =
    typeof getHighestUnlockedRewardZone === "function"
      ? getHighestUnlockedRewardZone()
      : currentZone();

  const goldReward = Math.floor(
    rand(zone.gold[0], zone.gold[1]) * rand(75, 150)
  );

  const expReward = Math.floor(
    rand(zone.exp[0], zone.exp[1]) * rand(75, 150)
  );

  state.gold = (state.gold || 0) + goldReward;
  state.exp = (state.exp || 0) + expReward;

  if (!state.stats) state.stats = {};
  state.stats.goldEarned = (state.stats.goldEarned || 0) + goldReward;
  state.stats.expEarned = (state.stats.expEarned || 0) + expReward;

  if (!state.materials) state.materials = {};
  if (!state.rewards) state.rewards = {};

  const rewardsText = [
    `+${fmt(goldReward)} gold`,
    `+${fmt(expReward)} EXP`
  ];

  const greenAmount = rand(5, 12);
  const blueAmount = rand(3, 8);
  const yellowAmount = rand(1, 4);
  const redAmount = Math.random() < 0.35 ? rand(1, 2) : 0;

  state.materials.greenEssence =
    (state.materials.greenEssence || 0) + greenAmount;

  state.materials.blueEssence =
    (state.materials.blueEssence || 0) + blueAmount;

  state.materials.yellowEssence =
    (state.materials.yellowEssence || 0) + yellowAmount;

  if (redAmount > 0) {
    state.materials.redEssence =
      (state.materials.redEssence || 0) + redAmount;
  }

  rewardsText.push(`+${greenAmount} Green Essence`);
  rewardsText.push(`+${blueAmount} Blue Essence`);
  rewardsText.push(`+${yellowAmount} Yellow Essence`);

  if (redAmount > 0) {
    rewardsText.push(`+${redAmount} Red Essence`);
  }

  const silverTokens = rand(2, 5);
  state.rewards.slotCoins = (state.rewards.slotCoins || 0) + silverTokens;
  rewardsText.push(`+${silverTokens} Silver Tokens`);

  const skinShards = rand(10, 25);

  if (typeof addSkinShards === "function") {
    addSkinShards(skinShards);
  } else {
    if (!state.skins) state.skins = {};
    state.skins.shards = (state.skins.shards || 0) + skinShards;
  }

  rewardsText.push(`+${skinShards} Skin Shards`);

  if (Math.random() < 0.35) {
    addInventoryItem("chestKey", 1);
    rewardsText.push("+1 Chest Key refunded");
  }

  if (Math.random() < 0.10) {
    addInventoryItem("treasureChest", 1);
    rewardsText.push("+1 bonus Treasure Chest");
  }

  if (Math.random() < 0.02) {
    addInventoryItem("goldenTreasureChest", 1);
    rewardsText.push("+1 bonus Golden Treasure Chest");
  }
  
  if (Math.random() < 0.001) {
  addInventoryItem("skinAscender", 1);
  rewardsText.push("+1 Skin Ascender");
}

  showFilterNotification(
    "system",
    `✨ Golden Treasure Chest opened: ${rewardsText.join(", ")}.`
  );

  checkLevelUp();

  renderBackpack?.();
  updateUI();
  saveGame();
}

function useInventoryItem(key) {
  initializeInventory();

  const item = INVENTORY_ITEMS[key];
  if (!item) return;

  if (key === "treasureChest") {
    openTreasureChest();
    return;
  }

  if (key === "chestKey") {
    showFilterNotification(
      "system",
      "🗝️ Chest Keys are used automatically when opening Treasure Chests."
    );
    return;
  }
  
  if (key === "goldenTreasureChest") {
  openGoldenTreasureChest();
  return;
}

  showFilterNotification(
    "system",
    `${item.icon} ${item.name} cannot be used yet.`
  );
}

function removeInventoryItem(key, amount = 1) {
  initializeInventory();

  if (!INVENTORY_ITEMS[key]) return false;

  const removed = Math.max(0, Math.floor(amount));
  if (removed <= 0) return false;

  if ((state.inventory[key] || 0) < removed) return false;

  state.inventory[key] -= removed;

  renderBackpack();
  saveGame();

  return true;
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
  armor: [
    "Jacket",
    "Doublet",
    "Studded Armor",
    "Chain Armor",
    "Brass Armor",
    "Gnomish Cuirass",
    "Elven Mail",
    "Dwarven Armor",
    "Albino Plate",
    "Knight Armor"
  ],

  helmet: [
    "Leather Helmet",
    "Studded Helmet",
    "Chain Helmet",
    "Brass Helmet",
    "Legion Helmet",
    "Iron Helmet",
    "Dark Helmet",
    "Dwarven Helmet",
    "Steel Helmet",
    "Devil Helmet"
  ],

  legs: [
    "Leather Legs",
    "Studded Legs",
    "Chain Legs",
    "Brass Legs",
    "Alloy Legs",
    "Wereboar Loincloth",
    "Dwarven Legs",
    "Plate Legs",
    "Grasshopper Legs",
    "Blue Legs"
  ],

  shoes: [
    "Boots of Haste",
    "Coconut Shoes",
    "Sandals",
    "Crocodile Boots",
    "Metal Spats",
    "Fur Boots",
    "Draken Boots",
    "Firewalker Boots",
    "Void Boots",
    "Frostflower Boots"
  ],

  necklace: [
    "Crystal Necklace",
    "Dragon Necklace",
    "Elven Amulet",
    "Gearwheel Chain",
    "Leviathans Amulet",
    "Foxtail Amulet",
    "Collar of Red Plasma",
    "Prismatic Necklace",
    "Turtle Amulet",
    "Enchanted Turtle Amulet"
  ],

  ring: [
    "Sword Ring",
    "Butterfly Ring",
    "Claw of the Noxious Spawn",
    "Ring of Red Plasma",
    "Prismatic Ring",
    "Ring of Souls",
    "Alicorn Ring",
    "Ethereal Ring",
    "Arcanomancer Sigil",
    "Spiritthorn Ring"
  ],

  shield: [
    "Wooden Shield",
    "Studded Shield",
    "Brass Shield",
    "Plate Shield",
    "Steel Shield",
    "Battle Shield",
    "Dark Shield",
    "Ancient Shield",
    "Guardian Shield",
    "Tower Shield"
  ]
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
  damage: { label: "Damage", suffix: "%", min: 1, max: 2 },
  gold: { label: "Gold", suffix: "%", min: 1, max: 3 },
  exp: { label: "EXP", suffix: "%", min: 1, max: 2 },
  crit: { label: "Crit Chance", suffix: "%", min: 0.25, max: 1 },
  attackSpeed: { label: "Attack Speed", suffix: "%", min: 0.5, max: 2.5 },

  critDamage: { label: "Crit Damage", suffix: "%", min: 5, max: 20 },

  doubleDrop: { label: "Double Drop Chance", suffix: "%", min: 1, max: 3 },
  whetstoneChance: { label: "Whetstone Chance", suffix: "%", min: 1, max: 3 },
  lootChance: { label: "Loot", suffix: "%", min: 2, max: 8 },

  researchEcho: { label: "Double Research Chance", suffix: "%", min: 1, max: 3 } // ← name for double kill
};

const EQUIPMENT_STAT_POOLS = {
  armor: [
    "damage", "gold", "exp", "crit", "attackSpeed",
    "critDamage", "doubleDrop", "whetstoneChance", "lootChance", "researchEcho"
  ],

  helmet: [
    "damage", "gold", "exp", "crit", "attackSpeed",
    "critDamage", "doubleDrop", "whetstoneChance", "lootChance", "researchEcho"
  ],

  legs: [
    "damage", "gold", "exp", "crit", "attackSpeed",
    "critDamage", "doubleDrop", "whetstoneChance", "lootChance", "researchEcho"
  ],

  shoes: [
    "damage", "gold", "exp", "crit", "attackSpeed",
    "critDamage", "doubleDrop", "whetstoneChance", "lootChance", "researchEcho"
  ],

  necklace: [
    "damage", "gold", "exp", "crit", "attackSpeed",
    "critDamage", "doubleDrop", "whetstoneChance", "lootChance", "researchEcho"
  ],

  ring: [
    "damage", "gold", "exp", "crit", "attackSpeed",
    "critDamage", "doubleDrop", "whetstoneChance", "lootChance", "researchEcho"
  ],

  shield: [
    "damage", "gold", "exp", "crit", "attackSpeed",
    "critDamage", "doubleDrop", "whetstoneChance", "lootChance", "researchEcho"
  ]
};

function getUnlockedDepotTabs() {
  const baseTabs = 3;
  const cancerBonus = state.constellations?.cancer || 0;

  return baseTabs + cancerBonus;
}

function renderDepotTabs() {
  const tabs = document.getElementById("depotTabs");
  if (!tabs) return;

  if (!state.depot) state.depot = {};
  if (state.depot.activeTab === undefined) state.depot.activeTab = 0;

  const unlockedTabs = getUnlockedDepotTabs();

  tabs.innerHTML = "";

  for (let i = 0; i < unlockedTabs; i++) {
    const button = document.createElement("button");
    button.className = `depotTab ${i === state.depot.activeTab ? "active" : ""}`;
    button.dataset.depotTab = i;
    button.textContent = `Tab ${i + 1}`;

    button.onclick = () => setDepotTab(i);

    tabs.appendChild(button);
  }
}

function getTierWeightsForZone(zoneId) {
  const baseTier = Math.floor((zoneId - 1) / 4) + 1;
  const step = (zoneId - 1) % 4;

  if (step === 0) return [{ tier: baseTier, weight: 100 }];

  if (step === 1) {
    return [
      { tier: baseTier, weight: 75 },
      { tier: baseTier + 1, weight: 25 }
    ];
  }

  if (step === 2) {
    return [
      { tier: baseTier, weight: 50 },
      { tier: baseTier + 1, weight: 50 }
    ];
  }

  return [
    { tier: baseTier, weight: 25 },
    { tier: baseTier + 1, weight: 75 }
  ];
}

function pickWeighted(list) {
  const total = list.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;

  for (const entry of list) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }

  return list[0];
}

function rollItemTier() {
  const weights = getTierWeightsForZone(state.zoneId);
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

function generateEquipmentItem() {
  const type = EQUIPMENT_ITEM_TYPES[rand(0, EQUIPMENT_ITEM_TYPES.length - 1)];
  const tier = rollItemTier();
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
  statKey === "critChance"
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

const ENHANCE_CHANCES = [
  100, // +0 -> +1
  90,  // +1 -> +2
  75,  // +2 -> +3
  60,  // +3 -> +4
  45,  // +4 -> +5
  32,  // +5 -> +6
  24,  // +6 -> +7
  18,  // +7 -> +8
  13,  // +8 -> +9
  9,   // +9 -> +10
  6,   // +10 -> +11
  4,   // +11 -> +12
  2,   // +12 -> +13
  1,   // +13 -> +14
  0.5  // +14 -> +15
];

const MAX_ENHANCE_LEVEL = 15;

function getEnhanceCost(item) {
  const level = item.enhanceLevel || 0;
  const tier = item.tier || 1;

  return {
    gold: Math.floor(100000 * tier * Math.pow(1.85, level)),
    materialKey: getSalvageMaterialKey(item.rarity),
    materials: Math.ceil((level + 1) * tier * Math.pow(1.35, level)),
    whetstones: Math.ceil(Math.pow(1.25, level)),
    chance: ENHANCE_CHANCES[level] || 0
  };
}

function rollEquipmentDrop(monster) {
  let baseChance = 0.005;

  if (monster.isBoss) baseChance = 0.025;
  if (monster.isUber) baseChance = 0.05;

  const gearingBoost = 1 + (state.skills.gearingUp || 0) * 0.10;
  const researchRareDropBoost = 1 + getTotalResearchBonus("rareDrops");
  const gearLootBoost = 1 + getTotalEquipmentStat("lootChance") / 100;

  const finalChance = baseChance * gearingBoost * researchRareDropBoost * gearLootBoost;

  if (Math.random() < 0.00001) {
  addInventoryItem("goldenTreasureChest", 1);

  showFilterNotification(
    "loot",
    "🟨 Golden Treasure Chest dropped!"
  );

  renderBackpack?.();
}

  // roll once
  if (Math.random() > finalChance) return;

  const doubleChance = getTotalEquipmentStat("doubleDrop") / 100;

  // always at least 1 drop
  let totalDrops = 1;

  // chance to duplicate
  if (Math.random() < doubleChance) {
    totalDrops++;
  }

  for (let i = 0; i < totalDrops; i++) {
    const item = generateEquipmentItem();
const inserted = addItemToDepot(item);

if (inserted) {
  addLog(`🧩 ${item.rarityName} ${item.name} dropped!`, "loot");

  if (document.getElementById("depotPanel")?.style.display === "block") {
    renderDepotPanel();
    injectPanelHero?.("depotPanel");
  }
} else {
  addLog("⚠️ Depot full. Item lost.", "system");
}
  }

  renderDepotPanel();
}

function addItemToDepot(item) {
  ensureFilters();

  if (!state.salvageMaterials) {
    state.salvageMaterials = {
      commonMaterial: 0,
      uncommonMaterial: 0,
      rareMaterial: 0,
      legendaryMaterial: 0
    };
  }

  if (shouldAutoProcessItem(item)) {
    if (state.filters.equipmentAction === "salvage") {
      const materialKey = getSalvageMaterialKey(item.rarity);
      const amount = getSalvageAmount(item);

      state.salvageMaterials[materialKey] =
        (state.salvageMaterials[materialKey] || 0) + amount;

      showFilterNotification(
        "salvage",
        `⚒ Salvaged ${item.rarityName} ${item.name} (+${amount} material)`
      );

      renderBlacksmithPanel();
      return true;
    }

    if (state.filters.equipmentAction === "sell") {
      const value = getItemSellValue(item);

      state.gold += value;

      showFilterNotification(
        "sell",
        `💰 Sold ${item.rarityName} ${item.name} (+${fmt(value)} gold)`
      );

      updateUI();
      return true;
    }
  }

  for (let t = 0; t < state.depot.tabs.length; t++) {
    const tab = state.depot.tabs[t];

    for (let i = 0; i < tab.length; i++) {
      if (!tab[i]) {
        tab[i] = item;
        return true;
      }
    }
  }

  return false;
}

function getEquipmentSprite(type, name) {
  const fileName = name.toLowerCase().replaceAll(" ", "_").replaceAll("'", "");
  return `assets/equipment/${type}/${fileName}.gif`;
}

function equipItem(item, index, tabIndex) {
  hideItemTooltip();
	
  const slotType = item.type;

  if (!state.equipment[slotType] && state.equipment[slotType] !== null) return;

  const previous = state.equipment[slotType];

  // equip new
  state.equipment[slotType] = item;

  // remove from depot
  state.depot.tabs[tabIndex][index] = null;

  // return old item to depot
  if (previous) {
    addItemToDepot(previous);
  }

  addLog(`🧩 Equipped ${item.rarityName} ${item.name}`, "system");

  updateUI();
  renderDepotPanel();
  saveGame();
}

function getRarityValueMultiplier(rarityKey) {
  if (rarityKey === "common") return 1;
  if (rarityKey === "uncommon") return 2.5;
  if (rarityKey === "rare") return 6;
  if (rarityKey === "legendary") return 20;
  return 1;
}

function getItemSellValue(item) {
  if (!item) return 0;

  const tier = item.tier || 1;
  const rarityMulti = getRarityValueMultiplier(item.rarity);

  return Math.floor(100 * tier * rarityMulti);
}

function getSalvageMaterialKey(rarityKey) {
  if (rarityKey === "common") return "commonMaterial";
  if (rarityKey === "uncommon") return "uncommonMaterial";
  if (rarityKey === "rare") return "rareMaterial";
  if (rarityKey === "legendary") return "legendaryMaterial";
  return "commonMaterial";
}

function getSalvageAmount(item) {
  if (!item) return 0;

  const tier = item.tier || 1;
  const rarityMulti = getRarityValueMultiplier(item.rarity);

  return Math.max(1, Math.floor(tier * rarityMulti));
}

function sellDepotItem(tabIndex, slotIndex, silent = false) {
  if (!silent) hideItemTooltip();

  const item = state.depot.tabs[tabIndex]?.[slotIndex];
  if (!item) return;

  const value = getItemSellValue(item);

  state.gold += value;
  state.depot.tabs[tabIndex][slotIndex] = null;
  compactDepotTab(tabIndex);

  if (!silent) {
    showFilterNotification(
      "sell",
      `💰 Sold ${item.rarityName} ${item.name} (+${fmt(value)} gold)`
    );

    updateUI();
    renderDepotPanel();
	injectPanelHero?.("depotPanel");
    saveGame();
  }
}

function salvageDepotItem(tabIndex, slotIndex, silent = false) {
  if (!silent) hideItemTooltip();

  const item = state.depot.tabs[tabIndex]?.[slotIndex];
  if (!item) return;

  const materialKey = getSalvageMaterialKey(item.rarity);
  const amount = getSalvageAmount(item);

  state.salvageMaterials[materialKey] += amount;
  state.depot.tabs[tabIndex][slotIndex] = null;
  compactDepotTab(tabIndex);

  if (!silent) {
    showFilterNotification(
      "salvage",
      `⚒ Salvaged ${item.rarityName} ${item.name} (+${amount} material)`
    );

    updateUI();
    renderDepotPanel();
    renderCraftingPanel();
	renderBlacksmithPanel();
	injectPanelHero?.("depotPanel");
    saveGame();
  }
}

const RARITY_ORDER = {
  common: 1,
  uncommon: 2,
  rare: 3,
  legendary: 4
};

function shouldAutoProcessItem(item) {
  ensureFilters();

  if (!item) return false;
  if (state.filters.equipmentAction === "none") return false;

  const itemRank = RARITY_ORDER[item.rarity];
  const limitRank = RARITY_ORDER[state.filters.rarityLimit];

  if (!itemRank || !limitRank) return false;

  return itemRank <= limitRank;
}