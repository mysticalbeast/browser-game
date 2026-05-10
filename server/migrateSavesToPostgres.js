const fs = require("fs");
const path = require("path");
const { savePlayerSave } = require("./dbSaves");

const SAVES_FILE = path.join(__dirname, "data/saves.json");

async function migrate() {
  if (!fs.existsSync(SAVES_FILE)) {
    console.log("No saves.json found.");
    process.exit(0);
  }

  const saves = JSON.parse(fs.readFileSync(SAVES_FILE, "utf8"));
  const entries = Object.entries(saves);

  console.log(`Found ${entries.length} saves.`);

  for (const [userId, wrapper] of entries) {
    const save = wrapper?.save || wrapper;

    if (!save || typeof save !== "object") {
      console.log(`Skipping invalid save for ${userId}`);
      continue;
    }

    await savePlayerSave(userId, save);
    console.log(`Migrated save: ${userId}`);
  }

  console.log("Migration complete.");
  process.exit(0);
}

migrate().catch(error => {
  console.error("Migration failed:", error);
  process.exit(1);
});