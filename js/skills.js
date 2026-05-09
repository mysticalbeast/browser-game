const SKILLS = {
  minotaur: [
    { key: "sharpshooter", name: "Sharpshooter", max: 10 },
    { key: "powerBolt", name: "Power Bolt", max: 10 },
    { key: "doubleStrike", name: "Double Strike", max: 10, noAries: true },
    { key: "tripleStrike", name: "Triple Strike", max: 10, noAries: true },
    { key: "headshot", name: "Headshot", max: 10, noAries: true },
    { key: "strongerBullets", name: "Stronger Bullets", max: 10 },

    { key: "battleRhythm", name: "Battle Rhythm", max: 1, modifier: true },
    { key: "openingStrike", name: "Opening Strike", max: 1, modifier: true },
    { key: "executionerShot", name: "Executioner Shot", max: 1, modifier: true },
    { key: "burstArrow", name: "Burst Arrow", max: 1, modifier: true },
    { key: "focusedDouble", name: "Focused Double", max: 1, modifier: true },
    { key: "followUp", name: "Follow-Up", max: 1, modifier: true },
    { key: "focusedBarrage", name: "Focused Barrage", max: 1, modifier: true },
    { key: "piercingShot", name: "Piercing Shot", max: 1, modifier: true },
    { key: "guillotine", name: "Guillotine", max: 1, modifier: true },
    { key: "bleedingCritical", name: "Bleeding Critical", max: 1, modifier: true },
    { key: "overkill", name: "Overkill", max: 1, modifier: true },
    { key: "ricochet", name: "Ricochet", max: 1, modifier: true }
  ],

  spells: [
    { key: "unlockFireball", name: "Unlock Fireball", bulkUnlock: true },
    { key: "fireballDamage", name: "Fireball Damage", max: 10 },
    { key: "fireballCooldown", name: "Fireball Cooldown", max: 10, noAries: true },

    { key: "unlockLightMagic", name: "Unlock Light Magic", bulkUnlock: true },
    { key: "lightMagicDamage", name: "Light Magic Damage", max: 10 },
    { key: "lightMagicCooldown", name: "Light Magic Cooldown", max: 10, noAries: true },

    { key: "unlockHeavyMagic", name: "Unlock Heavy Magic", bulkUnlock: true },
    { key: "heavyMagicDamage", name: "Heavy Magic Damage", max: 10 },
    { key: "heavyMagicCooldown", name: "Heavy Magic Cooldown", max: 10, noAries: true }
  ],

  economy: [
    { key: "deepPockets", name: "Deep Pockets", max: 10 },
    { key: "experiencedHunter", name: "Experienced Hunter", max: 10 },
    { key: "materialistic", name: "Materialistic", max: 10 },
    { key: "gearingUp", name: "Gearing Up", max: 10 },
    { key: "likeABoss", name: "Like a Boss", max: 10 },
    { key: "lootHungry", name: "Loot Hungry", max: 10 },
    { key: "uberDifficulty", name: "Uber Difficulty", max: 10 }
  ],

  necromancer: [
    { key: "darkNovaDamage", name: "Dark Nova Damage", max: 10 },
    { key: "darkNovaTargets", name: "Dark Nova Targets", max: 10 },

    { key: "decay", name: "Decay", max: 1, modifier: true },

    { key: "deathEcho", name: "Death Echo", max: 10, noAries: true },
    { key: "overchannel", name: "Overchannel", max: 10 },

    { key: "graveCalling", name: "Grave Calling", max: 1, modifier: true },

    { key: "skeletonMastery", name: "Skeleton Mastery", max: 10 },
    { key: "skeletonReach", name: "Skeleton Reach", max: 10 },
    { key: "walkingDead", name: "Walking Dead", max: 10 },

    { key: "reanimation", name: "Reanimation", max: 10, noAries: true },
    { key: "eliteSkeleton", name: "Elite Skeleton", max: 10, noAries: true },

    { key: "boneArmor", name: "Bone Armor", max: 10 }
  ]
};

function getSkillExtraMaxLevels() {
  return state.constellations?.aries || 0;
}

