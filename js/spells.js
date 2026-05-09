function isUnlocked(key) {
  return (state.skills[key] || 0) >= 5;
}

function fireballMultiplier() {
  return 2 + (state.skills.fireballDamage || 0) * 0.5;
}

function lightMagicMultiplier() {
  return 3 + (state.skills.lightMagicDamage || 0) * 0.5;
}

function heavyMagicMultiplier() {
  return 1.5 + (state.skills.heavyMagicDamage || 0) * 0.5;
}

function fireballCooldownMs() {
  return Math.max(1000, (20 - (state.skills.fireballCooldown || 0)) * 1000 * swiftnessMultiplier());
}

function lightMagicCooldownMs() {
  return Math.max(1000, (25 - (state.skills.lightMagicCooldown || 0)) * 1000 * swiftnessMultiplier());
}

function heavyMagicCooldownMs() {
  return Math.max(1000, (30 - (state.skills.heavyMagicCooldown || 0)) * 1000 * swiftnessMultiplier());
}

function spellDamage(multiplier) {
  return Math.floor(weaponDamage() * multiplier);
}

function spellRemainingMs(spellKey) {
  const now = Date.now();

  if (spellKey === "fireball") {
    return Math.max(0, fireballCooldownMs() - (now - state.lastSpellCast.fireball));
  }

  if (spellKey === "lightMagic") {
    return Math.max(0, lightMagicCooldownMs() - (now - state.lastSpellCast.lightMagic));
  }

  if (spellKey === "heavyMagic") {
    return Math.max(0, heavyMagicCooldownMs() - (now - state.lastSpellCast.heavyMagic));
  }

  return 0;
}

function ensureSpellEffectStyles() {
  if (document.getElementById("spellEffectStyles")) return;

  const style = document.createElement("style");
  style.id = "spellEffectStyles";
  style.textContent = `
    .fireballExplosion {
      position: absolute;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 35;
      animation: fireballExplosionAnim 520ms ease-out forwards;
      background:
        radial-gradient(circle, rgba(255,255,255,.95) 0%, rgba(255,230,120,.75) 14%, rgba(255,90,20,.55) 36%, rgba(160,20,0,.3) 62%, transparent 75%);
      box-shadow: 0 0 35px rgba(255,90,20,.9);
    }

    .fireballRing {
      position: absolute;
      border-radius: 50%;
      border: 3px solid rgba(255,150,40,.9);
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 34;
      animation: fireballRingAnim 620ms ease-out forwards;
    }

    .missileImpact {
      position: absolute;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 39;
      animation: missileImpactAnim 360ms ease-out forwards;
    }

    .missileImpact.light {
      background: radial-gradient(circle, rgba(255,255,255,1), rgba(120,220,255,.75), rgba(40,120,255,.3), transparent 74%);
      box-shadow: 0 0 22px rgba(120,220,255,1);
    }

    .missileImpact.heavy {
      width: 54px;
      height: 54px;
      background: radial-gradient(circle, rgba(255,255,255,1), rgba(190,90,255,.85), rgba(80,30,190,.45), transparent 76%);
      box-shadow: 0 0 30px rgba(180,90,255,1);
    }

    .missileSpark {
      position: absolute;
      width: 4px;
      height: 18px;
      border-radius: 4px;
      transform-origin: center bottom;
      pointer-events: none;
      z-index: 40;
      animation: missileSparkAnim 420ms ease-out forwards;
    }

    @keyframes fireballExplosionAnim {
      0% { opacity: 1; scale: .25; }
      55% { opacity: 1; scale: 1; }
      100% { opacity: 0; scale: 1.25; }
    }

    @keyframes fireballRingAnim {
      0% { opacity: 1; scale: .35; }
      100% { opacity: 0; scale: 1.25; }
    }

    @keyframes missileImpactAnim {
      0% { opacity: 1; scale: .35; }
      100% { opacity: 0; scale: 1.5; }
    }

    @keyframes missileSparkAnim {
      0% { opacity: 1; transform: translate(-50%, -50%) rotate(var(--angle)) translateY(0); }
      100% { opacity: 0; transform: translate(-50%, -50%) rotate(var(--angle)) translateY(-32px); }
    }
  `;

  document.head.appendChild(style);
}

