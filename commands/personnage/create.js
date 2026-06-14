const { SlashCommandBuilder } = require("discord.js")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("create")
        .setDescription("Créer un personnage")
        .addStringOption(o => o.setName("nom").setRequired(true).setDescription("Nom du personnage"))
        .addStringOption(o => o.setName("prenom").setRequired(true).setDescription("Prénom"))
        .addStringOption(o => o.setName("age").setRequired(true).setDescription("Âge"))
        .addStringOption(o => o.setName("sexe").setRequired(true).setDescription("Sexe"))
        .addStringOption(o => o.setName("orientation").setRequired(true).setDescription("Orientation sexuelle"))
        .addStringOption(o => o.setName("description").setRequired(true).setDescription("Description"))
        .addStringOption(o => o.setName("image").setRequired(true).setDescription("URL de l'image")),

    async execute(interaction, client){
        const characters = client.db.collection("characters")
        const doc = {
            userId: interaction.user.id,
            nom: interaction.options.getString("nom"),
            prenom: interaction.options.getString("prenom"),
            age: interaction.options.getString("age"),
            sexe: interaction.options.getString("sexe"),
            orientation: interaction.options.getString("orientation"),
            description: interaction.options.getString("description"),
            image: interaction.options.getString("image")
        }

        // ⚡️ Gérer correctement le reply
        await interaction.deferReply({ ephemeral: true })  // on accorde du temps pour la DB
        await characters.insertOne(doc)
        await interaction.editReply(`✅ Personnage **${doc.prenom} ${doc.nom}** créé !`)
    }
}