function getSkillMax(skillDef) {
  if (!skillDef) return 1;

  if (skillDef.bulkUnlock) return 1;
  if (skillDef.modifier) return 1;
  if (skillDef.noAries) return skillDef.max || 1;

  return (skillDef.max || 1) + (state.constellations?.aries || 0);
}

function getModifierPairs() {
  return [
    ["battleRhythm", "openingStrike"],
    ["executionerShot", "burstArrow"],
    ["focusedDouble", "followUp"],
    ["focusedBarrage", "piercingShot"],
    ["guillotine", "bleedingCritical"],
    ["overkill", "ricochet"]
  ];
}

function getDualModifierLimit() {
  return state.constellations?.gemini || 0;
}

function getDualModifierCount() {
  return getModifierPairs().filter(pair => {
    return pair.every(skillKey => (state.skills?.[skillKey] || 0) > 0);
  }).length;
}

// =====================
// GRAPH SKILL TREE
// =====================

const MINOTAUR_TO_SPELLS_REQUIREMENT = 20;
const SPELLS_TO_ECONOMY_REQUIREMENT = 20;
const ECONOMY_TO_NECROMANCER_REQUIREMENT = 20;

const SKILL_NODES = {};

function getSkillDef(skillKey) {
  return Object.values(SKILLS).flat().find(skill => skill.key === skillKey);
}

function getCategoryPoints(category) {
  return SKILLS[category].reduce((total, skill) => {
    return total + (state.skills?.[skill.key] || 0);
  }, 0);
}

function createCategoryNode(id, label, x, y, branch, connectsTo = []) {
  return {
    id,
    x,
    y,
    branch,
    type: "category",
    label,
    connectsTo
  };
}

function createSkillNode(id, skillKey, x, y, branch, connectsTo = []) {
  const skill = getSkillDef(skillKey);

  return {
    id,
    x,
    y,
    branch,
    type: "skill",
    skill: skillKey,
    value: 1,
    label: skill?.name || skillKey,
    connectsTo
  };
}

function degreesToRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function addSectorNode(categoryId, id, skillKey, angleDegrees, radius, connectsTo = []) {
  const category = SKILL_NODES[categoryId];
  if (!category) return;

  const angle = degreesToRadians(angleDegrees);

  SKILL_NODES[id] = createSkillNode(
    id,
    skillKey,
    category.x + Math.cos(angle) * radius,
    category.y + Math.sin(angle) * radius,
    category.branch,
    connectsTo
  );
}

function addRelativeNode(categoryId, id, skillKey, offsetX, offsetY) {
  const category = SKILL_NODES[categoryId];
  if (!category) return;

  SKILL_NODES[id] = createSkillNode(
    id,
    skillKey,
    category.x + offsetX,
    category.y + offsetY,
    category.branch
  );
}

function addRelativeNodeWithConnections(categoryId, id, skillKey, offsetX, offsetY, connectsTo = []) {
  const category = SKILL_NODES[categoryId];
  if (!category) return;

  SKILL_NODES[id] = createSkillNode(
    id,
    skillKey,
    category.x + offsetX,
    category.y + offsetY,
    category.branch,
    connectsTo
  );
}

function canUnlockNode(nodeId) {
  const node = SKILL_NODES[nodeId];
  if (!node) return false;

  if (nodeId === "minotaur_category") return true;

  if (nodeId === "spells_category") {
    return getCategoryPoints("minotaur") >= MINOTAUR_TO_SPELLS_REQUIREMENT;
  }

  if (nodeId === "economy_category") {
    return getCategoryPoints("spells") >= SPELLS_TO_ECONOMY_REQUIREMENT;
  }

  if (nodeId === "necromancer_category") {
  return (
    state.rebirthUpgrades?.necromancer > 0 &&
    canUnlockNode("economy_category") &&
    getCategoryPoints("economy") >= ECONOMY_TO_NECROMANCER_REQUIREMENT
  );
}

  if (node.branch === "spells" && !canUnlockNode("spells_category")) {
    return false;
  }

  if (node.branch === "economy" && !canUnlockNode("economy_category")) {
    return false;
  }

  if (node.branch === "necromancer") {
    if (!(state.rebirthUpgrades?.necromancer > 0)) return false;
    if (!canUnlockNode("necromancer_category")) return false;
  }

  const parents = Object.values(SKILL_NODES).filter(parent =>
    parent.connectsTo?.includes(nodeId)
  );

  if (parents.length === 0) return false;

  return parents.some(parent => {
    if (parent.type === "category") {
      return canUnlockNode(parent.id);
    }

    if (!parent.skill) return false;

    const parentSkillDef = getSkillDef(parent.skill);
    const parentCurrent = state.skills?.[parent.skill] || 0;
    const parentMax = getSkillMax(parentSkillDef);

    const targetSkillDef = node.skill ? getSkillDef(node.skill) : null;

    if (targetSkillDef?.modifier) {
      return parentCurrent >= parentMax;
    }

    return parentCurrent > 0;
  });
}

