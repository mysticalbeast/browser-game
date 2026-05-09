const express = require("express");
const fs = require("fs");
const path = require("path");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

const CHAT_FILE = path.join(__dirname, "../data/chat.json");

const MAX_MESSAGES = 100;
const MAX_MESSAGE_LENGTH = 200;
const CHAT_COOLDOWN_MS = 2500;
const userLastMessageAt = new Map();

function loadMessages() {
  if (!fs.existsSync(CHAT_FILE)) return [];

  try {
    return JSON.parse(fs.readFileSync(CHAT_FILE, "utf8"));
  } catch (error) {
    console.error("Failed to read chat.json:", error);
    return [];
  }
}

function saveMessages(messages) {
  fs.writeFileSync(CHAT_FILE, JSON.stringify(messages, null, 2));
}

router.get("/", (req, res) => {
  const messages = loadMessages();

  res.json({
    success: true,
    messages: messages.slice(-MAX_MESSAGES)
  });
});

router.post("/", authMiddleware, (req, res) => {
  const text = String(req.body.text || "").trim();

const now = Date.now();
const lastMessageAt = userLastMessageAt.get(req.user.id) || 0;

if (now - lastMessageAt < CHAT_COOLDOWN_MS) {
  return res.status(429).json({
    success: false,
    message: "You are sending messages too quickly."
  });
}

userLastMessageAt.set(req.user.id, now);

  if (!text) {
    return res.status(400).json({
      success: false,
      message: "Message cannot be empty."
    });
  }

  if (text.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Message too long. Max ${MAX_MESSAGE_LENGTH} characters.`
    });
  }

  const messages = loadMessages();

  const newMessage = {
    id: crypto.randomUUID(),
    userId: req.user.id,
    username: req.user.username,
    text,
    createdAt: Date.now()
  };

  messages.push(newMessage);

  saveMessages(messages.slice(-MAX_MESSAGES));

  res.json({
    success: true,
    message: newMessage
  });
});

module.exports = router;