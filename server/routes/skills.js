const express = require("express");
const fs = require("fs");
const path = require("path");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

const SAVES_FILE = path.join(__dirname, "../data/saves.json");

const SKILL_DEFS = {
  sharpshooter: { max: 10, branch: "minotaur" },
  powerBolt: { max: 10, branch: "minotaur" },
  doubleStrike: { max: 10, branch: "minotaur", noAries: true },
  tripleStrike: { max: 10, branch: "minotaur", noAries: true },
  headshot: { max: 10, branch: "minotaur", noAries: true },
  strongerBullets: { max: 10, branch: "minotaur" },

  battleRhythm: { max: 1, branch: "minotaur", modifier: true },
  openingStrike: { max: 1, branch: "minotaur", modifier: true },
  executionerShot: { max: 1, branch: "minotaur", modifier: true },
  burstArrow: { max: 1, branch: "minotaur", modifier: true },
  focusedDouble: { max: 1, branch: "minotaur", modifier: true },
  followUp: { max: 1, branch: "minotaur", modifier: true },
  focusedBarrage: { max: 1, branch: "minotaur", modifier: true },
  piercingShot: { max: 1, branch: "minotaur", modifier: true },
  guillotine: { max: 1, branch: "minotaur", modifier: true },
  bleedingCritical: { max: 1, branch: "minotaur", modifier: true },
  overkill: { max: 1, branch: "minotaur", modifier: true },
  ricochet: { max: 1, branch: "minotaur", modifier: true },

  unlockFireball: { max: 1, branch: "spells", bulkUnlock: true },
  fireballDamage: { max: 10, branch: "spells" },
  fireballCooldown: { max: 10, branch: "spells", noAries: true },

  unlockLightMagic: { max: 1, branch: "spells", bulkUnlock: true },
  lightMagicDamage: { max: 10, branch: "spells" },
  lightMagicCooldown: { max: 10, branch: "spells", noAries: true },

  unlockHeavyMagic: { max: 1, branch: "spells", bulkUnlock: true },
  heavyMagicDamage: { max: 10, branch: "spells" },
  heavyMagicCooldown: { max: 10, branch: "spells", noAries: true },

  deepPockets: { max: 10, branch: "economy" },
  experiencedHunter: { max: 10, branch: "economy" },
  materialistic: { max: 10, branch: "economy" },
  gearingUp: { max: 10, branch: "economy" },
  likeABoss: { max: 10, branch: "economy" },
  lootHungry: { max: 10, branch: "economy" },
  uberDifficulty: { max: 10, branch: "economy" },

  darkNovaDamage: { max: 10, branch: "necromancer" },
  darkNovaTargets: { max: 10, branch: "necromancer" },
  decay: { max: 1, branch: "necromancer", modifier: true },
  deathEcho: { max: 10, branch: "necromancer", noAries: true },
  overchannel: { max: 10, branch: "necromancer" },
  graveCalling: { max: 1, branch: "necromancer", modifier: true },
  skeletonMastery: { max: 10, branch: "necromancer" },
  skeletonReach: { max: 10, branch: "necromancer" },
  walkingDead: { max: 10, branch: "necromancer" },
  reanimation: { max: 10, branch: "necromancer", noAries: true },
  eliteSkeleton: { max: 10, branch: "necromancer", noAries: true },
  boneArmor: { max: 10, branch: "necromancer" }
};

const NODE_TO_SKILL = Object.fromEntries(
  Object.keys(SKILL_DEFS).map(key => [key, key])
);

const PARENTS = {
  sharpshooter: [],
  powerBolt: [],
  doubleStrike: [],
  headshot: [],
  strongerBullets: [],

  tripleStrike: ["doubleStrike"],

  battleRhythm: ["sharpshooter"],
  openingStrike: ["sharpshooter"],

  executionerShot: ["powerBolt"],
  burstArrow: ["powerBolt"],

  focusedDouble: ["doubleStrike"],
  followUp: ["doubleStrike"],

  focusedBarrage: ["tripleStrike"],
  piercingShot: ["tripleStrike"],

  guillotine: ["headshot"],
  bleedingCritical: ["headshot"],

  overkill: ["strongerBullets"],
  ricochet: ["strongerBullets"],

  unlockFireball: ["spells_category"],
  unlockLightMagic: ["spells_category"],
  unlockHeavyMagic: ["spells_category"],

  fireballDamage: ["unlockFireball"],
  fireballCooldown: ["unlockFireball"],

  lightMagicDamage: ["unlockLightMagic"],
  lightMagicCooldown: ["unlockLightMagic"],

  heavyMagicDamage: ["unlockHeavyMagic"],
  heavyMagicCooldown: ["unlockHeavyMagic"],

  deepPockets: ["economy_category"],
  experiencedHunter: ["economy_category"],
  materialistic: ["economy_category"],
  gearingUp: ["economy_category"],
  likeABoss: ["economy_category"],
  lootHungry: ["economy_category"],
  uberDifficulty: ["economy_category"],

  darkNovaDamage: ["necromancer_category"],
  graveCalling: ["necromancer_category"],

  darkNovaTargets: ["darkNovaDamage"],
  decay: ["darkNovaTargets"],
  overchannel: ["darkNovaTargets"],
  deathEcho: ["decay"],

  skeletonMastery: ["graveCalling"],
  skeletonReach: ["skeletonMastery"],
  walkingDead: ["skeletonMastery"],
  boneArmor: ["skeletonReach"],
  reanimation: ["walkingDead"],
  eliteSkeleton: ["reanimation"]
};

