function calculateRebirthReward() {
  const level = state.level || 1;

  return Math.floor(Math.pow(level / 50, 1.15));
}

function getSkillSpendCost(skill) {
  if (!skill) return 1;

  if (skill.bulkUnlock) return 1;
  if (skill.modifier) return 1;

  return 1;
}

function performRebirth() {
  const cap = getLevelCap();

  if (state.level < cap) {
    showFilterNotification(
      "sell",
      `🔒 You need to reach level ${cap} to rebirth.`
    );
    return;
  }

  const reward = calculateRebirthReward();

  if (reward <= 0) {
    showFilterNotification(
      "sell",
      `🔒 You need to reach level ${cap} to rebirth.`
    );
    return;
  }

  const shouldKeepGear = state.rebirthUpgrades?.keepGear > 0;
  const rebirthTokenBonus = state.rebirthUpgrades?.rebirthTokens || 0;

  const keepMaterialPercent = Math.min(
    50,
    (state.rebirthUpgrades?.keepMaterials || 0) * 5
  );

  const keptMaterials = {};
  const keptSalvageMaterials = {};

  if (keepMaterialPercent > 0) {
    Object.entries(state.materials || {}).forEach(([key, value]) => {
      keptMaterials[key] = Math.floor((value || 0) * keepMaterialPercent / 100);
    });

    Object.entries(state.salvageMaterials || {}).forEach(([key, value]) => {
      keptSalvageMaterials[key] = Math.floor((value || 0) * keepMaterialPercent / 100);
    });
  }

  if (!shouldKeepGear) {
    state.equipment = { ...DEFAULT_EQUIPMENT };
  }

  state.rebirth.coins += reward;
  state.rebirth.count++;

  // RESET CORE
  state.level = 1;
  state.exp = 0;
  state.gold = 0;

  state.zoneId = 1;
  state.visitedZones = [1];
  clearMonsters();

  state.skillPoints = 0;
  state.skills = { ...DEFAULT_SKILLS };

  state.ownedWeapons = ["Sword"];
  state.equippedWeapon = "Sword";

  state.monsters = [];

  // RESET MATERIALS
  state.materials = {
    greenEssence: 0,
    blueEssence: 0,
    yellowEssence: 0,
    redEssence: 0,
    whetstones: 0
  };

  state.salvageMaterials = {
    commonMaterial: 0,
    uncommonMaterial: 0,
    rareMaterial: 0,
    legendaryMaterial: 0
  };

  // RESTORE KEPT MATERIALS
  if (keepMaterialPercent > 0) {
    state.materials = {
      ...state.materials,
      ...keptMaterials
    };

    state.salvageMaterials = {
      ...state.salvageMaterials,
      ...keptSalvageMaterials
    };

    showFilterNotification(
      "salvage",
      `📦 Kept ${keepMaterialPercent}% of materials.`
    );
  }

  if (rebirthTokenBonus > 0) {
    if (!state.rewards) state.rewards = {};
    state.rewards.slotCoins = (state.rewards.slotCoins || 0) + rebirthTokenBonus;

    showFilterNotification(
      "sell",
      `⚪ Rebirth bonus: +${rebirthTokenBonus} Silver Token${rebirthTokenBonus === 1 ? "" : "s"}`
    );
  }

  showFilterNotification(
    "salvage",
    `🔁 Rebirth complete! Gained ${reward} coin${reward === 1 ? "" : "s"}.`
  );

  updateUI();
  saveGame();
}

function triggerDeathEcho(targets, originalDamage) {
  const level = state.skills.deathEcho || 0;
  if (level <= 0) return;

  const echoMultiplier = (30 + level * 10) / 100;
  const echoDamage = Math.max(1, Math.floor(originalDamage * echoMultiplier));

  setTimeout(() => {
    targets.forEach(target => {
      const stillExists = state.monsters.find(m => m.id === target.id);
      if (!stillExists) return;

      spawnNecromancerProjectile(target, () => {
        const currentTarget = state.monsters.find(m => m.id === target.id);
        if (!currentTarget) return;

        hitMonster(target.id, echoDamage, "necromancer", "heavyMagic");
      });
    });

    addLog(`☠ Death Echo repeats Dark Nova for ${fmt(echoDamage)} damage.`, "combat");
  }, 1500);
}

function applyDecay(targetId, totalDamage) {
  if ((state.skills.decay || 0) <= 0) return;

  const ticks = 3;
  const tickDamage = Math.max(1, Math.floor(totalDamage * 0.40 / ticks));

  for (let i = 1; i <= ticks; i++) {
    setTimeout(() => {
      const target = state.monsters.find(m => m.id === targetId);
      if (!target) return;

      hitMonster(target.id, tickDamage, "necromancer", "heavyMagic");
    }, i * 1000);
  }
}

function getBoneArmorBonus() {
  const boneArmorLevel = state.skills.boneArmor || 0;
  if (boneArmorLevel <= 0) return 0;

  const skeletonCount = state.skeletons?.length || 0;

  // 0.5% per skeleton per level
  const bonus = skeletonCount * boneArmorLevel * 0.005;

  // cap at +60%
  return Math.min(bonus, 0.60);
}

function getRollingAverageDps(key, currentDps) {
  if (!state.dpsSamples) {
    state.dpsSamples = {
      minotaur: [],
      necromancer: []
    };
  }

  const now = Date.now();

  state.dpsSamples[key].push({
    time: now,
    value: currentDps
  });

  state.dpsSamples[key] = state.dpsSamples[key].filter(sample =>
    now - sample.time <= 5000
  );

  const samples = state.dpsSamples[key];

  if (!samples.length) return currentDps;

  const total = samples.reduce((sum, sample) => sum + sample.value, 0);
  return Math.floor(total / samples.length);
}

function getExpectedHitDamage(baseDamage) {
  const critChance = getTotalEquipmentStat("critChance") || 0;
  const critMultiplier = 2; // adjust if you have scaling

  const critFactor = 1 + (critChance / 100) * (critMultiplier - 1);

  return baseDamage * critFactor;
}

function getMinotaurDps() {
  const avg = (state.minDamage + state.maxDamage) / 2;

  const expected = getExpectedHitDamage(avg);

  const targets = getSummonTargets().length || 1; // if multi-target

  const interval = summonInterval() / 1000;

  return Math.floor((expected * targets) / interval);
}

function getNecromancerDps() {
  const base = necromancerDamage();

  const expected = getExpectedHitDamage(base);

  const targets = 3 + (state.skills.darkNovaTargets || 0);

  const interval = necromancerInterval() / 1000;

  let dps = (expected * targets) / interval;

  // Death Echo (example: 20% extra proc)
  const deathEchoChance = (state.skills.deathEcho || 0) * 0.1;
  dps *= (1 + deathEchoChance);

  return Math.floor(dps);
}

function necromancerInterval() {
  const base = 1600;

  const overchannelPenalty = 1 + (state.skills.overchannel || 0) * 0.10;

  const gearAttackSpeed = getTotalEquipmentStat("attackSpeed") || 0;
  const attackSpeedMultiplier = Math.max(0.1, 1 + gearAttackSpeed / 100);

  return Math.floor((base * overchannelPenalty) / attackSpeedMultiplier);
}