function showFireballExplosion(x, y, radius, targetsHit = 1) {
  ensureSpellEffectStyles();

  const flameCount = 18 + Math.min(10, targetsHit * 2);
  const emberCount = 10 + Math.min(8, targetsHit);

  // Core flash
  const core = document.createElement("div");
  core.style.position = "absolute";
  core.style.left = x + "px";
  core.style.top = y + "px";
  core.style.width = "46px";
  core.style.height = "46px";
  core.style.borderRadius = "50%";
  core.style.transform = "translate(-50%, -50%)";
  core.style.pointerEvents = "none";
  core.style.zIndex = 39;
  core.style.background = `
    radial-gradient(circle,
      rgba(255,255,230,1) 0%,
      rgba(255,210,80,0.9) 28%,
      rgba(255,90,20,0.55) 58%,
      transparent 100%)
  `;
  core.style.boxShadow = "0 0 28px rgba(255,120,30,.95)";
  arena.appendChild(core);

  core.animate([
    { transform: "translate(-50%, -50%) scale(0.4)", opacity: 1 },
    { transform: "translate(-50%, -50%) scale(1.5)", opacity: 0 }
  ], {
    duration: 260,
    easing: "ease-out",
    fill: "forwards"
  });

  setTimeout(() => core.remove(), 320);

  // Flame tongues
  for (let i = 0; i < flameCount; i++) {
    const flame = document.createElement("div");

    const size = rand(14, 34);
    const angle = Math.random() * Math.PI * 2;
    const distance = rand(20, radius * 0.65);
    const startX = x + Math.cos(angle) * rand(0, 16);
    const startY = y + Math.sin(angle) * rand(0, 12);

    const endX = x + Math.cos(angle) * distance;
    const endY = y + Math.sin(angle) * distance - rand(8, 30);

    const duration = rand(350, 700);
    const delay = rand(0, 80);

    flame.style.position = "absolute";
    flame.style.left = startX + "px";
    flame.style.top = startY + "px";
    flame.style.width = size + "px";
    flame.style.height = Math.floor(size * 1.5) + "px";
    flame.style.borderRadius = "55% 55% 45% 45%";
    flame.style.transform = "translate(-50%, -50%)";
    flame.style.pointerEvents = "none";
    flame.style.zIndex = 38;
    flame.style.filter = "blur(1px)";
    flame.style.background = `
      radial-gradient(circle at 50% 75%,
        rgba(255,255,190,0.95) 0%,
        rgba(255,190,40,0.85) 25%,
        rgba(255,70,15,0.65) 55%,
        rgba(120,10,0,0.25) 78%,
        transparent 100%)
    `;
    flame.style.boxShadow = "0 0 18px rgba(255,95,20,.8)";

    arena.appendChild(flame);

    flame.animate([
      {
        transform: "translate(-50%, -50%) scale(0.4) rotate(0deg)",
        opacity: 1
      },
      {
        transform: `translate(${endX - startX - 50}%, ${endY - startY - 50}%) scale(1.35) rotate(${rand(-35, 35)}deg)`,
        opacity: 0
      }
    ], {
      duration,
      delay,
      easing: "ease-out",
      fill: "forwards"
    });

    setTimeout(() => flame.remove(), duration + delay + 50);
  }

  // Embers
  for (let i = 0; i < emberCount; i++) {
    const ember = document.createElement("div");

    const angle = Math.random() * Math.PI * 2;
    const distance = rand(35, radius);
    const driftX = Math.cos(angle) * distance;
    const driftY = Math.sin(angle) * distance - rand(15, 50);
    const size = rand(3, 6);
    const duration = rand(550, 1000);
    const delay = rand(50, 180);

    ember.style.position = "absolute";
    ember.style.left = x + "px";
    ember.style.top = y + "px";
    ember.style.width = size + "px";
    ember.style.height = size + "px";
    ember.style.borderRadius = "50%";
    ember.style.pointerEvents = "none";
    ember.style.zIndex = 40;
    ember.style.background = "#ffd45a";
    ember.style.boxShadow = "0 0 10px #ff8c1a";

    arena.appendChild(ember);

    ember.animate([
      {
        transform: "translate(-50%, -50%) scale(1)",
        opacity: 1
      },
      {
        transform: `translate(${driftX}px, ${driftY}px) scale(0.2)`,
        opacity: 0
      }
    ], {
      duration,
      delay,
      easing: "ease-out",
      fill: "forwards"
    });

    setTimeout(() => ember.remove(), duration + delay + 50);
  }

  // Heat ring / shockwave
  const ring = document.createElement("div");
  ring.style.position = "absolute";
  ring.style.left = x + "px";
  ring.style.top = y + "px";
  ring.style.width = radius * 1.4 + "px";
  ring.style.height = radius * 1.4 + "px";
  ring.style.borderRadius = "50%";
  ring.style.border = "2px solid rgba(255,140,40,.65)";
  ring.style.transform = "translate(-50%, -50%)";
  ring.style.pointerEvents = "none";
  ring.style.zIndex = 34;

  arena.appendChild(ring);

  ring.animate([
    {
      transform: "translate(-50%, -50%) scale(0.3)",
      opacity: 0.8
    },
    {
      transform: "translate(-50%, -50%) scale(1.8)",
      opacity: 0
    }
  ], {
    duration: 520,
    easing: "ease-out",
    fill: "forwards"
  });

  setTimeout(() => ring.remove(), 600);
}

