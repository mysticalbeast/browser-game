const CLOUD_SAVE_INTERVAL_MS = 30000;

let cloudSaveTimer = null;
let lastCloudSaveAt = 0;
let pendingCloudSave = null;

function getLoggedInUser() {
  try {
    return JSON.parse(localStorage.getItem("loggedInUser"));
  } catch (error) {
    return null;
  }
}

function getSerializableSave() {
  return {
    ...state,
    monsters: []
  };
}

function getLoggedInUser() {
  try {
    return JSON.parse(localStorage.getItem("loggedInUser"));
  } catch (error) {
    return null;
  }
}

function getCurrentSaveKey() {
  const user = getLoggedInUser();

  if (user?.id) {
    return `${SAVE_KEY}_${user.id}`;
  }

  return SAVE_KEY;
}

function saveGame() {
  if (window.isResettingSave) return;

  state.lastSeenAt = Date.now();

  const save = getSerializableSave();

  localStorage.setItem(getCurrentSaveKey(), JSON.stringify(save));

  scheduleCloudSave(save);
}

function setCloudSaveStatus(status, className = "") {
  const el = document.getElementById("cloudSaveStatus");
  if (!el) return;

  el.className = className;
  el.textContent = `Cloud Save: ${status}`;
}

function scheduleCloudSave(save) {
  const user = getLoggedInUser();
  if (!user?.id) return;

  pendingCloudSave = save;

  const now = Date.now();
  const timeSinceLastUpload = now - lastCloudSaveAt;
  const delay = Math.max(0, CLOUD_SAVE_INTERVAL_MS - timeSinceLastUpload);

  clearTimeout(cloudSaveTimer);

  cloudSaveTimer = setTimeout(() => {
    if (!pendingCloudSave) return;

    uploadCloudSave(pendingCloudSave);
    pendingCloudSave = null;
  }, delay);
}

async function uploadCloudSave(save) {
  const user = getLoggedInUser();
  if (!user?.id) {
    setCloudSaveStatus("Local only");
    return;
  }

  lastCloudSaveAt = Date.now();
  setCloudSaveStatus("Saving...", "saving");

  try {
    const response = await fetch(`${API_URL}/save/${user.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ save })
    });

    if (!response.ok) {
      throw new Error("Cloud save request failed.");
    }

    setCloudSaveStatus("Saved", "saved");
  } catch (error) {
    console.warn("Cloud save failed:", error);
    setCloudSaveStatus("Failed", "failed");
  }
}

function loadGame() {
  const raw = localStorage.getItem(getCurrentSaveKey());
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);
    Object.assign(state, saved);

    normalizeLoadedState();
  } catch (error) {
    console.error(error);
  }
}

function normalizeLoadedState() {
  state.monsters = [];

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

  state.equipment = {
    ...DEFAULT_EQUIPMENT,
    ...(state.equipment || {})
  };

  state.equipmentInventory = Array.isArray(state.equipmentInventory)
    ? state.equipmentInventory
    : [];

  state.depot = state.depot || structuredClone(DEFAULT_DEPOT);

  if (!Array.isArray(state.depot.tabs) || state.depot.tabs.length !== 3) {
    state.depot = structuredClone(DEFAULT_DEPOT);
  }

  state.depot.tabs = state.depot.tabs.map(tab => {
    if (!Array.isArray(tab)) return Array(40).fill(null);

    while (tab.length < 40) tab.push(null);
    return tab.slice(0, 40);
  });

  state.depot.activeTab = state.depot.activeTab || 0;

  state.ownedWeapons = Array.isArray(state.ownedWeapons)
    ? state.ownedWeapons
    : ["Sword"];

  if (!state.ownedWeapons.includes("Sword")) {
    state.ownedWeapons.unshift("Sword");
  }

  if (!state.equippedWeapon || !ownsWeapon(state.equippedWeapon)) {
    state.equippedWeapon = "Sword";
  }

  state.visitedZones = Array.isArray(state.visitedZones)
    ? state.visitedZones
    : [1];

  if (!state.visitedZones.includes(1)) {
    state.visitedZones.unshift(1);
  }

  state.skills = {
    ...DEFAULT_SKILLS,
    ...(state.skills || {})
  };

  state.materials = {
    ...DEFAULT_MATERIALS,
    ...(state.materials || {})
  };

  state.potions = {
    ...DEFAULT_POTIONS,
    ...(state.potions || {})
  };

  state.rewards = {
    ...DEFAULT_REWARDS,
    ...(state.rewards || {})
  };

  normalizeLoadouts?.();

  state.activeLogFilter = state.activeLogFilter || "all";
  state.logMessages = Array.isArray(state.logMessages)
    ? state.logMessages
    : [];

  if (typeof state.skillPoints !== "number") {
    state.skillPoints = 0;
  }

  if (!state.activeSkillTree) {
    state.activeSkillTree = "summons";
  }

  state.lastSpellCast = {
    fireball: 0,
    lightMagic: 0,
    heavyMagic: 0,
    ...(state.lastSpellCast || {})
  };
}