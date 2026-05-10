const express = require("express");
const authMiddleware = require("../middleware/auth");
const { loadPlayerSave, savePlayerSave } = require("../dbSaves");

const router = express.Router();

router.post("/skills", authMiddleware, async (req, res) => {
  try {
    const save = await loadPlayerSave(req.user.id);

    if (!save) {
      return res.status(404).json({
        success: false,
        message: "No save found."
      });
    }

    save.skills = {};
    save.skillPoints = Number(req.body?.skillPoints || 0);
    save.unlockedNodes = ["minotaur_category"];
    save.lastSeenAt = Date.now();

    await savePlayerSave(req.user.id, save);

    res.json({
      success: true,
      skillPoints: save.skillPoints,
      skills: save.skills,
      unlockedNodes: save.unlockedNodes
    });
  } catch (error) {
    console.error("Admin skill repair failed:", error);

    res.status(500).json({
      success: false,
      message: "Admin skill repair failed."
    });
  }
});

module.exports = router;