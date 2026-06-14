require("dotenv").config()

const { REST, Routes } = require("discord.js")
const fs = require("fs")
const path = require("path")

// --- Vérification des variables d'environnement ---
const requiredEnv = ["TOKEN", "CLIENT_ID"]
const missing = requiredEnv.filter((v) => !process.env[v])

if (missing.length > 0) {
  console.error(`❌ Variables d'environnement manquantes : ${missing.join(", ")}`)
  process.exit(1)
}

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

// --- Récupérer toutes les commandes ---
const commands = []
const commandsPath = path.join(__dirname, "commands")

if (!fs.existsSync(commandsPath)) {
  console.error("❌ Dossier commands introuvable.")
  process.exit(1)
}

const commandFiles = getCommandFiles(commandsPath)

console.log(`📁 ${commandFiles.length} fichier(s) de commande trouvé(s) :`)

for (const filePath of commandFiles) {
  console.log(`- ${path.relative(__dirname, filePath)}`)
}

for (const filePath of commandFiles) {
  try {
    delete require.cache[require.resolve(filePath)]

    const command = require(filePath)

    if (!command.data || !command.data.name) {
      console.warn(`⚠️ Commande ignorée : ${path.relative(__dirname, filePath)} — data.name manquant`)
      continue
    }

    commands.push(command.data.toJSON())
    console.log(`✅ Commande chargée : /${command.data.name}`)
  } catch (error) {
    console.error(`❌ Erreur lors du chargement de ${path.relative(__dirname, filePath)} :`)
    console.error(error)
  }
}

// --- Créer le client REST ---
const rest = new REST({
  version: "10",
}).setToken(process.env.TOKEN)

;(async () => {
  try {
    console.log(`🚀 Déploiement de ${commands.length} commande(s)...`)
    console.log(`CLIENT_ID utilisé : ${process.env.CLIENT_ID}`)

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      {
        body: commands,
      }
    )

    console.log("✅ Commandes déployées avec succès !")
  } catch (error) {
    console.error("❌ Erreur lors du déploiement des commandes :")
    console.error(error)
  }
})()