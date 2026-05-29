require("dotenv").config();

const { Client, GatewayIntentBits, Collection } = require("discord.js");
const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

console.log("🔹 Démarrage du bot...");

// --- Vérification des variables d'environnement ---
const requiredEnv = ["TOKEN", "MONGO_URI"];
const missing = requiredEnv.filter((v) => !process.env[v]);

if (missing.length > 0) {
  console.error(`❌ Variables d'environnement manquantes : ${missing.join(", ")}`);
  process.exit(1);
}

console.log("✅ Toutes les variables d'environnement sont présentes.");

// --- Client Discord ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
  ],
});

client.commands = new Collection();

// --- Charger les commandes ---
const commandsPath = path.join(__dirname, "commands");

if (!fs.existsSync(commandsPath)) {
  console.error("❌ Dossier commands introuvable.");
  process.exit(1);
}

const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  try {
    const command = require(path.join(commandsPath, file));

    if (!command.data || !command.data.name) {
      console.warn(`⚠️ Commande ignorée : ${file} n'a pas de data.name`);
      continue;
    }

    client.commands.set(command.data.name, command);
    console.log(`✅ Commande chargée : /${command.data.name}`);
  } catch (error) {
    console.error(`❌ Erreur lors du chargement de la commande ${file} :`, error);
  }
}

console.log(`✅ ${client.commands.size} commandes chargées.`);

// --- Connexion MongoDB ---
const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

async function connectMongo() {
  try {
    await mongoClient.connect();

    db = mongoClient.db("arcaneRPG");
    client.db = db;

    console.log("✅ MongoDB connecté");
  } catch (err) {
    console.error("❌ Erreur lors de la connexion à MongoDB :", err);
    process.exit(1);
  }
}

// --- Event CLIENT READY ---
client.once("clientReady", () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
});

// --- Event INTERACTION CREATE ---
try {
  const interactionCreate = require("./events/interactionCreate");

  client.on(interactionCreate.name, async (interaction) => {
    await interactionCreate.execute(interaction, client);
  });

  console.log("✅ Event interactionCreate chargé.");
} catch (error) {
  console.error("❌ Erreur lors du chargement de interactionCreate :", error);
}

// --- Charger les events de logs ---
const logsPath = path.join(__dirname, "events", "logs");

if (fs.existsSync(logsPath)) {
  const logFiles = fs
    .readdirSync(logsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of logFiles) {
    try {
      const event = require(path.join(logsPath, file));

      if (!event.name || typeof event.execute !== "function") {
        console.warn(`⚠️ Event log ignoré : ${file} doit avoir name et execute`);
        continue;
      }

      client.on(event.name, (...args) => {
        event.execute(...args, client);
      });

      console.log(`✅ Event log chargé : ${event.name}`);
    } catch (error) {
      console.error(`❌ Erreur lors du chargement de l'event log ${file} :`, error);
    }
  }

  console.log(`✅ ${logFiles.length} fichier(s) d'events de logs détecté(s).`);
} else {
  console.warn("⚠️ Dossier events/logs introuvable.");
}

// --- Gestion des erreurs globales ---
process.on("unhandledRejection", (error) => {
  console.error("❌ Promesse rejetée non gérée :", error);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Exception non capturée :", error);
});

// --- Démarrage du bot ---
async function startBot() {
  console.log("🌐 Connexion à MongoDB...");
  await connectMongo();

  console.log("🔐 Connexion au bot Discord...");
  await client.login(process.env.TOKEN);
}

startBot();