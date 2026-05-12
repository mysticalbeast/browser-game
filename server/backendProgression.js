function expNeededForLevel(level) {
  const safeLevel = Math.max(1, Math.floor(Number(level || 1)));

  return Math.floor(
    35 +
    safeLevel * 12 +
    Math.pow(safeLevel, 2) * 2.5 +
    Math.pow(safeLevel, 2.35) * 1.15
  );
}

function getBackendLevelCap(save) {
  return 300 + Number(save?.rebirth?.count || 0) * 50;
}

function getSkillPointGainForLevel(level) {
  const safeLevel = Math.floor(Number(level || 1));

  if (safeLevel <= 50) return 1;
  if (safeLevel % 3 === 0) return 1;

  return 0;
}

function applyBackendExpGain(save, expGain) {
  if (!save || typeof save !== "object") return;

  if (!save.rebirth || typeof save.rebirth !== "object") {
    save.rebirth = {
      count: 0,
      coins: 0
    };
  }

  save.level = Math.max(1, Math.floor(Number(save.level || 1)));
  save.exp = Math.max(0, Math.floor(Number(save.exp || 0)));

  if (typeof save.skillPoints !== "number") {
    save.skillPoints = Math.floor(Number(save.skillPoints || 0));
  }

  save.exp += Math.max(0, Math.floor(Number(expGain || 0)));

while (save.exp >= expNeededForLevel(save.level)) {
    save.exp -= expNeededForLevel(save.level);
    save.level += 1;

    save.skillPoints += getSkillPointGainForLevel(save.level);
  }
}

module.exports = {
  expNeededForLevel,
  getBackendLevelCap,
  getSkillPointGainForLevel,
  applyBackendExpGain
};