function showMissileImpact(x, y, type = "light") {
  ensureSpellEffectStyles();

  const impact = document.createElement("div");
  impact.className = `missileImpact ${type}`;
  impact.style.left = x + "px";
  impact.style.top = y + "px";
  arena.appendChild(impact);

  const sparkColor = type === "heavy" ? "#c470ff" : "#9eefff";
  const sparkCount = type === "heavy" ? 8 : 5;

  for (let i = 0; i < sparkCount; i++) {
    const spark = document.createElement("div");
    spark.className = "missileSpark";
    spark.style.left = x + "px";
    spark.style.top = y + "px";
    spark.style.background = sparkColor;
    spark.style.boxShadow = `0 0 8px ${sparkColor}`;
    spark.style.setProperty("--angle", `${(360 / sparkCount) * i}deg`);
    arena.appendChild(spark);

    setTimeout(() => spark.remove(), 500);
  }

  setTimeout(() => impact.remove(), 460);
}

function castLightMagic(now) {
  if (!state.lastSpellCast) {
    state.lastSpellCast = { fireball: 0, lightMagic: 0, heavyMagic: 0 };
  }

  if ((state.skills?.unlockLightMagic || 0) <= 0) return;
  if (now - state.lastSpellCast.lightMagic < lightMagicCooldownMs()) return;
  if (state.monsters.length === 0) return;

  state.lastSpellCast.lightMagic = now;

  const target = state.monsters[rand(0, state.monsters.length - 1)];
  const damage = spellDamage(lightMagicMultiplier());

  showMissileImpact(target.x, target.y, "light");

  showFilterNotification(
  "combat",
  `✨ Light Magic dealt ${fmt(damage)} damage to ${target.name}.`
);

  hitMonster(target.id, damage, "spell", "lightMagic");
}

function castHeavyMagic(now) {
  if (!state.lastSpellCast) {
    state.lastSpellCast = { fireball: 0, lightMagic: 0, heavyMagic: 0 };
  }

  if ((state.skills?.unlockHeavyMagic || 0) <= 0) return;
  if (now - state.lastSpellCast.heavyMagic < heavyMagicCooldownMs()) return;
  if (state.monsters.length === 0) return;

  state.lastSpellCast.heavyMagic = now;

  const targets = [...state.monsters].sort(() => Math.random() - 0.5).slice(0, 3);
  const damage = spellDamage(heavyMagicMultiplier());

  showFilterNotification(
  "combat",
  `🌠 Heavy Magic dealt ${fmt(damage)} damage to ${targets.length} target(s).`
);

  targets.forEach(target => {
    showMissileImpact(target.x, target.y, "heavy");
    hitMonster(target.id, damage, "spell", "heavyMagic");
  });
}

function castFireball(now) {
  if (!state.lastSpellCast) {
    state.lastSpellCast = { fireball: 0, lightMagic: 0, heavyMagic: 0 };
  }

  if ((state.skills?.unlockFireball || 0) <= 0) return;
  if (now - state.lastSpellCast.fireball < fireballCooldownMs()) return;
  if (state.monsters.length === 0) return;

  const radius = 120;
  let bestMain = state.monsters[0];
  let bestTargets = [bestMain];

  for (const candidate of state.monsters) {
    const targets = state.monsters.filter(monster => {
      const dx = monster.x - candidate.x;
      const dy = monster.y - candidate.y;
      return Math.sqrt(dx * dx + dy * dy) <= radius;
    });

    if (targets.length > bestTargets.length) {
      bestMain = candidate;
      bestTargets = targets;
    }
  }

  state.lastSpellCast.fireball = now;

  const damage = spellDamage(fireballMultiplier());

  showFireballExplosion(bestMain.x, bestMain.y, radius, bestTargets.length);

  showFilterNotification(
  "combat",
  `🔥 Fireball dealt ${fmt(damage)} damage to ${bestTargets.length} target(s).`
);

  bestTargets.forEach(target => {
    hitMonster(target.id, damage, "spell", "fireball");
  });
}