function necromancerDamage() {
  const base = rand(state.minDamage, state.maxDamage);

  const darkNovaBoost = 1 + (state.skills.darkNovaDamage || 0) * 0.15;
  const overchannelBoost = 1 + (state.skills.overchannel || 0) * 0.25;
  const boneArmorBoost = 1 + getBoneArmorBonus();

  return Math.floor(base * 0.6 * darkNovaBoost * overchannelBoost * boneArmorBoost);
}

function getNecromancerTargets() {
  const bonusTargets = state.skills.darkNovaTargets || 0;
  const maxTargets = 3 + bonusTargets;

  return state.monsters.slice(0, maxTargets);
}

function getMaxSkeletons() {
  const base = 2;

  const masteryBonus = Math.floor((state.skills.skeletonMastery || 0) / 2);
  const extra = state.skills.skeletonMastery || 0;

  return base + masteryBonus + extra;
}

function handleNecromancerSpawn(x, y) {
  if (!(state.rebirthUpgrades?.necromancer > 0)) return;
  if ((state.skills.graveCalling || 0) <= 0) return;

  if (!state.skeletons) state.skeletons = [];

  const now = Date.now();

  state.skeletons = state.skeletons.filter(skeleton =>
    Number.isFinite(skeleton.x) &&
    Number.isFinite(skeleton.y) &&
    skeleton.expiresAt > now
  );

  if (state.skeletons.length >= getMaxSkeletons()) return;

  const spawnChance = 0.25;
  if (Math.random() > spawnChance) return;

  spawnSkeleton(x, y);

  const reanimationChance = (state.skills.reanimation || 0) * 0.15;
  if (state.skeletons.length < getMaxSkeletons() && Math.random() < reanimationChance) {
    spawnSkeleton(x + rand(-18, 18), y + rand(-18, 18));
  }
}

function spawnSkeleton(x, y) {
  if (!state.skeletons) state.skeletons = [];

  if (state.skeletons.length >= getMaxSkeletons()) return;

  const eliteChance = (state.skills.eliteSkeleton || 0) * 0.10;
  const elite = Math.random() < eliteChance;

  const duration = elite ? 30000 : 15000;

  const skeleton = {
    id: Math.random(),
    x,
    y,
    elite,
    expiresAt: Date.now() + duration
  };

  state.skeletons.push(skeleton);

  addLog(elite ? "☠ Elite Skeleton raised!" : "💀 A skeleton has been raised!", "system");
}

function distanceBetween(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getSkeletonMoveSpeed() {
  const level = state.skills.walkingDead || 0;
  if (level <= 0) return 0;

  // pixels per second
  return 20 + level * 10;
}

function moveSkeletons(now) {
  const speed = getSkeletonMoveSpeed();
  if (speed <= 0) return;
  if (!state.skeletons?.length) return;
  if (!state.monsters?.length) return;

  state.skeletons.forEach(skeleton => {
    if (!Number.isFinite(skeleton.x) || !Number.isFinite(skeleton.y)) return;

    if (!skeleton.lastMoveAt) {
      skeleton.lastMoveAt = now;
      return;
    }

    const deltaSeconds = (now - skeleton.lastMoveAt) / 1000;
    skeleton.lastMoveAt = now;

    const target = getNearestMonsterToSkeleton(skeleton);
    if (!target) return;

    const dx = target.x - skeleton.x;
    const dy = target.y - skeleton.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= 5) return;

    const moveAmount = Math.min(speed * deltaSeconds, distance);

    skeleton.x += (dx / distance) * moveAmount;
    skeleton.y += (dy / distance) * moveAmount;
  });
}

function getNearestMonsterToSkeleton(skeleton) {
  let bestTarget = null;
  let bestDistance = Infinity;

  state.monsters.forEach(monster => {
    if (!Number.isFinite(monster.x) || !Number.isFinite(monster.y)) return;

    const distance = Math.hypot(monster.x - skeleton.x, monster.y - skeleton.y);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestTarget = monster;
    }
  });

  return bestTarget;
}

function getSkeletonAttackRadius(skeleton) {
  const reachLevel = state.skills.skeletonReach || 0;
  const reachBonus = reachLevel * 10;

  const baseRadius = skeleton?.elite ? 100 : 75;

  return Math.max(20, baseRadius + reachBonus);
}

function getSkeletonAttackInterval(skeleton) {
  const base = skeleton?.elite ? 1200 : 1500;

  const speedBonus = state.skills.walkingDead || 0; // already exists in your system
  const speedMultiplier = 1 + speedBonus * 0.10;

  return Math.max(300, Math.floor(base / speedMultiplier));
}

function getSkeletonDamage(skeleton) {
  const masteryBoost = 1 + (state.skills.skeletonMastery || 0) * 0.10;
  const baseMultiplier = skeleton?.elite ? 0.28 : 0.16;

  return Math.max(
    1,
    Math.floor(weaponDamage() * baseMultiplier * masteryBoost)
  );
}

function getEliteSkeletonAuraDamage() {
  const masteryLevel = state.skills.skeletonMastery || 0;
  const masteryBoost = 1 + masteryLevel * 0.10;

  const base = weaponDamage();

  // Slightly stronger scaling for elite identity
  const auraMultiplier = 0.10;

  return Math.max(
    1,
    Math.floor(
      base *
      auraMultiplier *
      masteryBoost *
      getTotalSummonDamageMultiplier()
    )
  );
}

function getNearestMonsterInSkeletonRadius(skeleton) {
  const radius = getSkeletonAttackRadius(skeleton);

  let bestTarget = null;
  let bestDistance = Infinity;

  state.monsters.forEach(monster => {
    if (!Number.isFinite(monster.x) || !Number.isFinite(monster.y)) return;

    const dx = monster.x - skeleton.x;
    const dy = monster.y - skeleton.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= radius && distance < bestDistance) {
      bestTarget = monster;
      bestDistance = distance;
    }
  });

  return bestTarget;
}

function handleSkeletonAttacks(now) {
  if (!state.skeletons?.length) return;
  if (!state.monsters?.length) return;

  state.skeletons.forEach(skeleton => {
    if (!Number.isFinite(skeleton.x) || !Number.isFinite(skeleton.y)) return;

    const radius = getSkeletonAttackRadius(skeleton);

    if (!skeleton.lastAttackAt) skeleton.lastAttackAt = 0;
    if (!skeleton.lastAuraAt) skeleton.lastAuraAt = 0;

    const target = getNearestMonsterInSkeletonRadius(skeleton);

    if (
      target &&
      now - skeleton.lastAttackAt >= getSkeletonAttackInterval(skeleton)
    ) {
      skeleton.lastAttackAt = now;

      let damage = getSkeletonDamage();

      damage *= getTotalSummonDamageMultiplier();
      damage = Math.floor(damage);

      hitMonster(
        target.id,
        damage,
        skeleton.elite ? "eliteSkeleton" : "skeleton",
        "normal"
      );
    }

    if (skeleton.elite && now - skeleton.lastAuraAt >= 1000) {
      skeleton.lastAuraAt = now;

      const auraDamage = getEliteSkeletonAuraDamage();

      state.monsters
        .filter(monster => {
          if (!Number.isFinite(monster.x) || !Number.isFinite(monster.y)) return false;

          return distanceBetween(skeleton, monster) <= radius;
        })
        .forEach(monster => {
          hitMonster(
            monster.id,
            auraDamage,
            "eliteSkeletonAura",
            "heavyMagic"
          );
        });
    }
  });
}

