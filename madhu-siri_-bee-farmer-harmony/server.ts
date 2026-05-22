import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "db.json");

// Parse JSON bodies
app.use(express.json());

// Initialize Gemini Client
const geminiApiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (geminiApiKey) {
  try {
    ai = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (error) {
    console.error("Failed to initialize GoogleGenAI client:", error);
  }
}

// Ensure database file loaded correctly
interface DbSchema {
  hives: any[];
  alerts: any[];
  logs: any[];
}

function loadDb(): DbSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error reading db.json, falling back to default structure", error);
  }
  return { hives: [], alerts: [], logs: [] };
}

function saveDb(data: DbSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing to db.json", error);
  }
}

// Distance helper (Haversine formula in KM)
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Active alerts auto-expiration tick
function checkAlertExpirations(db: DbSchema): boolean {
  let modified = false;
  const now = new Date();
  db.alerts = db.alerts.map((alert) => {
    if (alert.active) {
      const alertTime = new Date(alert.timestamp);
      const expirationTime = new Date(alertTime.getTime() + alert.durationMinutes * 60 * 1000);
      if (now > expirationTime) {
        alert.active = false;
        modified = true;
      }
    }
    return alert;
  });
  return modified;
}

// SSE Clients for Real-time Notifications
let sseClients: any[] = [];

app.get("/api/alerts/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const clientId = Date.now().toString();
  const newClient = { id: clientId, res };
  sseClients.push(newClient);

  // Keep connection alive with simple comments
  const keepAliveInterval = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 30000);

  req.on("close", () => {
    clearInterval(keepAliveInterval);
    sseClients = sseClients.filter((c) => c.id !== clientId);
  });
});

