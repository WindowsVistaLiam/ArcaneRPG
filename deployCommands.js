require("dotenv").config();

const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

// --- Vérification des variables d'environnement ---
const requiredEnv = ["TOKEN", "CLIENT_ID"];
const missing = requiredEnv.filter((v) => !process.env[v]);

if (missing.length > 0) {
  console.error(`❌ Variables d'environnement manquantes : ${missing.join(", ")}`);
  process.exit(1);
}

// --- Récupérer toutes les commandes ---
const commands = [];
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((f) => f.endsWith(".js"));

console.log(`📁 Fichiers trouvés dans commands : ${commandFiles.join(", ")}`);

for (const file of commandFiles) {
  try {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if (!command.data || !command.data.name) {
      console.warn(`⚠️ Commande ignorée : ${file} — data.name manquant`);
      continue;
    }

    commands.push(command.data.toJSON());
    console.log(`✅ Commande chargée : /${command.data.name}`);
  } catch (error) {
    console.error(`❌ Erreur lors du chargement de ${file} :`, error);
  }
}

// --- Créer le client REST ---
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log(`🚀 Déploiement de ${commands.length} commandes...`);
    console.log(`CLIENT_ID utilisé : ${process.env.CLIENT_ID}`);

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );

    console.log("✅ Commandes déployées avec succès !");
  } catch (error) {
    console.error("❌ Erreur lors du déploiement des commandes :", error);
  }
})();