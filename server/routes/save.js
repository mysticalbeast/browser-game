const express = require("express");
const fs = require("fs");
const path = require("path");

const authMiddleware = require("../middleware/auth");

const router = express.Router();

const SAVES_FILE = path.join(__dirname, "../data/saves.json");

function loadSaves() {
  if (!fs.existsSync(SAVES_FILE)) return {};
  return JSON.parse(fs.readFileSync(SAVES_FILE, "utf8"));
}

function saveSaves(saves) {
  fs.writeFileSync(SAVES_FILE, JSON.stringify(saves, null, 2));
}

router.get("/:userId", authMiddleware, (req, res) => {
  const { userId } = req.params;
  
  if (String(req.user.id) !== String(userId)) {
  return res.status(403).json({
    success: false,
    message: "You can only access your own save."
  });
}
  
  const saves = loadSaves();

  res.json({
    success: true,
    save: saves[userId] || null
  });
});

router.post("/:userId", authMiddleware, (req, res) => {
  const { userId } = req.params;
  
  if (String(req.user.id) !== String(userId)) {
  return res.status(403).json({
    success: false,
    message: "You can only access your own save."
  });
}
  
  const { save } = req.body;

  if (!save) {
    return res.status(400).json({
      error: "Save data required."
    });
  }

  const saves = loadSaves();

  saves[userId] = {
    save,
    updatedAt: Date.now()
  };

  saveSaves(saves);

  res.json({
    success: true,
    message: "Cloud save updated."
  });
});

module.exports = router;