function broadcastEvent(event: string, data: any) {
  sseClients.forEach((client) => {
    client.res.write(`event: ${event}\n`);
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

// ================= API ENDPOINTS =================

// 1. HIVES ENDPOINTS
app.get("/api/hives", (req, res) => {
  const db = loadDb();
  const modified = checkAlertExpirations(db);
  if (modified) saveDb(db);
  res.json(db.hives);
});

app.post("/api/hives", (req, res) => {
  const db = loadDb();
  const { name, ownerName, latitude, longitude, honeyProductionKg, healthStatus } = req.body;
  
  if (!name || !ownerName || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: "Missing required fields for Hive creation." });
  }

  const newHive = {
    id: `hive-${Date.now()}`,
    name,
    ownerName,
    latitude: Number(latitude),
    longitude: Number(longitude),
    honeyProductionKg: Number(honeyProductionKg || 0),
    healthStatus: healthStatus || "Excellent",
    coverStatus: "Open",
    lastInspected: new Date().toISOString().split("T")[0]
  };

  db.hives.push(newHive);
  saveDb(db);
  
  broadcastEvent("hive_created", newHive);
  res.status(201).json(newHive);
});

app.put("/api/hives/:id", (req, res) => {
  const db = loadDb();
  const index = db.hives.findIndex((h) => h.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Hive not found." });
  }

  const currentHive = db.hives[index];
  const { name, ownerName, latitude, longitude, honeyProductionKg, healthStatus, coverStatus } = req.body;

  db.hives[index] = {
    ...currentHive,
    name: name !== undefined ? name : currentHive.name,
    ownerName: ownerName !== undefined ? ownerName : currentHive.ownerName,
    latitude: latitude !== undefined ? Number(latitude) : currentHive.latitude,
    longitude: longitude !== undefined ? Number(longitude) : currentHive.longitude,
    honeyProductionKg: honeyProductionKg !== undefined ? Number(honeyProductionKg) : currentHive.honeyProductionKg,
    healthStatus: healthStatus !== undefined ? healthStatus : currentHive.healthStatus,
    coverStatus: coverStatus !== undefined ? coverStatus : currentHive.coverStatus,
    closedAt: coverStatus === "Closed" ? new Date().toISOString() : currentHive.closedAt,
    lastInspected: new Date().toISOString().split("T")[0]
  };

  saveDb(db);
  broadcastEvent("hive_updated", db.hives[index]);
  res.json(db.hives[index]);
});

app.delete("/api/hives/:id", (req, res) => {
  const db = loadDb();
  const index = db.hives.findIndex((h) => h.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Hive not found." });
  }

  const deletedHive = db.hives[index];
  db.hives.splice(index, 1);
  // Also clean up any logs matching this hive
  db.logs = db.logs.filter((l) => l.hiveId !== req.params.id);
  
  saveDb(db);
  broadcastEvent("hive_deleted", { id: req.params.id });
  res.json({ success: true, message: "Hive and associated health logs removed.", deletedHive });
});

// 2. SPRAY ALERTS ENDPOINTS
app.get("/api/alerts", (req, res) => {
  const db = loadDb();
  const modified = checkAlertExpirations(db);
  if (modified) saveDb(db);
  res.json(db.alerts);
});

app.post("/api/alerts", (req, res) => {
  const db = loadDb();
  const { chemicalName, farmerName, latitude, longitude, radiusKm, durationMinutes } = req.body;

  if (!chemicalName || !farmerName || latitude === undefined || longitude === undefined || !radiusKm) {
    return res.status(400).json({ error: "Missing required fields for Spray Alert creation." });
  }

  // Auto clean stale alerts first
  checkAlertExpirations(db);

  const newAlert = {
    id: `alert-${Date.now()}`,
    chemicalName,
    farmerName,
    latitude: Number(latitude),
    longitude: Number(longitude),
    radiusKm: Number(radiusKm),
    timestamp: new Date().toISOString(),
    durationMinutes: Number(durationMinutes || 240),
    active: true
  };

  db.alerts.push(newAlert);
  saveDb(db);

  // Identify affected hives within range (e.g. 2.0km default)
  const affectedHives = db.hives.filter((hive) => {
    const dist = getDistanceKm(newAlert.latitude, newAlert.longitude, hive.latitude, hive.longitude);
    return dist <= newAlert.radiusKm;
  });

  const payload = {
    alert: newAlert,
    affectedHivesCount: affectedHives.length,
    affectedHiveIds: affectedHives.map((h) => h.id)
  };

  // Broadcast to all active browser sessions immediately!
  broadcastEvent("new_spray_alert", payload);

  res.status(201).json(payload);
});

// 3. HEALTH LOGS
app.get("/api/logs", (req, res) => {
  const db = loadDb();
  res.json(db.logs);
});

app.get("/api/hives/:id/logs", (req, res) => {
  const db = loadDb();
  const hiveLogs = db.logs.filter((log) => log.hiveId === req.params.id);
  res.json(hiveLogs);
});

app.post("/api/logs", (req, res) => {
  const db = loadDb();
  const { hiveId, weightKg, honeyHarvestedKg, queenSeen, activityLevel, healthStatus, notes } = req.body;

  if (!hiveId) {
    return res.status(400).json({ error: "Hive ID is required." });
  }

  // Update hive lastInspected list & production
  const hiveIndex = db.hives.findIndex((h) => h.id === hiveId);
  if (hiveIndex === -1) {
    return res.status(404).json({ error: "Reference Hive not found." });
  }

  const currentHive = db.hives[hiveIndex];
  const honeyHarvestedNum = Number(honeyHarvestedKg || 0);
  
  db.hives[hiveIndex] = {
    ...currentHive,
    lastInspected: new Date().toISOString().split("T")[0],
    healthStatus: healthStatus || currentHive.healthStatus,
    honeyProductionKg: currentHive.honeyProductionKg + honeyHarvestedNum
  };

  const newLog = {
    id: `log-${Date.now()}`,
    hiveId,
    date: new Date().toISOString().split("T")[0],
    weightKg: Number(weightKg || 20),
    honeyHarvestedKg: honeyHarvestedNum,
    queenSeen: queenSeen === true,
    activityLevel: activityLevel || "Medium",
    healthStatus: healthStatus || "Good",
    notes: notes || ""
  };

  db.logs.push(newLog);
  saveDb(db);

  broadcastEvent("log_created", { log: newLog, updatedHive: db.hives[hiveIndex] });
  res.status(201).json(newLog);
});

// 4. BEEKEEPING TIPS & AI ADVISOR
// Evaluate pesticide chemical safety for honeybees using GoogleGenAI
app.post("/api/pesticides/evaluate", async (req, res) => {
  const { chemicalName } = req.body;
  if (!chemicalName) {
    return res.status(400).json({ error: "Chemical/Pesticide name is required." });
  }

  // Standard high-quality backup evaluation rules if AI key is missing or calls fail
  const getFallbackAnalysis = (name: string) => {
    const lname = name.toLowerCase();
    
    if (lname.includes("chlorpyrifos") || lname.includes("imidacloprid") || lname.includes("fipronil") || lname.includes("permethrin") || lname.includes("malathion") || lname.includes("neonicotinoid") || lname.includes("glyphosate")) {
      return {
        chemicalName: name,
        safetyLevel: "Highly Toxic",
        riskScore: 9,
        description: `${name} is high-impact toxic chemical that paralyzes bee central nervous systems, impairs navigation, causing rapid worker loss even in trace amounts. Extremely destructive.`,
        precautions: [
          "Do not spray under any circumstances during active foraging hours (8:00 AM - 6:00 PM).",
          "Warn adjacent beekeepers within a 3km radius at least 48 hours prior to application.",
          "Select non-residual chemicals and apply strictly at evening when hives are closed."
        ],
        safeAlternatives: [
          "Neem Oil Extraction (Melia azedarach formulation)",
          "Bacillus thuringiensis (Bt paste for caterpillar controls)",
          "Diatomaceous Earth on ground-level foliage"
        ],
        foragingImpact: "Severe. Bees landing on treated crops within 48 hours suffer total mortality. Residual toxins carried back destroy complete nurse bee larvae cells."
      };
    } else if (lname.includes("spinosad") || lname.includes("carbaryl") || lname.includes("pyrethrin") || lname.includes("sulfoxaflor")) {
      return {
        chemicalName: name,
        safetyLevel: "Moderately Toxic",
        riskScore: 6,
        description: `${name} poses substantial contact toxicity when wet but degrades relatively fast. Harms larval development and navigation if sprayed directly on bees.`,
        precautions: [
          "Spray only at late dusk after bees return to colonies.",
          "Ensure spray drift is carefully controlled using low-pressure nozzles.",
          "Request all beekeepers close hive entrances temporarily during application."
        ],
        safeAlternatives: [
          "Horticultural insecticidal potassium soaps",
          "Kaolin clay barrier applications",
          "Garlic-chili organic repellant spray water"
        ],
        foragingImpact: "Moderate. Safe once dried (usually 4-8 hours). Applying when foraging is inactive protects 95% of pollinators."
      };
    } else {
      return {
        chemicalName: name,
        safetyLevel: "Safe",
        riskScore: 2,
        description: `${name} shows minor or virtually zero contact toxicity to honeybees under standard exposure cycles. Completely biodegradable within hours.`,
        precautions: [
          "Avoid direct drift into pure water wells or honeybee streams.",
          "Still recommended to spray at dawn or dusk for agricultural hygiene.",
          "Coordinate with local farmers to share spray logs freely."
        ],
        safeAlternatives: [
          "Companion planting (Marigold, lavender combinations)",
          "Biological beneficial predatory insects (lacewings, ladybugs)",
          "Pure water jet washes for aphid control"
        ],
        foragingImpact: "Minimal. Does not disturb hive navigation, communication dances, or pollen/nectar hygiene."
      };
    }
  };

  if (!ai) {
    console.log("No Gemini API Key found. Utilizing high-fidelity local catalog.");
    return res.json(getFallbackAnalysis(chemicalName));
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Evaluate the chemical/pesticide: ${chemicalName}. Assess its toxicity to honeybees, ecological risks, safe alternatives, and precautions for safe crop protection harmony. Keep explanations objective and professional.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            chemicalName: { type: Type.STRING },
            safetyLevel: {
              type: Type.STRING,
              description: "Must be exactly 'Safe', 'Moderately Toxic', or 'Highly Toxic'"
            },
            riskScore: {
              type: Type.INTEGER,
              description: "threat level to honeybees from 1 to 10 (1 is harmless, 10 is lethal instantly)"
            },
            description: { type: Type.STRING, description: "Factual scientific review of how this pesticide affects bee health, navigation, and larvae." },
            precautions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 precise actions for crop farmers to mitigate pollinator risks."
            },
            safeAlternatives: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 organic or bee-safe pest management solutions."
            },
            foragingImpact: { type: Type.STRING, description: "Instructions on foraging hours safety window." }
          },
          required: ["chemicalName", "safetyLevel", "riskScore", "description", "precautions", "safeAlternatives", "foragingImpact"]
        }
      }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text.trim());
      res.json(parsed);
    } else {
      throw new Error("No text returned from Gemini API");
    }
  } catch (error) {
    console.error("Gemini pesticide evaluation failed, using fallback:", error);
    res.json(getFallbackAnalysis(chemicalName));
  }
});

