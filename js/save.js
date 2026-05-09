function saveGame() {
  if (window.isResettingSave) return;

  state.lastSeenAt = Date.now();

  const save = { ...state, monsters: [] };

  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;
  
  state.stats = {
  sessionStartedAt: Date.now(),
  goldEarned: 0,
  expEarned: 0,
  monstersKilled: 0,
  bossesKilled: 0,
  ubersKilled: 0,
  gearFound: 0,
  ...(state.stats || {})
};
  
  state.salvageMaterials = {
  ...DEFAULT_SALVAGE_MATERIALS,
  ...(state.salvageMaterials || {})
};
  
  state.equipment = { ...DEFAULT_EQUIPMENT, ...(state.equipment || {}) };
  state.equipmentInventory = Array.isArray(state.equipmentInventory) ? state.equipmentInventory : [];

  state.depot = state.depot || structuredClone(DEFAULT_DEPOT);

if (!Array.isArray(state.depot.tabs) || state.depot.tabs.length !== 3) {
  state.depot = structuredClone(DEFAULT_DEPOT);
}
state.unlockedNodes = ["center"];
state.depot.tabs = state.depot.tabs.map(tab => {
  if (!Array.isArray(tab)) return Array(40).fill(null);

  while (tab.length < 40) tab.push(null);
  return tab.slice(0, 40);
});

state.depot.activeTab = state.depot.activeTab || 0;

  try {
    const saved = JSON.parse(raw);
    Object.assign(state, saved);

    state.monsters = [];

    state.ownedWeapons = Array.isArray(state.ownedWeapons) ? state.ownedWeapons : ["Sword"];
    if (!state.ownedWeapons.includes("Sword")) state.ownedWeapons.unshift("Sword");

    if (!state.equippedWeapon || !ownsWeapon(state.equippedWeapon)) {
      state.equippedWeapon = "Sword";
    }

    state.visitedZones = Array.isArray(state.visitedZones) ? state.visitedZones : [1];
    if (!state.visitedZones.includes(1)) state.visitedZones.unshift(1);

    state.skills = { ...DEFAULT_SKILLS, ...(state.skills || {}) };
    state.materials = { ...DEFAULT_MATERIALS, ...(state.materials || {}) };
    state.potions = { ...DEFAULT_POTIONS, ...(state.potions || {}) };
    state.rewards = { ...DEFAULT_REWARDS, ...(state.rewards || {}) };
	
	normalizeLoadouts?.();
	
	state.activeLogFilter = state.activeLogFilter || "all";
	state.logMessages = Array.isArray(state.logMessages) ? state.logMessages : [];

    if (typeof state.skillPoints !== "number") state.skillPoints = 0;
    if (!state.activeSkillTree) state.activeSkillTree = "summons";

    state.lastSpellCast = {
      fireball: 0,
      lightMagic: 0,
      heavyMagic: 0,
      ...(state.lastSpellCast || {})
    };
  } catch (error) {
    console.error(error);
  }
}