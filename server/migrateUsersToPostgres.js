const fs = require("fs");
const path = require("path");
const db = require("./database");

const USERS_FILE = path.join(__dirname, "data/users.json");

async function migrate() {
  if (!fs.existsSync(USERS_FILE)) {
    console.log("No users.json found.");
    process.exit(0);
  }

  const users = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));

  console.log(`Found ${users.length} users.`);

  for (const user of users) {
    if (!user?.id || !user?.username || !user?.passwordHash) {
      console.log("Skipping invalid user:", user?.username || user?.id);
      continue;
    }

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
      ON CONFLICT (id)
      DO UPDATE SET
        username = EXCLUDED.username,
        username_lower = EXCLUDED.username_lower,
        password_hash = EXCLUDED.password_hash,
        created_at = EXCLUDED.created_at
      `,
      [
        String(user.id),
        String(user.username),
        String(user.username).toLowerCase(),
        String(user.passwordHash),
        Number(user.createdAt || Date.now())
      ]
    );

    console.log(`Migrated user: ${user.username}`);
  }

  console.log("User migration complete.");
  process.exit(0);
}

migrate().catch(error => {
  console.error("User migration failed:", error);
  process.exit(1);
});