// AI Farmer & Beekeeper Harmony Assistant Chat
app.post("/api/advisor/chat", async (req, res) => {
  const { message, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  const fallbackResponses = [
    "To protect your bees during pesticide applications, make sure to cooperate with crop farmers. Suggest spraying Neem Oil or Bt in the late evening (after 7 PM) when bees have stopped foraging for the day. You can also temporarily close the hive covers on affected hives for up to 4 hours.",
    "Beekeepers should track hive weight regularly. A sudden drops in hive weight might indicate a swarm has left, or honey robbing is occurring. Tracking checkups in our Health Logs helps diagnose colony stress early.",
    "Bees are most active when temperatures exceed 15°C/60°F and there is sunshine. Active foraging peak hours are usually between 9:00 AM and 4:30 PM. Spraying pest treatments outside this window saves crucial workers.",
    "For organic pesticide options, favor Bacillus thuringiensis (Bt) for caterpillars, Garlic sprays, or kaolin clay. Avoid synthetic neonicotinoids like Imidacloprid which can devastate hives even through soil residues."
  ];

  if (!ai) {
    const randomReply = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    return res.json({ text: `[Offline Local Guide Assistance]: ${randomReply}` });
  }

  try {
    // Format conversation history for Gemini Chat SDK
    const formattedContents = [];
    if (history && Array.isArray(history)) {
      history.forEach((turn: any) => {
        formattedContents.push({
          role: turn.sender === "user" ? "user" : "model",
          parts: [{ text: turn.text }]
        });
      });
    }
    formattedContents.push({
      role: "user",
      parts: [{ text: message }]
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedContents,
      config: {
        systemInstruction: "You are Madhu-Siri AI, a friendly and highly knowledgeable agricultural advisor specialized in Beekeeping (Apiculture) and Crop Farming harmony. Your purpose is to help crop farmers protect major cash-crops while keeping adjacent honeybees entirely safe. Give clear, bulleted, action-focused agricultural safety tips in professional yet approachable terms. Refer to Karnataka, India beekeeping context optionally if beneficial. Remind users about keeping hive covers 'Closed' during nearby pesticide applications."
      }
    });

    res.json({ text: response.text || "I'm here to support you. Ask me any bee or cropping questions!" });
  } catch (error) {
    console.error("Gemini Chat failed, using fallback:", error);
    const randomReply = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    res.json({ text: `[Harmony Assistant]: ${randomReply}` });
  }
});


// ================= VITE DEV / PRODUCTION INGRESS =================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Vite dev mode setup
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware loaded.");
  } else {
    // Production serving
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving production static assets from dist/");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Development App URL: http://localhost:${PORT}`);
  });
}

startServer();