function applyNodeEffect(node) {
  if (!node.skill) return;

  const skillDef = getSkillDef(node.skill);
  const current = state.skills[node.skill] || 0;
  const max = getSkillMax(skillDef);

  if (current >= max) return;

  state.skills[node.skill] = Math.min(max, current + (node.value || 1));
}

function hasExclusiveModifierConflict(skillKey) {
  const pair = getModifierPairs().find(group => group.includes(skillKey));
  if (!pair) return false;

  const otherKey = pair.find(key => key !== skillKey);
  const otherSelected = (state.skills?.[otherKey] || 0) > 0;

  if (!otherSelected) return false;

  const dualLimit = getDualModifierLimit();
  const dualCount = getDualModifierCount();

  if (dualCount >= dualLimit) {
    addLog(`You have reached your maximum dual modifiers (${dualCount}/${dualLimit}).`);
    return true;
  }

  addLog(`Dual modifier used (${dualCount + 1}/${dualLimit}).`);

  return false;
}

function refundSkillNode(nodeId) {
  const node = SKILL_NODES[nodeId];
  if (!node || !node.skill) return;

  const current = state.skills?.[node.skill] || 0;
  if (current <= 0) {
    addLog("No point to refund from this node.");
    return;
  }

  // Do not allow refunding a parent while child nodes still have points.
  const childrenWithPoints = node.connectsTo
    ?.map(childId => SKILL_NODES[childId])
    .filter(child => child?.skill && (state.skills?.[child.skill] || 0) > 0) || [];

  if (childrenWithPoints.length > 0) {
    addLog("Refund connected child modifiers/skills first.");
    return;
  }

  state.skills[node.skill] = current - 1;
  state.skillPoints = (state.skillPoints || 0) + 1;

  // If node is now empty, remove it from unlockedNodes.
  if (state.skills[node.skill] <= 0 && Array.isArray(state.unlockedNodes)) {
    state.unlockedNodes = state.unlockedNodes.filter(id => id !== nodeId);
  }

  const currentSkillTreeView = {
    x: skillTreeView.x,
    y: skillTreeView.y,
    zoom: skillTreeView.zoom
  };

  updateUI();
  renderPanelById("upgradePanel");

  skillTreeView.x = currentSkillTreeView.x;
  skillTreeView.y = currentSkillTreeView.y;
  skillTreeView.zoom = currentSkillTreeView.zoom;
  applySkillTreeTransform();

  saveGame();

  addLog(`Refunded 1 point from ${node.label}.`);
}

