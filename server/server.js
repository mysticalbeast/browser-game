const express = require("express");
const cors = require("cors");
require("dotenv").config();

const initDatabase = require("./initDatabase");

const authRoutes = require("./routes/auth");
const saveRoutes = require("./routes/save");
const leaderboardRoutes = require("./routes/leaderboard");
const onlineRoutes = require("./routes/online");
const chatRoutes = require("./routes/chat");
const adminRoutes = require("./routes/admin");
const eventsRoutes = require("./routes/events");
const combatRoutes = require("./routes/combat");
const rebirthRoutes = require("./routes/rebirth");
const skillsRoutes = require("./routes/skills");
const fishingRoutes = require("./routes/fishing");
const chestRoutes = require("./routes/chests");
const offlineRoutes = require("./routes/offline");
const equipmentRoutes = require("./routes/equipment");
const rewardsRoutes = require("./routes/rewards");
const potionRoutes = require("./routes/potions");

const app = express();

app.use(cors());

app.use(express.json({
  limit: "10mb"
}));

app.get("/", (req, res) => {
  res.json({
    message: "Browser game server is running."
  });
});

app.use("/auth", authRoutes);
app.use("/save", saveRoutes);
app.use("/leaderboard", leaderboardRoutes);
app.use("/online", onlineRoutes);
app.use("/chat", chatRoutes);
app.use("/admin", adminRoutes);
app.use("/events", eventsRoutes);
app.use("/combat", combatRoutes);
app.use("/rebirth", rebirthRoutes);
app.use("/skills", skillsRoutes);
app.use("/fishing", fishingRoutes);
app.use("/chests", chestRoutes);
app.use("/offline", offlineRoutes);
app.use("/equipment", equipmentRoutes);
app.use("/rewards", rewardsRoutes);
app.use("/potions", potionRoutes);

const PORT = process.env.PORT || 3000;

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch((error) => {
  console.error("Failed to initialize database:", error);
  process.exit(1);
});