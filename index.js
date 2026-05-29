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
        GatewayIntentBits.GuildModeration
    ]
})

client.commands = new Collection();

// --- Charger les commandes ---
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));

  if (!command.data || !command.data.name) {
    console.warn(`⚠️ Commande ignorée : ${file} n'a pas de data.name`);
    continue;
  }

  client.commands.set(command.data.name, command);
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

// --- Event READY ---
client.once("ready", () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
});

// --- Event INTERACTION CREATE ---
const interactionCreate = require("./events/interactionCreate");

client.on(interactionCreate.name, async (interaction) => {
  await interactionCreate.execute(interaction, client);
});

// --- Démarrage du bot ---
async function startBot() {
  console.log("🌐 Connexion à MongoDB...");
  await connectMongo();

  console.log("🔐 Connexion au bot Discord...");
  await client.login(process.env.TOKEN);
}

startBot();