function ensureCombatEffectStyles() {
  if (document.getElementById("combatEffectStyles")) return;

  const style = document.createElement("style");
  style.id = "combatEffectStyles";
  style.textContent = `
    .hitImpact {
      position: absolute;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 38;
      animation: hitImpactAnim 220ms ease-out forwards;
    }

    .hitImpact.normal {
      background: radial-gradient(circle, rgba(255,255,255,.95), rgba(255,210,90,.35), transparent 70%);
      box-shadow: 0 0 12px rgba(255,220,120,.8);
    }

    .hitImpact.spell {
      background: radial-gradient(circle, rgba(120,220,255,.95), rgba(60,160,255,.35), transparent 70%);
      box-shadow: 0 0 14px rgba(80,190,255,.9);
    }

    .hitImpact.lightMagic {
      background: radial-gradient(circle, rgba(255,255,255,1), rgba(120,210,255,.65), transparent 72%);
      box-shadow: 0 0 18px rgba(150,230,255,1);
    }

    .hitImpact.heavyMagic {
      background: radial-gradient(circle, rgba(190,130,255,1), rgba(80,40,180,.55), transparent 74%);
      box-shadow: 0 0 20px rgba(160,90,255,1);
    }

    .critImpact {
      position: absolute;
      width: 58px;
      height: 58px;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 41;
      background: radial-gradient(circle, rgba(255,255,255,1), rgba(255,40,40,.75), rgba(255,170,0,.35), transparent 74%);
      box-shadow: 0 0 26px rgba(255,40,40,.95);
      animation: critImpactAnim 340ms ease-out forwards;
    }

    .critSlash {
      position: absolute;
      width: 64px;
      height: 4px;
      background: linear-gradient(90deg, transparent, #fff, #ff3030, transparent);
      transform: translate(-50%, -50%) rotate(-25deg);
      pointer-events: none;
      z-index: 42;
      animation: critSlashAnim 260ms ease-out forwards;
    }

    .deathEffect {
      position: absolute;
      width: 92px;
      height: 92px;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 37;
      border-radius: 50%;
      background:
        radial-gradient(circle at 35% 35%, rgba(255,255,255,.85), transparent 18%),
        radial-gradient(circle, rgba(255,190,80,.65), rgba(80,40,20,.45), transparent 72%);
      box-shadow: 0 0 24px rgba(255,160,60,.75);
      animation: deathEffectAnim 520ms ease-out forwards;
    }

    .deathSmoke {
      position: absolute;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: rgba(90,80,70,.55);
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 36;
      animation: deathSmokeAnim 700ms ease-out forwards;
    }

    .essenceOrb {
      position: absolute;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 45;
      animation: essenceOrbAnim 900ms ease-out forwards;
    }

    .essenceLabel {
      position: absolute;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 46;
      font-size: 10px;
      font-weight: bold;
      text-shadow: 1px 1px 2px #000;
      animation: essenceLabelAnim 900ms ease-out forwards;
    }

    .monsterHitShake {
      animation: monsterHitShakeAnim 120ms linear;
    }

    @keyframes hitImpactAnim {
      0% { opacity: 1; scale: .35; }
      100% { opacity: 0; scale: 1.45; }
    }

    @keyframes critImpactAnim {
      0% { opacity: 1; scale: .25; }
      55% { opacity: 1; scale: 1.25; }
      100% { opacity: 0; scale: 1.7; }
    }

    @keyframes critSlashAnim {
      0% { opacity: 1; scale: .4; }
      100% { opacity: 0; scale: 1.25; }
    }

    @keyframes deathEffectAnim {
      0% { opacity: 1; scale: .55; }
      70% { opacity: .85; scale: 1.15; }
      100% { opacity: 0; scale: 1.55; }
    }

    @keyframes deathSmokeAnim {
      0% { opacity: .8; scale: .4; }
      100% { opacity: 0; scale: 2.4; transform: translate(-50%, -95%); }
    }

    @keyframes essenceOrbAnim {
      0% { opacity: 1; scale: .6; }
      35% { opacity: 1; scale: 1.2; }
      100% { opacity: 0; scale: .8; transform: translate(-50%, -150%); }
    }

    @keyframes essenceLabelAnim {
      0% { opacity: 1; transform: translate(-50%, -50%); }
      100% { opacity: 0; transform: translate(-50%, -135%); }
    }

    @keyframes monsterHitShakeAnim {
      0% { filter: brightness(1.8) saturate(1.5); }
      25% { transform: translate(-50%, -50%) translateX(-4px); }
      50% { transform: translate(-50%, -50%) translateX(4px); }
      75% { transform: translate(-50%, -50%) translateX(-2px); }
      100% { transform: translate(-50%, -50%) translateX(0); filter: brightness(1); }
    }
  `;

  document.head.appendChild(style);
}

function showDamage(amount, x, y, kind = "normal") {
  const text = document.createElement("div");

  const isCrit = kind === "crit";
  const isSpell = ["spell", "fireball", "lightMagic", "heavyMagic"].includes(kind);

  text.className =
    "damageText" +
    (isCrit ? " critText" : "") +
    (isSpell ? " spellText" : "");

  text.textContent = (isCrit ? "CRIT -" : "-") + fmt(amount);
  text.style.left = x + "px";
  text.style.top = y + "px";

  arena.appendChild(text);
  setTimeout(() => text.remove(), 700);
}

function showHitImpact(x, y, kind = "normal") {
  ensureCombatEffectStyles();

  const impact = document.createElement("div");

  let impactKind = "normal";
  if (kind === "lightMagic") impactKind = "lightMagic";
  else if (kind === "heavyMagic") impactKind = "heavyMagic";
  else if (["spell", "fireball"].includes(kind)) impactKind = "spell";

  impact.className = `hitImpact ${impactKind}`;
  impact.style.left = x + "px";
  impact.style.top = y + "px";

  arena.appendChild(impact);
  setTimeout(() => impact.remove(), 300);
}

function showCritImpact(x, y) {
  ensureCombatEffectStyles();

  const burst = document.createElement("div");
  burst.className = "critImpact";
  burst.style.left = x + "px";
  burst.style.top = y + "px";
  arena.appendChild(burst);

  const slash = document.createElement("div");
  slash.className = "critSlash";
  slash.style.left = x + "px";
  slash.style.top = y + "px";
  arena.appendChild(slash);

  setTimeout(() => burst.remove(), 420);
  setTimeout(() => slash.remove(), 320);
}

