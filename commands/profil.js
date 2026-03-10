const { SlashCommandBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require("discord.js")
const { characterEmbed } = require("../style")  // <-- style Arcane

module.exports = {
    data: new SlashCommandBuilder()
        .setName("profil")
        .setDescription("Voir vos personnages ou ceux d'un autre utilisateur")
        .addUserOption(option => 
            option.setName("utilisateur")
                  .setDescription("Utilisateur dont vous voulez voir le profil")
                  .setRequired(false)
        ),

    async execute(interaction, client) {
        const user = interaction.options.getUser("utilisateur") || interaction.user

        const characters = client.db.collection("characters")
        const persos = await characters.find({ userId: user.id }).toArray()

        if (persos.length === 0) {
            const msg = user.id === interaction.user.id
                ? "Tu n'as aucun personnage."
                : `${user.username} n'a aucun personnage.`
            return interaction.reply({ content: msg, ephemeral: true })
        }

        let page = 0

        // --- Boutons de navigation ---
        const prev = new ButtonBuilder().setCustomId("prev").setLabel("⬅️").setStyle(ButtonStyle.Primary)
        const next = new ButtonBuilder().setCustomId("next").setLabel("➡️").setStyle(ButtonStyle.Primary)
        const row = new ActionRowBuilder().addComponents(prev, next)

        // --- Fonction pour générer l'embed ---
        const generateEmbed = () => characterEmbed(persos[page], page, persos.length)

        // ⚡️ deferReply pour gérer le temps de traitement
        await interaction.deferReply()

        // ⚡️ Envoi initial de l'embed
        const msg = await interaction.editReply({
            embeds: [generateEmbed()],
            components: [row]
        })

        // --- Collector pour les boutons ---
        const collector = msg.createMessageComponentCollector({ time: 60000 })

        collector.on("collect", i => {
            if (i.user.id !== interaction.user.id) return

            if (i.customId === "prev") page = page > 0 ? page - 1 : persos.length - 1
            if (i.customId === "next") page = page + 1 < persos.length ? page + 1 : 0

            i.update({ embeds: [generateEmbed()] })
        })

        collector.on("end", () => {
            // Désactiver les boutons après expiration
            const disabledRow = new ActionRowBuilder().addComponents(
                prev.setDisabled(true),
                next.setDisabled(true)
            )
            interaction.editReply({ components: [disabledRow] }).catch(() => {})
        })
    }
}