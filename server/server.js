const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const saveRoutes = require("./routes/save");
const leaderboardRoutes = require("./routes/leaderboard");

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});