function clickSkillNode(nodeId) {
  const node = SKILL_NODES[nodeId];
  if (!node) return;

  if (!Array.isArray(state.unlockedNodes)) {
    state.unlockedNodes = ["minotaur_category"];
  }

  if (node.type === "category") return;

  if (!canUnlockNode(nodeId)) {
    addLog("This talent is not unlocked yet.");
    return;
  }

  if ((state.skillPoints || 0) <= 0) {
    addLog("You do not have any skill points.");
    return;
  }

  const skillDef = getSkillDef(node.skill);
  const current = state.skills[node.skill] || 0;
  const max = getSkillMax(skillDef);
  
  if (skillDef?.modifier && hasExclusiveModifierConflict(node.skill)) {
  addLog("You can only choose one modifier from this pair.");
  return;
}

  if (current >= max) {
    addLog(`${skillDef?.name || "Skill"} is already maxed.`);
    return;
  }

  if (!state.unlockedNodes.includes(nodeId)) {
    state.unlockedNodes.push(nodeId);
  }

  state.skillPoints--;
  applyNodeEffect(node);

  const currentSkillTreeView = {
    x: skillTreeView.x,
    y: skillTreeView.y,
    zoom: skillTreeView.zoom
  };

  updateUI();
  renderPanelById("upgradePanel");

  skillTreeView.x = currentSkillTreeView.x;
  skillTreeView.y = currentSkillTreeView.y;
  skillTreeView.zoom = currentSkillTreeView.zoom;

  applySkillTreeTransform();
  saveGame();
}

function getSkillBranchClass(nodeOrId) {
  const node = typeof nodeOrId === "string" ? SKILL_NODES[nodeOrId] : nodeOrId;
  if (!node?.branch) return null;
  return `branch-${node.branch}`;
}

// =====================
// CATEGORY NODES
// =====================

SKILL_NODES.minotaur_category = createCategoryNode(
  "minotaur_category",
  "Minotaur",
  900,
  -500,
  "minotaur",
  [
    "sharpshooter",
    "powerBolt",
    "doubleStrike",
    "headshot",
    "strongerBullets",
    "spells_category"
  ]
);

SKILL_NODES.spells_category = createCategoryNode(
  "spells_category",
  "Spells",
  350,
  500,
  "spells",
  [
    "unlockFireball",
    "unlockLightMagic",
    "unlockHeavyMagic",
    "economy_category"
  ]
);

SKILL_NODES.economy_category = createCategoryNode(
  "economy_category",
  "Economy",
  1000,
  1200,
  "economy",
  [
    "deepPockets",
    "experiencedHunter",
    "materialistic",
    "gearingUp",
    "likeABoss",
    "lootHungry",
    "uberDifficulty",
    "necromancer_category"
  ]
);

// =====================
// MINOTAUR SKILLS
// =====================

addSectorNode("minotaur_category", "tripleStrike", "tripleStrike", 235, 330, ["focusedBarrage", "piercingShot"]);
addSectorNode("minotaur_category", "doubleStrike", "doubleStrike", 270, 250, ["tripleStrike", "focusedDouble", "followUp"]);
addSectorNode("minotaur_category", "powerBolt", "powerBolt", 330, 330, ["executionerShot", "burstArrow"]);
addSectorNode("minotaur_category", "sharpshooter", "sharpshooter", 20, 320, ["battleRhythm", "openingStrike"]);
addSectorNode("minotaur_category", "strongerBullets", "strongerBullets", 90, 260, ["overkill", "ricochet"]);
addSectorNode("minotaur_category", "headshot", "headshot", 180, 320, ["guillotine", "bleedingCritical"]);

// =====================
// MINOTAUR MODIFIERS
// =====================

addSectorNode("minotaur_category", "battleRhythm", "battleRhythm", 40, 500);
addSectorNode("minotaur_category", "openingStrike", "openingStrike", 5, 500);

addSectorNode("minotaur_category", "executionerShot", "executionerShot", 310, 500);
addSectorNode("minotaur_category", "burstArrow", "burstArrow", 345, 500);

addSectorNode("minotaur_category", "focusedDouble", "focusedDouble", 255, 430);
addSectorNode("minotaur_category", "followUp", "followUp", 285, 430);

addSectorNode("minotaur_category", "focusedBarrage", "focusedBarrage", 220, 500);
addSectorNode("minotaur_category", "piercingShot", "piercingShot", 240, 550);

addSectorNode("minotaur_category", "guillotine", "guillotine", 165, 500);
addSectorNode("minotaur_category", "bleedingCritical", "bleedingCritical", 195, 500);

addSectorNode("minotaur_category", "overkill", "overkill", 75, 500);
addSectorNode("minotaur_category", "ricochet", "ricochet", 105, 500);

