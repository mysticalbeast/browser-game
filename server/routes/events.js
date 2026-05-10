const express = require("express");

const router = express.Router();

const SIEGE_DURATION_MS = 15 * 60 * 1000;
const SIEGE_CHECK_INTERVAL_MS = 60 * 1000; // testing
const SIEGE_START_CHANCE = 1.0; // testing
const SIEGE_SPAWN_INTERVAL_MS = 2500;

const SIEGE_ZONES = [
  { id: 9998, name: "Siege Battlefield" }
];

let globalEvents = {
  siege: {
    active: false,
    zoneId: null,
    zoneName: "",
    endsAt: 0,
    nextCheckAt: Date.now() + SIEGE_CHECK_INTERVAL_MS,

    wallHp: 0,
    wallMaxHp: 0,

    kills: 0,
    nextSpawnAt: 0,
    monsters: []
  }
};

function makeId() {
  return crypto.randomUUID();
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getSiegeMonsterTemplate(siege) {
  const now = Date.now();
  const startedAt = siege.endsAt - SIEGE_DURATION_MS;
  const seconds = Math.floor((now - startedAt) / 1000);

  if (seconds < 60) {
    return {
      name: "Siege Grunt",
      hp: 4,
      speed: 150,
      wallDamage: 2,
      sprite: "assets/siege/siege_grunt.gif"
    };
  }

  if (seconds < 120) {
    if (Math.random() < 0.35) {
      return {
        name: "Siege Runner",
        hp: 2,
        speed: 200,
        wallDamage: 1,
        sprite: "assets/siege/siege_runner.gif"
      };
    }

    return {
      name: "Siege Grunt",
      hp: 4,
      speed: 150,
      wallDamage: 2,
      sprite: "assets/siege/siege_grunt.gif"
    };
  }

  const roll = Math.random();

  if (roll < 0.20) {
    return {
      name: "Siege Brute",
      hp: 8,
      speed: 100,
      wallDamage: 4,
      sprite: "assets/siege/siege_brute.gif"
    };
  }

  if (roll < 0.45) {
    return {
      name: "Siege Runner",
      hp: 2,
      speed: 200,
      wallDamage: 1,
      sprite: "assets/siege/siege_runner.gif"
    };
  }

  return {
    name: "Siege Grunt",
    hp: 4,
    speed: 150,
    wallDamage: 2,
    sprite: "assets/siege/siege_grunt.gif"
  };
}

function resetSiege(now = Date.now()) {
  globalEvents.siege = {
    active: false,
    zoneId: null,
    zoneName: "",
    endsAt: 0,
    nextCheckAt: now + SIEGE_CHECK_INTERVAL_MS,

    wallHp: 0,
    wallMaxHp: 0,

    kills: 0,
    nextSpawnAt: 0,
    monsters: []
  };
}

function startSiege(now = Date.now()) {
  const zone = SIEGE_ZONES[0];
  const wallMaxHp = 10000;

  globalEvents.siege = {
    active: true,
    zoneId: zone.id,
    zoneName: zone.name,
    endsAt: now + SIEGE_DURATION_MS,
    nextCheckAt: now + SIEGE_CHECK_INTERVAL_MS,

    wallHp: wallMaxHp,
    wallMaxHp,

    kills: 0,
    nextSpawnAt: now + 1000,
    monsters: []
  };
}

function spawnSiegeMonster(now = Date.now()) {
  const siege = globalEvents.siege;
  const template = getSiegeMonsterTemplate(siege);

  const monster = {
    id: makeId(),
    name: template.name,
    sprite: template.sprite,

    hp: template.hp,
    maxHp: template.hp,

    x: rand(80, 1100),
    y: -40,

    speed: template.speed,
    wallDamage: template.wallDamage,

    attackingWall: false,
    lastWallAttackAt: 0,
    lastMoveAt: now
  };

  siege.monsters.push(monster);
}

function updateSiegeMonsters(now = Date.now()) {
  const siege = globalEvents.siege;
  const wallY = 350;

  siege.monsters.forEach(monster => {
    if (monster.attackingWall) {
      if (now - (monster.lastWallAttackAt || 0) >= 1000) {
        monster.lastWallAttackAt = now;
        siege.wallHp = Math.max(0, siege.wallHp - monster.wallDamage);
      }

      return;
    }

    const deltaSeconds = Math.min(0.25, (now - monster.lastMoveAt) / 1000);
    monster.lastMoveAt = now;

    monster.y += monster.speed * deltaSeconds;

    if (monster.y >= wallY) {
      monster.y = wallY;
      monster.attackingWall = true;
      monster.lastWallAttackAt = now;
    }
  });
}

function tickGlobalEvents() {
  const now = Date.now();
  const siege = globalEvents.siege;

  if (siege.active) {
    if (now >= siege.endsAt || siege.wallHp <= 0) {
      resetSiege(now);
      return;
    }

    if (now >= siege.nextSpawnAt) {
      spawnSiegeMonster(now);
      siege.nextSpawnAt = now + SIEGE_SPAWN_INTERVAL_MS;
    }

    updateSiegeMonsters(now);
    return;
  }

  if (now < siege.nextCheckAt) return;

  siege.nextCheckAt = now + SIEGE_CHECK_INTERVAL_MS;

  if (Math.random() < SIEGE_START_CHANCE) {
    startSiege(now);
  }
}

router.get("/", (req, res) => {
  tickGlobalEvents();

  res.json({
    success: true,
    events: globalEvents,
    serverTime: Date.now()
  });
});

router.post("/siege/hit/:monsterId", (req, res) => {
  tickGlobalEvents();

  const siege = globalEvents.siege;

  if (!siege.active) {
    return res.status(400).json({
      success: false,
      message: "Siege is not active."
    });
  }

  const monsterId = String(req.params.monsterId);
  const monster = siege.monsters.find(monster => String(monster.id) === monsterId);

  if (!monster) {
    return res.status(404).json({
      success: false,
      message: "Monster not found."
    });
  }

  monster.hp = Math.max(0, monster.hp - 1);

  let killed = false;

  if (monster.hp <= 0) {
    killed = true;
    siege.kills += 1;
    siege.monsters = siege.monsters.filter(monster => String(monster.id) !== monsterId);
  }

  res.json({
    success: true,
    killed,
    siege,
    serverTime: Date.now()
  });
});

module.exports = router;