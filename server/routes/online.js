const express = require("express");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

const ONLINE_TIMEOUT_MS = 60000;

const onlinePlayers = new Map();

function getOnlineList() {
  const now = Date.now();

  for (const [userId, player] of onlinePlayers.entries()) {
    if (now - player.lastSeenAt > ONLINE_TIMEOUT_MS) {
      onlinePlayers.delete(userId);
    }
  }

  return Array.from(onlinePlayers.values())
    .sort((a, b) => a.username.localeCompare(b.username));
}

router.post("/heartbeat", authMiddleware, (req, res) => {
  const level = Number(req.body.level || 1);
  const zoneId = Number(req.body.zoneId || 1);
  const zoneName = String(req.body.zoneName || "Unknown");

  onlinePlayers.set(String(req.user.id), {
    userId: req.user.id,
    username: req.user.username,
    level,
    zoneId,
    zoneName,
    lastSeenAt: Date.now()
  });

  res.json({
    success: true,
    onlineCount: getOnlineList().length
  });
});

router.get("/", (req, res) => {
  const players = getOnlineList();

  res.json({
    success: true,
    onlineCount: players.length,
    players
  });
});

module.exports = router;