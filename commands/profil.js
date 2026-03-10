const { SlashCommandBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require("discord.js")
const { characterEmbed } = require("../style")  // <-- style Arcane

module.exports = {
    data: new SlashCommandBuilder()
        .setName("profil")
        .setDescription("Voir vos personnages"),

    async execute(interaction, client) {
        const characters = client.db.collection("characters")
        const persos = await characters.find({ userId: interaction.user.id }).toArray()

        if (persos.length === 0) {
            return interaction.reply({ content: "Tu n'as aucun personnage.", ephemeral: true })
        }

        let page = 0

        // --- Boutons de navigation ---
        const prev = new ButtonBuilder().setCustomId("prev").setLabel("⬅️").setStyle(ButtonStyle.Primary)
        const next = new ButtonBuilder().setCustomId("next").setLabel("➡️").setStyle(ButtonStyle.Primary)
        const row = new ActionRowBuilder().addComponents(prev, next)

        // --- Déclarer la fonction generateEmbed avec style ---
        const generateEmbed = () => characterEmbed(persos[page], page, persos.length)

        // ⚡️ deferReply pour gérer le temps de traitement
        await interaction.deferReply()

        // ⚡️ Envoi initial de l'embed
        const msg = await interaction.editReply({
            embeds: [generateEmbed()],
            components: [row],
            fetchReply: true
        })

        // --- Collector pour les boutons ---
        const collector = msg.createMessageComponentCollector({ time: 60000 })

        collector.on("collect", i => {
            if (i.user.id !== interaction.user.id) return

            if (i.customId === "prev") page = page > 0 ? page - 1 : persos.length - 1
            if (i.customId === "next") page = page + 1 < persos.length ? page + 1 : 0

            // ⚡️ update du message avec le nouvel embed
            i.update({ embeds: [generateEmbed()] })
        })

        collector.on("end", () => {
            // Désactiver les boutons après expiration pour éviter interactions inutiles
            const disabledRow = new ActionRowBuilder().addComponents(
                prev.setDisabled(true),
                next.setDisabled(true)
            )
            interaction.editReply({ components: [disabledRow] }).catch(() => {})
        })
    }
}