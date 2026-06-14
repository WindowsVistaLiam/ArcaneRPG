const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require("discord.js")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("deleteperso")
        .setDescription("Supprimer un de vos personnages"),

    async execute(interaction, client) {
        const characters = client.db.collection("characters")
        const persos = await characters.find({ userId: interaction.user.id }).toArray()

        if(persos.length === 0) 
            return interaction.reply({ content: "Tu n'as aucun personnage à supprimer.", ephemeral: true })

        // ⚡️ deferReply pour intercepter l'interaction
        await interaction.deferReply({ ephemeral: true })

        const options = persos.map((c, index) => ({
            label: `${c.prenom} ${c.nom}`,
            description: c.description.substring(0, 50),
            value: index.toString()
        }))

        const menu = new StringSelectMenuBuilder()
            .setCustomId("delete_menu")
            .setPlaceholder("Sélectionne le personnage à supprimer")
            .addOptions(options)

        const row = new ActionRowBuilder().addComponents(menu)

        // Envoyer le menu
        const msg = await interaction.editReply({ content: "Quel personnage veux-tu supprimer ?", components: [row] })

        // Collector pour le menu
        const collector = msg.createMessageComponentCollector({ time: 60000 })

        collector.on("collect", async i => {
            if(i.user.id !== interaction.user.id) return

            if(i.customId === "delete_menu") {
                const index = parseInt(i.values[0])
                const toDelete = persos[index]

                await characters.deleteOne({ _id: toDelete._id })

                i.update({ content: `✅ Personnage **${toDelete.prenom} ${toDelete.nom}** supprimé.`, components: [] })
            }
        })
    }
}