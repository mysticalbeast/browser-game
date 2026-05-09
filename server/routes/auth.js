const express = require("express");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const USERS_FILE = path.join(__dirname, "../data/users.json");

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    return [];
  }

  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

router.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: "Username and password required."
    });
  }

  const users = loadUsers();

  const existing = users.find(
    user => user.username.toLowerCase() === username.toLowerCase()
  );

  if (existing) {
    return res.status(400).json({
      error: "Username already exists."
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const newUser = {
    id: crypto.randomUUID(),
    username,
    passwordHash,
    createdAt: Date.now()
  };

  users.push(newUser);

  saveUsers(users);

  res.json({
    success: true,
    message: "Account created."
  });
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const users = loadUsers();

  const user = users.find(
    user => user.username.toLowerCase() === username.toLowerCase()
  );

  if (!user) {
    return res.status(400).json({
      error: "Invalid username or password."
    });
  }

  const validPassword = await bcrypt.compare(
    password,
    user.passwordHash
  );

  if (!validPassword) {
    return res.status(400).json({
      error: "Invalid username or password."
    });
  }

  res.json({
    success: true,
    message: "Login successful.",
    user: {
      id: user.id,
      username: user.username
    }
  });
});

module.exports = router;