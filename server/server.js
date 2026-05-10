const express = require("express");
const cors = require("cors");
require("dotenv").config();

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});