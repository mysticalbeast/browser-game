const express = require("express");

const router = express.Router();

const SIEGE_DURATION_MS = 15 * 60 * 1000;
const SIEGE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const SIEGE_START_CHANCE = 0.20;

let globalEvents = {
  siege: {
    active: false,
    zoneId: null,
    zoneName: "",
    endsAt: 0,
    nextCheckAt: Date.now() + SIEGE_CHECK_INTERVAL_MS,
    wallHp: 0,
    wallMaxHp: 0
  }
};

const SIEGE_ZONES = [
  { id: 2, name: "Rotworm Cave" },
  { id: 3, name: "Amazon Camp" },
  { id: 4, name: "Minotaur Camp" }
];

function rollGlobalSiege() {
  const now = Date.now();
  const siege = globalEvents.siege;

  if (siege.active && now >= siege.endsAt) {
    globalEvents.siege = {
      active: false,
      zoneId: null,
      zoneName: "",
      endsAt: 0,
      nextCheckAt: now + SIEGE_CHECK_INTERVAL_MS,
      wallHp: 0,
      wallMaxHp: 0
    };

    return;
  }

  if (siege.active) return;
  if (now < siege.nextCheckAt) return;

  siege.nextCheckAt = now + SIEGE_CHECK_INTERVAL_MS;

  if (Math.random() > SIEGE_START_CHANCE) return;

  const zone = SIEGE_ZONES[Math.floor(Math.random() * SIEGE_ZONES.length)];
  const wallMaxHp = 10000;

  globalEvents.siege = {
    active: true,
    zoneId: zone.id,
    zoneName: zone.name,
    endsAt: now + SIEGE_DURATION_MS,
    nextCheckAt: now + SIEGE_CHECK_INTERVAL_MS,
    wallHp: wallMaxHp,
    wallMaxHp
  };
}

router.get("/", (req, res) => {
  rollGlobalSiege();

  res.json({
    success: true,
    events: globalEvents,
    serverTime: Date.now()
  });
});

module.exports = router;