function showDeathEffect(x, y) {
  ensureCombatEffectStyles();

  const smokeCount = 10;

  for (let i = 0; i < smokeCount; i++) {
    const puff = document.createElement("div");

    const size = rand(14, 28);
    const driftX = rand(-30, 30);
    const driftY = rand(-70, -30);
    const duration = rand(600, 1100);
    const delay = rand(0, 120);

    puff.style.position = "absolute";
    puff.style.left = x + rand(-15, 15) + "px";
    puff.style.top = y + rand(-10, 10) + "px";
    puff.style.width = size + "px";
    puff.style.height = size + "px";
    puff.style.borderRadius = "50%";
    puff.style.pointerEvents = "none";
    puff.style.zIndex = 36;

    // soft uneven smoke color
    puff.style.background = `
      radial-gradient(circle,
        rgba(80,80,80,0.7) 0%,
        rgba(60,60,60,0.5) 40%,
        rgba(40,40,40,0.2) 70%,
        transparent 100%)
    `;

    puff.style.filter = "blur(2px)";
    puff.style.opacity = "0.9";

    puff.animate([
      {
        transform: "translate(0, 0) scale(0.6)",
        opacity: 0.9
      },
      {
        transform: `translate(${driftX}px, ${driftY}px) scale(1.8)`,
        opacity: 0
      }
    ], {
      duration: duration,
      easing: "ease-out",
      delay: delay,
      fill: "forwards"
    });

    arena.appendChild(puff);

    setTimeout(() => puff.remove(), duration + delay + 50);
  }
}

function showEssenceDropEffect(x, y, color, label) {
  ensureCombatEffectStyles();

  const orb = document.createElement("div");
  orb.className = "essenceOrb";
  orb.style.left = x + rand(-24, 24) + "px";
  orb.style.top = y + rand(-16, 16) + "px";
  orb.style.background = color;
  orb.style.boxShadow = `0 0 14px ${color}`;
  arena.appendChild(orb);

  const text = document.createElement("div");
  text.className = "essenceLabel";
  text.textContent = label;
  text.style.left = x + rand(-24, 24) + "px";
  text.style.top = y + rand(-18, 18) + "px";
  text.style.color = color;
  arena.appendChild(text);

  setTimeout(() => orb.remove(), 950);
  setTimeout(() => text.remove(), 950);
}

function playMonsterHitReaction(monsterId) {
  const el = document.querySelector(`[data-monster-id="${monsterId}"]`);
  if (!el) return;

  el.classList.remove("monsterHitShake");
  void el.offsetWidth;
  el.classList.add("monsterHitShake");

  setTimeout(() => {
    el.classList.remove("monsterHitShake");
  }, 160);
}

function isPotionActive(activeKey) {
  return Date.now() < (state.potions[activeKey] || 0);
}

function swiftnessMultiplier() {
  return isPotionActive("swiftnessUntil") ? 0.9 : 1;
}

function getWeaponDamageBonuses() {
  const celestialBonus = state.weaponStarLevel || 0;
  const dracoBonus = state.dracoWeaponScaling || 0;
  const phoenixBonus =
    (state.constellations?.phoenix || 0) > 0 && (state.level || 1) <= 100
      ? (state.constellations.phoenix * 5)
      : 0;

  return {
    celestialBonus,
    dracoBonus,
    phoenixBonus,
    totalBonus: celestialBonus + dracoBonus + phoenixBonus
  };
}

function getModifiedWeaponDamageRange() {
  const min = state.minDamage || 0;
  const max = state.maxDamage || 0;

  const bonuses = getWeaponDamageBonuses();
  const multiplier = 1 + bonuses.totalBonus / 100;

  return {
    min: Math.floor(min * multiplier),
    max: Math.floor(max * multiplier),
    bonuses
  };
}

function weaponDamage() {
  const base = rand(state.minDamage, state.maxDamage);

  const gearDamageBoost = 1 + getTotalEquipmentStat("damage") / 100;
  const weaponStarBoost = 1 + (state.weaponStarLevel || 0) / 100;
  const dracoBoost = 1 + (state.dracoWeaponScaling || 0) / 100;

  return Math.floor(base * gearDamageBoost * weaponStarBoost * dracoBoost);
}

function hitMonster(id, forcedDamage = null, source = "player", kind = "normal") {
  const monster = state.monsters.find(m => m.id === id);
  if (!monster) return;

  let damage = forcedDamage ?? weaponDamage();

  const isMinotaurHit = source === "summon";

  const researchDamageBoost = 1 + getTotalResearchBonus("damage");
  damage = Math.floor(damage * researchDamageBoost);

  // Guillotine: only normal single Minotaur arrows, not multi-hit or secondary effects.
  if (
    hasSkill("guillotine") &&
    isMinotaurHit &&
    getMonsterHpPercent(monster) <= 15
  ) {
    damage = monster.hp;
    kind = "crit";
    notifyMinotaurEffect("Guillotine", `Executed ${monster.name || "monster"} below 15% HP.`);
  }

  const oldHp = monster.hp;
  monster.hp -= damage;

  const impactX = monster.x + rand(-12, 12);
  const impactY = monster.y + rand(-12, 12);

  showDamage(damage, impactX, impactY, kind);
  showHitImpact(impactX, impactY, kind);
  playMonsterHitReaction(monster.id);

  if (kind === "crit") {
    showCritImpact(impactX, impactY);
  }

  // Burst Arrow: 30% splash damage around target.
  if (hasSkill("burstArrow") && isMinotaurHit && damage > 0) {
    const splashDamage = Math.floor(damage * 0.30);
    const radius = 120;

    const splashTargets = state.monsters
      .filter(m => m.id !== monster.id)
      .filter(m => {
        const dx = m.x - monster.x;
        const dy = m.y - monster.y;
        return Math.sqrt(dx * dx + dy * dy) <= radius;
      })
      .slice(0, 3);

    if (splashTargets.length > 0 && splashDamage > 0) {
      notifyMinotaurEffect(
        "Burst Arrow",
        `Splash damage triggered for ${fmt(splashDamage)} on ${splashTargets.length} target(s).`
      );
    }

    splashTargets.forEach(m => {
      hitMonster(m.id, splashDamage, "summonSplash", "heavyMagic");
    });
  }

  // Ricochet: critical hits bounce once. Bounce cannot crit or trigger effects.
  if (
    hasSkill("ricochet") &&
    isMinotaurHit &&
    kind === "crit" &&
    damage > 0
  ) {
    const bounceTarget = state.monsters.find(m => m.id !== monster.id);

    if (bounceTarget) {
      const bounceDamage = Math.floor(damage * 0.50);

      notifyMinotaurEffect(
        "Ricochet",
        `Arrow bounced to ${bounceTarget.name || "monster"} for ${fmt(bounceDamage)} damage.`
      );

      hitMonster(bounceTarget.id, bounceDamage, "summonRicochet", "normal");
    }
  }

  // Bleeding Critical: crits apply 30% total damage over 3 seconds.
  if (
    hasSkill("bleedingCritical") &&
    isMinotaurHit &&
    kind === "crit" &&
    damage > 0
  ) {
    const bleedTicks = 3;
    const totalBleedDamage = Math.floor(damage * 0.30);
    const tickDamage = Math.floor(totalBleedDamage / bleedTicks);

    if (tickDamage > 0) {
      notifyMinotaurEffect(
        "Bleeding Critical",
        `Bleed applied to ${monster.name || "monster"} for ${fmt(tickDamage * bleedTicks)} total damage.`
      );
    }

    for (let i = 1; i <= bleedTicks; i++) {
      setTimeout(() => {
        const stillExists = state.monsters.find(m => m.id === monster.id);
        if (!stillExists || tickDamage <= 0) return;

        hitMonster(monster.id, tickDamage, "summonBleed", "normal");
      }, i * 1000);
    }
  }

  if (monster.hp <= 0) {
    const overkill = Math.max(0, damage - oldHp);
    const splashPercent = getTotalResearchBonus("overkillSplash");

    killMonster(monster);

    // Stronger Bullets modifier: Overkill spills excess damage to one nearby enemy.
    if (hasSkill("overkill") && isMinotaurHit && overkill > 0) {
      const nextTarget = state.monsters.find(m => m.id !== id);

      if (nextTarget) {
        notifyMinotaurEffect(
          "Overkill",
          `Excess damage spilled to ${nextTarget.name || "monster"} for ${fmt(overkill)} damage.`
        );

        hitMonster(nextTarget.id, overkill, "summonOverkill", "normal");
      }
    }

    // Existing research overkill splash.
    if (overkill > 0 && splashPercent > 0) {
      const splashDamage = Math.floor(overkill * splashPercent);
      const nextTarget = state.monsters.find(m => m.id !== id);

      if (nextTarget && splashDamage > 0) {
        hitMonster(nextTarget.id, splashDamage, "researchSplash", "heavyMagic");
      }
    }

    updateUI();
  } else {
    renderMonster(monster);
  }
}

