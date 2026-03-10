require("dotenv").config()
const { REST, Routes } = require("discord.js")
const fs = require("fs")
const path = require("path")

// --- Récupérer toutes les commandes ---
const commands = []
const commandFiles = fs.readdirSync(path.join(__dirname, "commands")).filter(f => f.endsWith(".js"))

for (const file of commandFiles) {
    const command = require(`./commands/${file}`)
    commands.push(command.data.toJSON())
}

// --- Créer le client REST et définir le token correctement ---
const rest = new REST({ version: "10" })
rest.setToken(process.env.TOKEN) // ⚠️ doit être sur une ligne séparée

;(async () => {
    try {
        console.log("Déploiement des commandes...")

        // Déploiement global (prendre en compte que les commandes peuvent mettre jusqu'à 1h pour apparaître)
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        )

        console.log("Commandes déployées ✅")
    } catch (error) {
        console.error("Erreur lors du déploiement des commandes :", error)
    }
})()