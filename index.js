require("dotenv").config()
const { Client, GatewayIntentBits, Collection } = require("discord.js")
const { MongoClient, ObjectId } = require("mongodb")
const fs = require("fs")
const path = require("path")

// --- Client Discord ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] })
client.commands = new Collection()

// --- Charger les commandes ---
const commandsPath = path.join(__dirname, "commands")
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"))

for(const file of commandFiles){
    const command = require(`./commands/${file}`)
    client.commands.set(command.data.name, command)
}

// --- Connexion MongoDB ---
const mongoClient = new MongoClient(process.env.MONGO_URI)
let db
mongoClient.connect().then(() => {
    db = mongoClient.db("arcaneRPG")
    client.db = db
    console.log("✅ MongoDB connecté")
}).catch(console.error)

// --- Event: ready ---
client.once("ready", () => {
    console.log(`✅ Bot connecté en tant que ${client.user.tag}`)
})

// --- Event: interactionCreate ---
client.on("interactionCreate", async interaction => {
    try {
        // --- Slash commands ---
        if(interaction.isChatInputCommand()){
            const command = client.commands.get(interaction.commandName)
            if(!command) return
            await command.execute(interaction, client)
        }

        // --- Modal submit pour /editperso ---
        if(interaction.isModalSubmit()){
            if(interaction.customId.startsWith("edit_modal_")){
                const charId = interaction.customId.split("_")[2]
                const characters = client.db.collection("characters")

                await characters.updateOne(
                    { _id: new ObjectId(charId) },
                    { $set: {
                        nom: interaction.fields.getTextInputValue("nom"),
                        prenom: interaction.fields.getTextInputValue("prenom"),
                        age: interaction.fields.getTextInputValue("age"),
                        sexe: interaction.fields.getTextInputValue("sexe"),
                        orientation: interaction.fields.getTextInputValue("orientation"),
                        description: interaction.fields.getTextInputValue("description"),
                        image: interaction.fields.getTextInputValue("image")
                    }}
                )

                await interaction.reply({ content: "✅ Personnage mis à jour !", ephemeral: true })
            }
        }
    } catch(err) {
        console.error(err)
        if(interaction.replied || interaction.deferred){
            interaction.editReply({ content: "❌ Une erreur est survenue." }).catch(()=>{})
        } else {
            interaction.reply({ content: "❌ Une erreur est survenue.", ephemeral:true }).catch(()=>{})
        }
    }
})

// --- Login ---
client.login(process.env.TOKEN)