// =====================
// SPELL SKILLS
// =====================

addSectorNode(
  "spells_category",
  "unlockFireball",
  "unlockFireball",
  190,
  270,
  ["fireballDamage", "fireballCooldown"]
);

addSectorNode("spells_category", "fireballDamage", "fireballDamage", 220, 420);
addSectorNode("spells_category", "fireballCooldown", "fireballCooldown", 170, 420);

addSectorNode(
  "spells_category",
  "unlockLightMagic",
  "unlockLightMagic",
  350,
  270,
  ["lightMagicDamage", "lightMagicCooldown"]
);

addSectorNode("spells_category", "lightMagicDamage", "lightMagicDamage", 330, 420);
addSectorNode("spells_category", "lightMagicCooldown", "lightMagicCooldown", 20, 420);

addSectorNode(
  "spells_category",
  "unlockHeavyMagic",
  "unlockHeavyMagic",
  140,
  270,
  ["heavyMagicDamage", "heavyMagicCooldown"]
);

addSectorNode("spells_category", "heavyMagicDamage", "heavyMagicDamage", 120, 430);
addSectorNode("spells_category", "heavyMagicCooldown", "heavyMagicCooldown", 100, 500);

// =====================
// ECONOMY SKILLS
// =====================

addSectorNode("economy_category", "lootHungry", "lootHungry", 270, 300);
addSectorNode("economy_category", "likeABoss", "likeABoss", 185, 380);
addSectorNode("economy_category", "gearingUp", "gearingUp", 145, 360);
addSectorNode("economy_category", "uberDifficulty", "uberDifficulty", 120, 525);
addSectorNode("economy_category", "materialistic", "materialistic", 55, 360);
addSectorNode("economy_category", "experiencedHunter", "experiencedHunter", 20, 390);
addSectorNode("economy_category", "deepPockets", "deepPockets", 335, 360);

// =====================
// NECROMANCER SKILLS
// =====================

SKILL_NODES.necromancer_category = createCategoryNode(
  "necromancer_category",
  "Necromancer",
  1000,
  2300,
  "necromancer",
  ["darkNovaDamage", "graveCalling"]
);

// ===== LEFT SIDE (DARK NOVA) =====

addRelativeNodeWithConnections(
  "necromancer_category",
  "darkNovaDamage",
  "darkNovaDamage",
  -250,
  0,
  ["darkNovaTargets"]
);

addRelativeNodeWithConnections(
  "necromancer_category",
  "darkNovaTargets",
  "darkNovaTargets",
  -450,
  -100,
  ["decay", "overchannel"]
);

addRelativeNodeWithConnections(
  "necromancer_category",
  "decay",
  "decay",
  -650,
  0,
  ["deathEcho"]
);

addRelativeNode(
  "necromancer_category",
  "deathEcho",
  "deathEcho",
  -850,
  -100
);

addRelativeNode(
  "necromancer_category",
  "overchannel",
  "overchannel",
  -650,
  -200
);

// ===== RIGHT SIDE (SKELETONS) =====

addRelativeNodeWithConnections(
  "necromancer_category",
  "graveCalling",
  "graveCalling",
  250,
  0,
  ["skeletonMastery"]
);

addRelativeNodeWithConnections(
  "necromancer_category",
  "skeletonMastery",
  "skeletonMastery",
  450,
  -100,
  ["skeletonReach", "walkingDead"]
);

addRelativeNodeWithConnections(
  "necromancer_category",
  "skeletonReach",
  "skeletonReach",
  650,
  -200,
  ["boneArmor"]
);

addRelativeNodeWithConnections(
  "necromancer_category",
  "walkingDead",
  "walkingDead",
  650,
  50,
  ["reanimation"]
);

addRelativeNodeWithConnections(
  "necromancer_category",
  "reanimation",
  "reanimation",
  850,
  -50,
  ["eliteSkeleton"]
);

addRelativeNode(
  "necromancer_category",
  "eliteSkeleton",
  "eliteSkeleton",
  1050,
  -150
);

addRelativeNode(
  "necromancer_category",
  "boneArmor",
  "boneArmor",
  850,
  -300
);