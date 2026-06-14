require("dotenv").config()

const { Client, GatewayIntentBits, Collection } = require("discord.js")
const { MongoClient } = require("mongodb")
const fs = require("fs")
const path = require("path")

console.log("🔹 Démarrage du bot...")

// --- Vérification des variables d'environnement ---
const requiredEnv = ["TOKEN", "MONGO_URI"]
const missing = requiredEnv.filter((v) => !process.env[v])

if (missing.length > 0) {
  console.error(`❌ Variables d'environnement manquantes : ${missing.join(", ")}`)
  process.exit(1)
}

console.log("✅ Toutes les variables d'environnement sont présentes.")

// --- Client Discord ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
  ],
})

client.commands = new Collection()

// --- Fonction pour récupérer les commandes dans tous les sous-dossiers ---
function getCommandFiles(dir) {
  const files = []

  if (!fs.existsSync(dir)) {
    return files
  }

  const entries = fs.readdirSync(dir, {
    withFileTypes: true,
  })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...getCommandFiles(fullPath))
    }

    if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath)
    }
  }

  return files
}

// --- Charger les commandes ---
const commandsPath = path.join(__dirname, "commands")

if (!fs.existsSync(commandsPath)) {
  console.error("❌ Dossier commands introuvable.")
  process.exit(1)
}

const commandFiles = getCommandFiles(commandsPath)

for (const filePath of commandFiles) {
  try {
    delete require.cache[require.resolve(filePath)]

    const command = require(filePath)

    if (!command.data || !command.data.name || typeof command.execute !== "function") {
      console.warn(`⚠️ Commande ignorée : ${filePath}`)
      continue
    }

    client.commands.set(command.data.name, command)
    console.log(`✅ Commande chargée : /${command.data.name}`)
  } catch (error) {
    console.error(`❌ Erreur lors du chargement de la commande ${filePath} :`)
    console.error(error)
  }
}

console.log(`✅ ${client.commands.size} commande(s) chargée(s).`)

// --- Connexion MongoDB ---
const mongoClient = new MongoClient(process.env.MONGO_URI)
let db

async function connectMongo() {
  try {
    await mongoClient.connect()

    db = mongoClient.db("arcaneRPG")
    client.db = db

    console.log("✅ MongoDB connecté")
  } catch (err) {
    console.error("❌ Erreur lors de la connexion à MongoDB :", err)
    process.exit(1)
  }
}

// --- Event CLIENT READY ---
client.once("clientReady", () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`)
})

// --- Event INTERACTION CREATE ---
try {
  const interactionCreate = require("./events/interactionCreate")

  if (!interactionCreate.name || typeof interactionCreate.execute !== "function") {
    console.warn("⚠️ Event interactionCreate ignoré : name ou execute manquant.")
  } else {
    client.on(interactionCreate.name, async (interaction) => {
      await interactionCreate.execute(interaction, client)
    })

    console.log("✅ Event interactionCreate chargé.")
  }
} catch (error) {
  console.error("❌ Erreur lors du chargement de interactionCreate :")
  console.error(error)
}

// --- Charger les events de logs ---
const logsPath = path.join(__dirname, "events", "logs")

if (fs.existsSync(logsPath)) {
  const logFiles = fs
    .readdirSync(logsPath)
    .filter((file) => file.endsWith(".js"))

  for (const file of logFiles) {
    try {
      const eventPath = path.join(logsPath, file)
      delete require.cache[require.resolve(eventPath)]

      const event = require(eventPath)

      if (!event.name || typeof event.execute !== "function") {
        console.warn(`⚠️ Event log ignoré : ${file} doit avoir name et execute`)
        continue
      }

      client.on(event.name, (...args) => {
        event.execute(...args, client)
      })

      console.log(`✅ Event log chargé : ${event.name}`)
    } catch (error) {
      console.error(`❌ Erreur lors du chargement de l'event log ${file} :`)
      console.error(error)
    }
  }

  console.log(`✅ ${logFiles.length} fichier(s) d'events de logs détecté(s).`)
} else {
  console.warn("⚠️ Dossier events/logs introuvable.")
}

// --- Gestion des erreurs globales ---
process.on("unhandledRejection", (error) => {
  console.error("❌ Promesse rejetée non gérée :")
  console.error(error)
})

process.on("uncaughtException", (error) => {
  console.error("❌ Exception non capturée :")
  console.error(error)
})

// --- Démarrage du bot ---
async function startBot() {
  console.log("🌐 Connexion à MongoDB...")
  await connectMongo()

  console.log("🔐 Connexion au bot Discord...")
  await client.login(process.env.TOKEN)
}

startBot()