function getTotalResearchBonus(stat) {
  let total = 0;

  Object.values(state.monsterResearch || {}).forEach(progress => {
    progress.unlocked.forEach(i => {
      const bonus = RESEARCH_MILESTONES[i].bonus;
      if (bonus?.[stat]) total += bonus[stat];
    });
  });

  return total;
}

function renderResearchGridOnly() {
  const grid = document.querySelector(".researchGrid");
  const pageText = document.querySelector(".researchPageControls span");

  if (!grid) return;

  const allMonsters = ALL_MONSTER_NAMES;

  const filteredMonsters = allMonsters.filter(name =>
    name.toLowerCase().includes((researchSearch || "").toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredMonsters.length / RESEARCH_PER_PAGE));

  if (researchPage >= totalPages) researchPage = totalPages - 1;
  if (researchPage < 0) researchPage = 0;

  const start = researchPage * RESEARCH_PER_PAGE;
  const pageMonsters = filteredMonsters.slice(start, start + RESEARCH_PER_PAGE);

  grid.innerHTML = pageMonsters
    .map(monsterName => renderResearchCard(monsterName))
    .join("");

  if (pageText) {
    pageText.textContent = `${researchPage + 1} / ${totalPages}`;
  }
}

async function requestBackendKillReward(monster, multipliers) {
  if (isLocalDevGame?.()) {
    const zone = currentZone();

    const bossMultiplier =
      monster.isUber ? 100 :
      monster.isBoss ? 25 :
      1;

    return {
      gold: Math.floor(
        rand(zone.gold[0], zone.gold[1]) *
        bossMultiplier *
        (multipliers?.goldMultiplier || 1)
      ),

      exp: Math.floor(
        rand(zone.exp[0], zone.exp[1]) *
        bossMultiplier *
        (multipliers?.expMultiplier || 1)
      ),

      loot: {
        materials: {},
        equipmentDrops: 0,
        treasureChests: 0,
        goldenTreasureChests: 0,
        equipmentItems: []
      }
    };
  }

  const token = getAuthToken?.();

  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/combat/kill`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        zoneId: state.zoneId,
        combatToken: monster.combatToken
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.warn("Backend kill reward failed:", data.message || data.error);
      return null;
    }

    return data.reward;
  } catch (error) {
    console.warn("Backend kill reward request failed:", error);
    return null;
  }
}

function applyBackendLoot(loot, monster) {
  if (!loot) return;

  if (!state.materials) {
    state.materials = { ...DEFAULT_MATERIALS };
  }

  const materialColors = {
    greenEssence: "#35d66b",
    blueEssence: "#3aa7ff",
    yellowEssence: "#ffd43b",
    redEssence: "#ff4d4d",
    whetstones: "#d6d6d6"
  };

  const materialNames = {
    greenEssence: "Green Essence",
    blueEssence: "Blue Essence",
    yellowEssence: "Yellow Essence",
    redEssence: "Red Essence",
    whetstones: "Whetstone"
  };

  Object.entries(loot.materials || {}).forEach(([key, amount]) => {
    if (!amount || amount <= 0) return;

    state.materials[key] = (state.materials[key] || 0) + amount;

    if (key === "whetstones") {
      showFilterNotification(
        "salvage",
        amount > 1 ? `🔨 Found ${amount} Whetstones!` : "🔨 Found a Whetstone!"
      );
    } else {
      addLog(`🧪 ${materialNames[key] || key} dropped.`, "loot");
      showEssenceDropEffect(
        monster.x,
        monster.y,
        materialColors[key] || "#ffffff",
        `+${amount} ${materialNames[key] || key}`
      );
    }
  });

  if (loot.treasureChests > 0) {
    addInventoryItem("treasureChest", loot.treasureChests);
  }

  if (loot.goldenTreasureChests > 0) {
    addInventoryItem("goldenTreasureChest", loot.goldenTreasureChests);

    showFilterNotification(
      "loot",
      "🟨 Golden Treasure Chest dropped!"
    );
  }

  if (Array.isArray(loot.equipmentItems) && loot.equipmentItems.length > 0) {
  loot.equipmentItems.forEach(item => {
    const inserted = addItemToDepot(item);

    if (inserted) {
      addLog(`🧩 ${item.rarityName} ${item.name} dropped!`, "loot");
    } else {
      addLog("⚠️ Depot full. Item lost.", "system");
    }
  });

  if (document.getElementById("depotPanel")?.style.display === "block") {
    renderDepotPanel();
    injectPanelHero?.("depotPanel");
  }
}

  renderBackpack?.();
  renderBlacksmithPanel?.();
}

async function killMonster(monster) {
  if (monster.isBoss) {
    addSkinProgress?.("bossKills", 1);
  }

  if (!state.monsterResearch) state.monsterResearch = {};

  if (!state.monsterResearch[monster.name]) {
    state.monsterResearch[monster.name] = {
      kills: 0,
      unlocked: []
    };
  }

  const progress = state.monsterResearch[monster.name];

  let killsGained = 1;

  if (isResearchBreakthroughActive()) {
    killsGained *= 3;
  }

  const echoChance = getTotalEquipmentStat("researchEcho") / 100;

  if (Math.random() < echoChance) {
    killsGained *= 2;
  }

  progress.kills += killsGained;

  RESEARCH_MILESTONES.forEach((milestone, index) => {
    if (
      progress.kills >= milestone.kills &&
      !progress.unlocked.includes(index)
    ) {
      progress.unlocked.push(index);

      showFilterNotification(
        "salvage",
        `📖 ${monster.name}: ${milestone.desc}`
      );
    }
  });

  const skillGoldBoost = 1 + (state.skills.deepPockets || 0) * 0.10;
  const skillExpBoost = 1 + (state.skills.experiencedHunter || 0) * 0.10;

  const potionGoldBoost = isPotionActive("wealthUntil") ? 1.25 : 1;
  const potionExpBoost = isPotionActive("wisdomUntil") ? 1.25 : 1;

  const researchGoldBoost = 1 + getTotalResearchBonus("gold");
  const researchExpBoost = 1 + getTotalResearchBonus("exp");

  const fishingGoldBoost = getFishingGoldGainBonus?.() || 1;
  const fishingExpBoost = getFishingExpGainBonus?.() || 1;

  const phoenixBoost = getPhoenixBonusMultiplier();

  const skinBossBonus = monster.isBoss
    ? 1 + (getActiveMinotaurSkinBonus?.("bossRewards") || 0)
    : 1;

  const uberLootMultiplier = monster.isUber
    ? getUberLootBonusMultiplier()
    : 1;

  const uberExpMultiplier = monster.isUber
    ? getUberExpBonusMultiplier()
    : 1;

  const goldMultiplier =
    skillGoldBoost *
    potionGoldBoost *
    researchGoldBoost *
    phoenixBoost *
    fishingGoldBoost *
    skinBossBonus *
    uberLootMultiplier;

  const expMultiplier =
    skillExpBoost *
    potionExpBoost *
    researchExpBoost *
    phoenixBoost *
    fishingExpBoost *
    skinBossBonus *
    uberExpMultiplier;

  const essenceMultiplier =
  (1 + (state.skills.materialistic || 0) * 0.02) *
  (1 + getTotalResearchBonus("materials"));

const bossLootMultiplier =
  monster.isBoss
    ? 1 + (state.skills.lootHungry || 0) * 0.05
    : 1;

const equipmentDropMultiplier =
  (1 + (state.skills.gearingUp || 0) * 0.10) *
  (1 + getTotalResearchBonus("rareDrops")) *
  (1 + getTotalEquipmentStat("lootChance") / 100);

const whetstoneDropMultiplier =
  (1 + getTotalResearchBonus("rareDrops")) *
  (1 + getTotalEquipmentStat("lootChance") / 100) *
  (1 + getTotalEquipmentStat("whetstoneChance") / 100);

const doubleDropChance =
  getTotalEquipmentStat("doubleDrop") / 100;

const extraUberLootRolls =
  monster.isUber ? getUberExtraLootRolls() : 0;

const reward = await requestBackendKillReward(monster, {
  goldMultiplier,
  expMultiplier,

  essenceMultiplier,
  bossLootMultiplier,
  equipmentDropMultiplier,
  whetstoneDropMultiplier,
  doubleDropChance,
  extraUberLootRolls
});

  if (!reward) {
    showFilterNotification("system", "⚠ Kill reward failed. Server rejected reward.");
    return;
  }

  const goldGain = reward.gold || 0;
  const expGain = reward.exp || 0;

  state.gold += goldGain;
  state.exp += expGain;

  if (!state.stats) state.stats = {};

  state.stats.monstersKilled = (state.stats.monstersKilled || 0) + 1;

  recordKillForOfflineRate?.();

  state.stats.goldEarned = (state.stats.goldEarned || 0) + goldGain;
  state.stats.expEarned = (state.stats.expEarned || 0) + expGain;

  addLog(
    `${monster.isUber ? "💀 [UBER BOSS]" : monster.isBoss ? "👑 [BOSS]" : "🪙"} ${monster.name} killed. +${fmt(goldGain)} gold, +${fmt(expGain)} exp.`,
    "combat"
  );

  applyBackendLoot(reward.loot, monster);

  state.monsters = state.monsters.filter(m => m.id !== monster.id);

  const el = document.querySelector(`[data-monster-id="${monster.id}"]`);
  if (el) el.remove();

  checkLevelUp();

  const researchPanel = document.getElementById("researchPanel");

  if (researchPanel && researchPanel.style.display === "block") {
    renderResearchPanel();
    injectPanelHero("researchPanel");
  }

  const scorePanel = document.getElementById("scorePanel");

  if (scorePanel && scorePanel.style.display === "block") {
    renderScorePanel();
  }

  updateUI();
  saveGame();
}

function rollTreasureChestDrop(monster) {
  let chance = 0.002; // 0.2%

  if (monster.isBoss) chance = 0.05;
  if (monster.isUber) chance = 0.25;

  if (Math.random() >= chance) return;

  addInventoryItem("treasureChest", 1);
}

function rollEssenceDrops(x, y, monster = null) {
  const essenceBoost = 1 + (state.skills.materialistic || 0) * 0.02;
  const researchMaterialBoost = 1 + getTotalResearchBonus("materials");

  const bossDropBoost = monster && monster.isBoss
    ? 1 + (state.skills.lootHungry || 0) * 0.05
    : 1;

  const doubleDropChance = getTotalEquipmentStat("doubleDrop") / 100;

  const drops = [
    { key: "greenEssence", name: "Green Essence", short: "Green", chance: 0.01 * essenceBoost * bossDropBoost * researchMaterialBoost, color: "#35d66b" },
    { key: "blueEssence", name: "Blue Essence", short: "Blue", chance: 0.005 * essenceBoost * bossDropBoost * researchMaterialBoost, color: "#3aa7ff" },
    { key: "yellowEssence", name: "Yellow Essence", short: "Yellow", chance: 0.0025 * essenceBoost * bossDropBoost * researchMaterialBoost, color: "#ffd43b" },
    { key: "redEssence", name: "Red Essence", short: "Red", chance: 0.001 * essenceBoost * bossDropBoost * researchMaterialBoost, color: "#ff4d4d" }
  ];

  drops.forEach(drop => {
    if (Math.random() < drop.chance) {
      if (!state.materials) state.materials = { ...DEFAULT_MATERIALS };

      let amount = 1;

      if (Math.random() < doubleDropChance) {
        amount++;
      }

      state.materials[drop.key] = (state.materials[drop.key] || 0) + amount;

      addLog(`🧪 ${drop.name} dropped.`, "loot");
      showEssenceDropEffect(x, y, drop.color, `+${amount} ${drop.short}`);
    }
  });
}

function rollBossEssenceDrops(x, y, isUber = false) {
  if (!state.materials) state.materials = { ...DEFAULT_MATERIALS };

  const doubleDropChance = getTotalEquipmentStat("doubleDrop") / 100;

  const extraUberRolls = isUber ? getUberExtraLootRolls() : 0;
  const guaranteedRolls = (isUber ? rand(6, 10) : rand(2, 4)) + extraUberRolls;

  const uberLootMultiplier = isUber ? getUberLootBonusMultiplier() : 1;

  const bossEssencePool = [
    { key: "greenEssence", name: "Green", min: 1, max: 3, weight: 60, color: "#35d66b" },
    { key: "blueEssence", name: "Blue", min: 1, max: 2, weight: 35, color: "#3aa7ff" },
    { key: "yellowEssence", name: "Yellow", min: 1, max: 1, weight: 18, color: "#ffd43b" },
    { key: "redEssence", name: "Red", min: 1, max: 1, weight: 6, color: "#ff4d4d" }
  ];

  const totalWeight = bossEssencePool.reduce((sum, drop) => sum + drop.weight, 0);
  const dropSummary = {};

  for (let i = 0; i < guaranteedRolls; i++) {
    let roll = Math.random() * totalWeight;
    let selected = bossEssencePool[0];

    for (const drop of bossEssencePool) {
      roll -= drop.weight;
      if (roll <= 0) {
        selected = drop;
        break;
      }
    }

    let amount = rand(selected.min, selected.max);

    if (isUber) {
      const boostedAmount = amount * uberLootMultiplier;
      const guaranteedAmount = Math.floor(boostedAmount);
      const bonusChance = boostedAmount - guaranteedAmount;

      amount = guaranteedAmount;

      if (Math.random() < bonusChance) {
        amount += 1;
      }

      amount = Math.max(1, amount);
    }

    if (Math.random() < doubleDropChance) {
      amount *= 2;
    }

    if (!dropSummary[selected.key]) {
      dropSummary[selected.key] = {
        key: selected.key,
        name: selected.name,
        amount: 0,
        color: selected.color
      };
    }

    dropSummary[selected.key].amount += amount;

    showEssenceDropEffect(x, y, selected.color, `+${amount} ${selected.name}`);
  }

  const parts = [];

  Object.values(dropSummary).forEach(drop => {
    state.materials[drop.key] = (state.materials[drop.key] || 0) + drop.amount;
    parts.push(`${drop.amount} ${drop.name}`);
  });

  if (parts.length > 0) {
    addLog(`${isUber ? "💀 Uber Boss" : "👑 Boss"} dropped: ${parts.join(", ")}`, "loot");
  }
}

function rollLoot() {
  if (Math.random() > 0.16) return;

  const loot = ["Hell Token", "Eye Fragment", "Rusty Gear", "Blue Crystal"][rand(0, 3)];
  addLog(`🎁 ${loot} dropped!`, "loot");
}

function getLevelCap() {
  return 300 + (state.rebirth.count * 50);
}

function checkLevelUp() {
  const cap = getLevelCap();

  while (state.exp >= expNeeded() && state.level < cap) {
    state.exp -= expNeeded();

    const newLevel = state.level + 1;

    // Skill point rules
    if (newLevel <= 50) {
      state.skillPoints++;
    } else if (newLevel % 3 === 0) {
      state.skillPoints++;
    }

    state.level = newLevel;
  }

  if (state.level >= cap) {
    state.level = cap;
    state.exp = 0;
  }
}

function buyWeapon(name) {
  const weapon = WEAPONS.find(w => w.name === name);
  if (!weapon) return;

  if (state.level < weapon.levelReq) {
    addLog(`You need level ${weapon.levelReq} to use ${weapon.name}.`);
    return;
  }

  if (state.gold < weapon.cost) {
    addLog(`Not enough gold to buy ${weapon.name}.`);
    return;
  }

  if (ownsWeapon(name)) {
    addLog(`You already own ${weapon.name}.`);
    return;
  }

  state.gold -= weapon.cost;
  state.ownedWeapons.push(name);
  state.equippedWeapon = name;

  addLog(`⚔ Bought and equipped ${weapon.name}.`);

  updateUI();
  renderWeaponList(); // FIX
  saveGame();
}

function equipWeapon(name) {
  if (!ownsWeapon(name)) {
    addLog(`You don't own ${name}.`);
    return;
  }

  if (state.equippedWeapon === name) {
    addLog(`${name} is already equipped.`);
    return;
  }

  state.equippedWeapon = name;

  addLog(`⚔ Equipped ${name}.`);

  updateUI();
  renderWeaponList(); // FIX
  saveGame();
}

