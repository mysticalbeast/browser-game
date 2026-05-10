const express = require("express");

const router = express.Router();

const SIEGE_DURATION_MS = 15 * 60 * 1000;
const SIEGE_CHECK_INTERVAL_MS = 20 * 60 * 1000;
const SIEGE_START_CHANCE = 0.25;
const SIEGE_SPAWN_INTERVAL_MS = 2500;

let lastProcessedSiegeResultAt = 0;

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

function resetSiege(now = Date.now(), reason = "timerEnded", previousSiege = null) {
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
    monsters: [],
    joinedPlayers: [],
	participants: {},

    lastResult: previousSiege ? {
  reason,
  endedAt: now,
  kills: previousSiege.kills || 0,

  participants: Object.fromEntries(
    Object.entries(previousSiege.participants || {}).map(([userId, participant]) => {
      return [
        userId,
        {
          ...participant,
          rewards: calculateParticipantRewards(participant, previousSiege)
        }
      ];
    })
  )
} : null
  };
}

function startSiege(now = Date.now()) {
  const zone = SIEGE_ZONES[0];
  const wallMaxHp = 1000;

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
    monsters: [],
    joinedPlayers: [],
	participants: {}
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
  const wallY = 860;

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

function getSiegeSpawnInterval() {
  const siege = globalEvents.siege;
  const now = Date.now();

  const startedAt = siege.endsAt - SIEGE_DURATION_MS;
  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));

  // 0-29s = 1/sec, 30-59s = 2/sec, 60-89s = 3/sec, etc.
  const baseSpawnsPerSecond = 1 + Math.floor(elapsedSeconds / 30);

  const playerCount = Math.max(1, siege.joinedPlayers?.length || 1);

  // 1 player = 100%, 5 players = 200%
  const playerMultiplier = 1 + ((playerCount - 1) * 0.175);

  const spawnsPerSecond = baseSpawnsPerSecond * playerMultiplier;

  return Math.max(100, Math.floor(1000 / spawnsPerSecond));
}

function tickGlobalEvents() {
  const now = Date.now();
  const siege = globalEvents.siege;

  if (siege.active) {
if (now >= siege.endsAt || siege.wallHp <= 0) {
  const reason = siege.wallHp <= 0 ? "wallDestroyed" : "timerEnded";
  resetSiege(now, reason, siege);
  return;
}

    if (now >= siege.nextSpawnAt) {
      spawnSiegeMonster(now);
      const playerCount = Math.max(1, siege.joinedPlayers?.length || 1);

const spawnMultiplier =
  1 + ((playerCount - 1) * 0.20);

const interval =
  SIEGE_SPAWN_INTERVAL_MS / spawnMultiplier;

siege.nextSpawnAt = now + getSiegeSpawnInterval();
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

function calculateParticipantRewards(participant, siege) {
  const totalDamage = Object.values(siege.participants || {}).reduce((sum, player) => {
    return sum + (player.damage || 0);
  }, 0);

  if (!participant || totalDamage <= 0) {
    return null;
  }

  const contributionShare =
    Math.max(0, Math.min(1, (participant.damage || 0) / totalDamage));

  const totalKills = siege.kills || 0;

  const goldPool = totalKills * 250;
  const expPool = totalKills * 250;
  const starPool = totalKills * 2;

  return {
    contributionShare,

    gold: Math.floor(goldPool * contributionShare),
    exp: Math.floor(expPool * contributionShare),
    stars: Math.floor(starPool * contributionShare),

    whetstones: Math.floor(totalKills * 0.05 * contributionShare),
    silverTokens: Math.floor(totalKills * 0.02 * contributionShare),

    greenEssence: Math.floor(totalKills * 0.12 * contributionShare),
    blueEssence: Math.floor(totalKills * 0.07 * contributionShare),
    yellowEssence: Math.floor(totalKills * 0.035 * contributionShare),
    redEssence: Math.floor(totalKills * 0.015 * contributionShare),

    salvageMaterials: Math.floor(totalKills * 0.10 * contributionShare)
  };
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

const userId = String(req.body?.userId || "");
const username = String(req.body?.username || "Unknown");

if (!userId) {
  return res.status(400).json({
    success: false,
    message: "Missing userId."
  });
}

if (!siege.participants) {
  siege.participants = {};
}

if (!siege.participants[userId]) {
  siege.participants[userId] = {
    userId,
    username,
    damage: 0,
    kills: 0
  };
}

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

  const damage = 1;
monster.hp = Math.max(0, monster.hp - damage);

siege.participants[userId].damage += damage;

  let killed = false;

  if (monster.hp <= 0) {
    killed = true;
    siege.kills += 1;
	siege.participants[userId].kills += 1;
    siege.monsters = siege.monsters.filter(monster => String(monster.id) !== monsterId);
  }

  res.json({
    success: true,
    killed,
    siege,
    serverTime: Date.now()
  });
});

router.post("/siege/join", (req, res) => {
  tickGlobalEvents();

  const siege = globalEvents.siege;

  if (!siege.active) {
    return res.status(400).json({
      success: false,
      message: "Siege is not active."
    });
  }

  const userId = String(req.body?.userId || "");

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "Missing userId."
    });
  }

  if (!Array.isArray(siege.joinedPlayers)) {
    siege.joinedPlayers = [];
  }

  const alreadyJoined = siege.joinedPlayers.includes(userId);

  if (!alreadyJoined) {
    siege.joinedPlayers.push(userId);

    siege.wallMaxHp += 200;
    siege.wallHp += 200;
  }

  res.json({
    success: true,
    siege
  });
});

module.exports = router;