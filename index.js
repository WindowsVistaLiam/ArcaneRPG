require("dotenv").config()
const { Client, GatewayIntentBits, Collection } = require("discord.js")
const { MongoClient, ObjectId } = require("mongodb")
const fs = require("fs")
const path = require("path")

console.log("🔹 Démarrage du bot...")

// --- Vérification des variables d'environnement ---
const requiredEnv = ["TOKEN", "MONGO_URI"]
const missing = requiredEnv.filter(v => !process.env[v])

if (missing.length > 0) {
    console.error(`❌ Variables d'environnement manquantes : ${missing.join(", ")}`)
    process.exit(1)
}

console.log("✅ Toutes les variables d'environnement sont présentes.")

// --- Client Discord ---
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
})

client.commands = new Collection()

// --- Charger les commandes ---
const commandsPath = path.join(__dirname, "commands")
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"))

for (const file of commandFiles) {
    const command = require(`./commands/${file}`)
    client.commands.set(command.data.name, command)
}

console.log(`✅ ${commandFiles.length} commandes chargées.`)

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

// --- Event READY ---
client.once("ready", () => {
    console.log(`✅ Bot connecté en tant que ${client.user.tag}`)
})

// --- Event interactions ---
client.on("interactionCreate", async interaction => {

    try {

        // --- Slash commands ---
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName)
            if (!command) return

            await command.execute(interaction, client)
        }

        // --- Modal submit pour /editperso ---
        if (interaction.isModalSubmit() && interaction.customId.startsWith("edit_modal_")) {

            const charId = interaction.customId.split("_")[2]
            const characters = client.db.collection("characters")

            // récupérer nom + prénom
            const nomPrenom = interaction.fields.getTextInputValue("nom_prenom")

            let nom = ""
            let prenom = ""

            if (nomPrenom) {
                const parts = nomPrenom.split(" ")
                prenom = parts.shift() || ""
                nom = parts.join(" ") || ""
            }

            await characters.updateOne(
                { _id: new ObjectId(charId) },
                {
                    $set: {
                        nom: nom,
                        prenom: prenom,
                        age: interaction.fields.getTextInputValue("age"),
                        sexe: interaction.fields.getTextInputValue("sexe"),
                        orientation: interaction.fields.getTextInputValue("orientation"),
                        description: interaction.fields.getTextInputValue("description")
                    }
                }
            )

            await interaction.reply({
                content: "✅ Personnage mis à jour !",
                ephemeral: true
            })
        }

    } catch (err) {

        console.error("❌ Erreur interaction :", err)

        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({
                content: "❌ Une erreur est survenue."
            }).catch(() => {})
        } else {
            await interaction.reply({
                content: "❌ Une erreur est survenue.",
                ephemeral: true
            }).catch(() => {})
        }

    }

})

// --- Démarrage du bot ---
async function startBot() {

    console.log("🌐 Connexion à MongoDB...")
    await connectMongo()

    console.log("🔐 Connexion au bot Discord...")
    await client.login(process.env.TOKEN)

}

startBot()