function hasRebirthUpgrade(key) {
  return (state.rebirthUpgrades?.[key] || 0) > 0;
}

function getNextAffordableWeapon() {
  return WEAPONS.find(weapon =>
    state.level >= weapon.levelReq &&
    !ownsWeapon(weapon.name) &&
    state.gold >= weapon.cost
  );
}

function autoBuyWeapons() {
  ensureAutomationToggles();

  if (!state.automationToggles.autoBuy) return;

  const unlocked =
    state.rebirthUpgrades?.autoBuy > 0 ||
    state.rebirthUpgrades?.weaponUpgrader > 0 ||
    state.rebirthUpgrades?.autoWeapons > 0;

  if (!unlocked) return;

  const weapon = getNextAffordableWeapon();
  if (!weapon) return;

  // Safety: ensure array exists
  if (!Array.isArray(state.ownedWeapons)) {
    state.ownedWeapons = [];
  }

  state.gold -= weapon.cost;
  state.ownedWeapons.push(weapon.name);
  state.equippedWeapon = weapon.name;

  showFilterNotification(
    "system",
    `⚔ Auto-bought and equipped ${weapon.name}.`
  );

  updateUI();
  saveGame();
}

function autoTravelZones() {
  ensureAutomationToggles();
  if (!state.automationToggles.autoTravel) return;
  
  const unlocked =
  state.rebirthUpgrades?.autoTravel > 0 ||
  state.rebirthUpgrades?.automaticTravelling > 0;

if (!unlocked) return;

  const availableZones = ZONES
    .filter(zone => state.level >= zone.levelReq)
    .sort((a, b) => b.levelReq - a.levelReq);

  const bestZone = availableZones[0];
  if (!bestZone) return;

  if (state.zoneId === bestZone.id) return;

  travelToZone(bestZone.id);

  addLog(`🌍 Auto-traveled to ${bestZone.name}.`, "system");
}

