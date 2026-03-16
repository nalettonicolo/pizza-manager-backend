import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import "./src/config/prismaClient.js";

import authMiddleware from "./src/middleware/authMiddleware.js";
import tenantMiddleware from "./src/middleware/tenantMiddleware.js";
import errorHandler from "./src/middleware/errorHandler.js";

import turniRoutes from "./src/routes/turniRoutes.js";
import authRoutes from "./src/routes/authRoutes.js";
import onboardingRoutes from "./src/routes/onboardingRoutes.js";
import prezzoRoutes from "./src/routes/prezzo.routes.js"; // 👈 AGGIUNTO
import ordiniRoutes from "./src/routes/ordiniRoutes.js"

const app = express();

app.use(cors());
app.use(express.json());

/* ===============================
   PUBLIC ROUTES (NO AUTH)
================================= */
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/auth", authRoutes);

/* ===============================
   PROTECTED ROUTES
================================= */

// 1️⃣ Verifica JWT Supabase
app.use(authMiddleware);

// 2️⃣ Risoluzione tenant dal DB
app.use(tenantMiddleware);

// 3️⃣ Rotte protette
app.use("/api/turni", turniRoutes);
app.use("/api/prezzo", prezzoRoutes); // 👈 AGGIUNTO QUI
app.use("/api/ordini", ordiniRoutes)

app.get("/", (req, res) => {
  res.send("PizzaManager API ONLINE 🚀");
});

/* ===============================
   ERROR HANDLER (sempre ultimo)
================================= */
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});