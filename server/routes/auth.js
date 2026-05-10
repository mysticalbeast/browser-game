const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("../database");

const router = express.Router();

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username
    },
    process.env.JWT_SECRET || "dev_secret_change_later",
    {
      expiresIn: "30d"
    }
  );
}

async function findUserByUsername(username) {
  const result = await db.query(
    `
    SELECT
      id,
      username,
      password_hash AS "passwordHash",
      created_at AS "createdAt"
    FROM users
    WHERE username_lower = $1
    LIMIT 1
    `,
    [String(username || "").toLowerCase()]
  );

  return result.rows[0] || null;
}

async function createUser(username, passwordHash) {
  const user = {
    id: crypto.randomUUID(),
    username: String(username).trim(),
    passwordHash,
    createdAt: Date.now()
  };

  await db.query(
    `
    INSERT INTO users (
      id,
      username,
      username_lower,
      password_hash,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5)
    `,
    [
      user.id,
      user.username,
      user.username.toLowerCase(),
      user.passwordHash,
      user.createdAt
    ]
  );

  return user;
}

router.post("/register", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (!username || !password) {
      return res.status(400).json({
        error: "Username and password required."
      });
    }

    const existing = await findUserByUsername(username);

    if (existing) {
      return res.status(400).json({
        error: "Username already exists."
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await createUser(username, passwordHash);
    const token = createToken(newUser);

    res.json({
      success: true,
      message: "Account created.",
      token,
      user: {
        id: newUser.id,
        username: newUser.username
      }
    });
  } catch (error) {
    console.error("Register failed:", error);

    res.status(500).json({
      success: false,
      error: "Registration failed."
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    const user = await findUserByUsername(username);

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

    const token = createToken(user);

    res.json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    console.error("Login failed:", error);

    res.status(500).json({
      success: false,
      error: "Login failed."
    });
  }
});

module.exports = router;