function autoAllocateSkills() {
  ensureAutomationToggles();

  if (!state.automationToggles.autoSkills) return;

  const unlocked =
    state.rebirthUpgrades?.autoSkills > 0 ||
    state.rebirthUpgrades?.skillsImprovement > 0;

  if (!unlocked) return;
  if ((state.skillPoints || 0) <= 0) return;

  const priority = [
  // =====================
  // 1. MINOTAUR → needs 20 points to unlock Spells
  // =====================
  "sharpshooter",
  "powerBolt",
  "doubleStrike",
  "tripleStrike",
  "headshot",
  "strongerBullets",

  // =====================
  // 2. SPELLS → needs 20 points to unlock Economy
  // =====================
  "unlockFireball",
  "fireballDamage",
  "fireballCooldown",

  "unlockLightMagic",
  "lightMagicDamage",
  "lightMagicCooldown",

  "unlockHeavyMagic",
  "heavyMagicDamage",
  "heavyMagicCooldown",

  // =====================
  // 3. ECONOMY → needs 20 points to unlock Necromancer
  // =====================
  "deepPockets",
  "experiencedHunter",
  "materialistic",
  "gearingUp",
  "likeABoss",
  "lootHungry",
  "uberDifficulty",

  // =====================
  // 4. NECROMANCER
  // =====================
  "graveCalling",
  "skeletonMastery",
  "skeletonReach",
  "walkingDead",
  "reanimation",
  "eliteSkeleton",
  "boneArmor",

  "darkNovaDamage",
  "darkNovaTargets",
  "decay",
  "deathEcho",
  "overchannel"
];

  let spentAny = false;
  let spentCount = 0;

  while (state.skillPoints > 0) {
    const nextSkillKey = priority.find(key => {
      const skill = Object.values(SKILLS).flat().find(s => s.key === key);
      if (!skill) return false;

      const current = state.skills?.[key] || 0;
      const max = getSkillMax(skill);

      if (current >= max) return false;

      // Important: this allows 0/10 skills to be started automatically.
      if (!canUnlockNode(key)) return false;

      return true;
    });

    if (!nextSkillKey) break;

    clickSkillNode(nextSkillKey);
    spentAny = true;
    spentCount++;
  }

  if (spentAny) {
    showFilterNotification(
      "salvage",
      `⚡ Auto Skill Allocator spent ${spentCount} skill point${spentCount === 1 ? "" : "s"}.`
    );

    updateUI();
    saveGame();
  }
}