const MODIFIER_PAIRS = [
  ["battleRhythm", "openingStrike"],
  ["executionerShot", "burstArrow"],
  ["focusedDouble", "followUp"],
  ["focusedBarrage", "piercingShot"],
  ["guillotine", "bleedingCritical"],
  ["overkill", "ricochet"]
];

function loadSaves() {
  if (!fs.existsSync(SAVES_FILE)) return {};

  try {
    return JSON.parse(fs.readFileSync(SAVES_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveSaves(saves) {
  fs.writeFileSync(SAVES_FILE, JSON.stringify(saves, null, 2));
}

function getSkillMax(save, skillKey) {
  const def = SKILL_DEFS[skillKey];
  if (!def) return 1;

  if (def.bulkUnlock || def.modifier) return 1;
  if (def.noAries) return def.max || 1;

  return (def.max || 1) + Number(save?.constellations?.aries || 0);
}

function getCategoryPoints(save, branch) {
  const skills = save.skills || {};

  return Object.entries(SKILL_DEFS).reduce((total, [key, def]) => {
    if (def.branch !== branch) return total;
    return total + Math.max(0, Math.floor(Number(skills[key] || 0)));
  }, 0);
}

function hasSkill(save, key) {
  return Number(save?.skills?.[key] || 0) > 0;
}

function hasCategoryUnlocked(save, categoryId) {
  if (categoryId === "spells_category") {
    return getCategoryPoints(save, "minotaur") >= 20;
  }

  if (categoryId === "economy_category") {
    return getCategoryPoints(save, "spells") >= 20;
  }

  if (categoryId === "necromancer_category") {
    return (
      Number(save?.rebirthUpgrades?.necromancer || 0) > 0 &&
      getCategoryPoints(save, "economy") >= 20
    );
  }

  return false;
}

function getDualModifierLimit(save) {
  return Number(save?.constellations?.gemini || 0);
}

function getDualModifierCount(save) {
  return MODIFIER_PAIRS.filter(pair => {
    return pair.every(key => hasSkill(save, key));
  }).length;
}

function hasExclusiveModifierConflict(save, skillKey) {
  const pair = MODIFIER_PAIRS.find(group => group.includes(skillKey));
  if (!pair) return false;

  const otherKey = pair.find(key => key !== skillKey);

  if (!hasSkill(save, otherKey)) return false;

  return getDualModifierCount(save) >= getDualModifierLimit(save);
}

function canPurchaseSkill(save, skillKey) {
  const def = SKILL_DEFS[skillKey];

  if (!def) {
    return {
      ok: false,
      message: "Unknown skill."
    };
  }

  if (Number(save.skillPoints || 0) <= 0) {
    return {
      ok: false,
      message: "You do not have any skill points."
    };
  }

  const current = Number(save.skills?.[skillKey] || 0);
  const max = getSkillMax(save, skillKey);

  if (current >= max) {
    return {
      ok: false,
      message: "Skill is already maxed."
    };
  }

  if (def.branch === "spells" && !hasCategoryUnlocked(save, "spells_category")) {
    return {
      ok: false,
      message: "Spells branch is not unlocked."
    };
  }

  if (def.branch === "economy" && !hasCategoryUnlocked(save, "economy_category")) {
    return {
      ok: false,
      message: "Economy branch is not unlocked."
    };
  }

  if (def.branch === "necromancer" && !hasCategoryUnlocked(save, "necromancer_category")) {
    return {
      ok: false,
      message: "Necromancer branch is not unlocked."
    };
  }

  const parents = PARENTS[skillKey] || [];

  for (const parent of parents) {
    if (parent.endsWith("_category")) {
      if (!hasCategoryUnlocked(save, parent)) {
        return {
          ok: false,
          message: "Parent category is not unlocked."
        };
      }

      continue;
    }

    const parentDef = SKILL_DEFS[parent];
    const parentLevel = Number(save.skills?.[parent] || 0);

    if (def.modifier) {
      const parentMax = getSkillMax(save, parent);

      if (parentLevel < parentMax) {
        return {
          ok: false,
          message: "Parent skill must be maxed first."
        };
      }
    } else if (!parentDef || parentLevel <= 0) {
      return {
        ok: false,
        message: "Parent skill is not unlocked."
      };
    }
  }

  if (def.modifier && hasExclusiveModifierConflict(save, skillKey)) {
    return {
      ok: false,
      message: "You can only choose one modifier from this pair."
    };
  }

  return {
    ok: true
  };
}

function rebuildUnlockedNodesFromSkills(save) {
  const unlocked = new Set(["minotaur_category"]);

  Object.entries(save.skills || {}).forEach(([skillKey, level]) => {
    if (Number(level || 0) > 0) {
      unlocked.add(skillKey);
    }
  });

  if (getCategoryPoints(save, "minotaur") >= 20) {
    unlocked.add("spells_category");
  }

  if (getCategoryPoints(save, "spells") >= 20) {
    unlocked.add("economy_category");
  }

  if (
    Number(save?.rebirthUpgrades?.necromancer || 0) > 0 &&
    getCategoryPoints(save, "economy") >= 20
  ) {
    unlocked.add("necromancer_category");
  }

  return Array.from(unlocked);
}

function hasChildSkillUnlocked(save, skillKey) {
  return Object.entries(PARENTS).some(([childKey, parents]) => {
    if (Number(save.skills?.[childKey] || 0) <= 0) return false;
    return parents.includes(skillKey);
  });
}

router.post("/purchase", authMiddleware, (req, res) => {
  const nodeId = String(req.body?.nodeId || "");
  const skillKey = NODE_TO_SKILL[nodeId] || nodeId;

  const saves = loadSaves();
  const wrapper = saves[req.user.id];

  if (!wrapper?.save) {
    return res.status(400).json({
      success: false,
      message: "No cloud save found."
    });
  }

  const save = wrapper.save;

  if (!save.skills || typeof save.skills !== "object") {
    save.skills = {};
  }

  if (!Array.isArray(save.unlockedNodes)) {
    save.unlockedNodes = ["minotaur_category"];
  }

  const check = canPurchaseSkill(save, skillKey);

  if (!check.ok) {
    return res.status(400).json({
      success: false,
      message: check.message
    });
  }

  save.skillPoints = Math.max(0, Math.floor(Number(save.skillPoints || 0) - 1));
  save.skills[skillKey] = Math.floor(Number(save.skills[skillKey] || 0) + 1);

  if (!save.unlockedNodes.includes(nodeId)) {
    save.unlockedNodes.push(nodeId);
  }

  save.lastSeenAt = Date.now();

  saves[req.user.id] = {
    save,
    updatedAt: Date.now()
  };

  saveSaves(saves);

  res.json({
    success: true,
    skillPoints: save.skillPoints,
    skills: save.skills,
    unlockedNodes: save.unlockedNodes
  });
});

router.post("/refund", authMiddleware, (req, res) => {
  const nodeId = String(req.body?.nodeId || "");
  const skillKey = NODE_TO_SKILL[nodeId] || nodeId;

  const saves = loadSaves();
  const wrapper = saves[req.user.id];

  if (!wrapper?.save) {
    return res.status(400).json({
      success: false,
      message: "No cloud save found."
    });
  }

  const save = wrapper.save;

  if (!save.skills || typeof save.skills !== "object") {
    save.skills = {};
  }

  const current = Math.floor(Number(save.skills[skillKey] || 0));

  if (current <= 0) {
    return res.status(400).json({
      success: false,
      message: "Skill is not purchased."
    });
  }

  if (hasChildSkillUnlocked(save, skillKey)) {
    return res.status(400).json({
      success: false,
      message: "Refund child skills first."
    });
  }

  save.skills[skillKey] = current - 1;

  if (save.skills[skillKey] <= 0) {
    delete save.skills[skillKey];
  }

  save.skillPoints = Math.floor(Number(save.skillPoints || 0) + 1);
  save.unlockedNodes = rebuildUnlockedNodesFromSkills(save);
  save.lastSeenAt = Date.now();

  saves[req.user.id] = {
    save,
    updatedAt: Date.now()
  };

  saveSaves(saves);

  res.json({
    success: true,
    skillPoints: save.skillPoints,
    skills: save.skills,
    unlockedNodes: save.unlockedNodes
  });
});

module.exports = router;