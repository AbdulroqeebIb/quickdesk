require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(
  cors({
    origin: [
      "https://quickdesk-six.vercel.app",
      "http://localhost:5173",
      "http://localhost:3000",
    ],
    credentials: true,
  }),
);
app.use(express.json());

app.use("/api/auth", require("./routes/auth"));
app.use("/api/tickets", require("./routes/tickets"));
app.get("/", (req, res) => res.json({ message: "QuickDesk API running" }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