function summonDamage() {
  return Math.floor(weaponDamage() * (1 + (state.skills.powerBolt || 0) * 0.20));
}

function summonInterval() {
  const base = 1000;

  const sharpshooterMultiplier = Math.pow(0.92, state.skills.sharpshooter || 0);
  const swiftnessMultiplier = isPotionActive("swiftnessUntil") ? 0.90 : 1;
  const gearSpeedMultiplier = 1 - Math.min(0.75, getTotalEquipmentStat("attackSpeed") / 100);

  let interval = base * sharpshooterMultiplier * swiftnessMultiplier * gearSpeedMultiplier;

  // Orion burst
  if (Date.now() < (state.temporaryBuffs?.orionBurstUntil || 0)) {
    const level = state.constellations?.orion || 0;
    const burstMultiplier = 1 + level * 0.01; // up to 50% faster at 50/50
    interval = interval / burstMultiplier;
  }

  return Math.max(250, interval);
}

function summonCritMultiplier() {
  const base = 2;
  const skillBonus = (state.skills.strongerBullets || 0) * 0.20;

  const gearBonus = getTotalEquipmentStat("critDamage") / 100;

  return base + skillBonus + gearBonus;
}

function rollSummonDamage(arrowIndex = 0) {
  let damage = summonDamage();

  const skillCrit = (state.skills.headshot || 0) * 0.01;
  const gearCrit = getTotalEquipmentStat("critChance") / 100;

  let critChance = skillCrit + gearCrit;

  // Follow-Up: second arrow gains +25% critical chance.
  if (hasSkill("followUp") && arrowIndex === 1) {
    critChance += 0.25;
  }

  const critical = Math.random() < critChance;

  if (critical) {
    damage = Math.floor(damage * summonCritMultiplier());
  }

  damage *= getTotalSummonDamageMultiplier();
  damage = Math.floor(damage);

  return { damage, critical };
}

function getPrimarySummonTarget() {
  if (!state.monsters.length) return null;

  // Always prioritize bosses
  const bossTarget = state.monsters.find(monster => monster.isBoss);

  if (bossTarget) {
    state.summonTargetId = bossTarget.id;
    return bossTarget;
  }

  const existingTarget = state.monsters.find(monster => monster.id === state.summonTargetId);

  if (existingTarget) {
    return existingTarget;
  }

  const nextTarget = state.monsters[0];
  state.summonTargetId = nextTarget.id;

  return nextTarget;
}

function getSummonTargets() {
  const targets = [];
  const primaryTarget = getPrimarySummonTarget();

  if (!primaryTarget) return targets;

  targets.push(primaryTarget);

  const possibleExtraTargets = state.monsters.filter(monster => monster.id !== primaryTarget.id);

  const doubleTriggered = Math.random() < (state.skills.doubleStrike || 0) * 0.10;
  const tripleTriggered = Math.random() < (state.skills.tripleStrike || 0) * 0.05;

  const sagittariusChance = Math.min(1, (state.constellations?.sagittarius || 0) * 0.05);

  if (doubleTriggered) {
    if (hasSkill("focusedDouble")) {
      targets.push(primaryTarget);
      notifyMinotaurEffect("Focused Double", "Second arrow redirected to the primary target.");
    } else if (possibleExtraTargets[0]) {
      targets.push(possibleExtraTargets[0]);

      if (sagittariusChance > 0 && Math.random() < sagittariusChance) {
        targets.push(primaryTarget);
        notifyMinotaurEffect("Sagittarius", "Double Strike also hit the primary target.");
      }
    }
  }

  if (tripleTriggered) {
    if (hasSkill("focusedBarrage")) {
      targets.push(primaryTarget);
      notifyMinotaurEffect("Focused Barrage", "Third arrow redirected to the primary target.");
    } else if (possibleExtraTargets[1]) {
      targets.push(possibleExtraTargets[1]);

      if (sagittariusChance > 0 && Math.random() < sagittariusChance) {
        targets.push(primaryTarget);
        notifyMinotaurEffect("Sagittarius", "Triple Strike also hit the primary target.");
      }
    } else if (possibleExtraTargets[0]) {
      targets.push(possibleExtraTargets[0]);

      if (sagittariusChance > 0 && Math.random() < sagittariusChance) {
        targets.push(primaryTarget);
        notifyMinotaurEffect("Sagittarius", "Triple Strike also hit the primary target.");
      }
    }
  }

  return targets;
}

function necromancerUnlocked() {
  return state.rebirthUpgrades?.necromancer > 0;
}

function getNecromancerTargets() {
  const bonusTargets = state.skills.darkNovaTargets || 0;
  const maxTargets = 3 + bonusTargets;

  return state.monsters.slice(0, maxTargets);
}

function handleNecromancerAttack(now) {
  if (state.settings?.necromancerAttacks === false) return;
  if (!necromancerUnlocked()) return;
  if (!state.monsters.length) return;

  if (
    now - (state.lastNecromancerAttack || 0) <
    necromancerInterval()
  ) {
    return;
  }

  state.lastNecromancerAttack = now;

  const targets = getNecromancerTargets();
  if (!targets.length) return;

  let damage = necromancerDamage();

  damage *= getTotalSummonDamageMultiplier();
  damage = Math.floor(damage);

  targets.forEach(target => {
    spawnNecromancerProjectile(target, () => {
      const stillExists = state.monsters.find(
        m => m.id === target.id
      );

      if (!stillExists) return;

      hitMonster(
        target.id,
        damage,
        "necromancer",
        "heavyMagic"
      );

      applyDecay(target.id, damage);

      handleNecromancerSpawn(
        stillExists.x,
        stillExists.y
      );
    });
  });

  triggerDeathEcho(targets, damage);
}

function cleanupSkeletons(now) {
  if (!state.skeletons) {
    state.skeletons = [];
    document.querySelectorAll(".skeletonSummon").forEach(el => el.remove());
    return;
  }

  const before = state.skeletons.length;

  state.skeletons = state.skeletons.filter(skeleton =>
    Number.isFinite(skeleton.x) &&
    Number.isFinite(skeleton.y) &&
    skeleton.expiresAt > now
  );

  if (state.skeletons.length !== before) {
    renderSkeletons();
  }
}