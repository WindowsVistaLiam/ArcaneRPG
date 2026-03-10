const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js")
const { ObjectId } = require("mongodb")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("editperso")
        .setDescription("Modifier un de vos personnages"),

    async execute(interaction, client) {
        const characters = client.db.collection("characters")
        const persos = await characters.find({ userId: interaction.user.id }).toArray()

        if(persos.length === 0) 
            return interaction.reply({ content: "Tu n'as aucun personnage à modifier.", ephemeral: true })

        await interaction.deferReply({ ephemeral: true }) // defer initial interaction

        const options = persos.map((c, index) => ({
            label: `${c.prenom} ${c.nom}`,
            description: c.description.substring(0, 50),
            value: index.toString()
        }))

        const menu = new StringSelectMenuBuilder()
            .setCustomId("edit_menu")
            .setPlaceholder("Sélectionne le personnage à modifier")
            .addOptions(options)

        const row = new ActionRowBuilder().addComponents(menu)

        const msg = await interaction.editReply({ content: "Quel personnage veux-tu modifier ?", components: [row] })

        const collector = msg.createMessageComponentCollector({ time: 60000 })

        collector.on("collect", async i => {
            if(i.user.id !== interaction.user.id) return

            if(i.customId === "edit_menu") {
                const index = parseInt(i.values[0])
                const charToEdit = persos[index]

                const modal = new ModalBuilder()
                    .setCustomId(`edit_modal_${charToEdit._id}`)
                    .setTitle(`Modifier ${charToEdit.prenom} ${charToEdit.nom}`)

                const fields = [
                    { id: "nom", label: "Nom", value: charToEdit.nom },
                    { id: "prenom", label: "Prénom", value: charToEdit.prenom },
                    { id: "age", label: "Âge", value: charToEdit.age },
                    { id: "sexe", label: "Sexe", value: charToEdit.sexe },
                    { id: "orientation", label: "Orientation sexuelle", value: charToEdit.orientation },
                    { id: "description", label: "Description", value: charToEdit.description },
                    { id: "image", label: "URL de l'image", value: charToEdit.image },
                ]

                for(const f of fields) {
                    const input = new TextInputBuilder()
                        .setCustomId(f.id)
                        .setLabel(f.label)
                        .setStyle(f.id === "description" ? TextInputStyle.Paragraph : TextInputStyle.Short)
                        .setRequired(true)
                        .setValue(f.value)
                    modal.addComponents(new ActionRowBuilder().addComponents(input))
                }

                await i.showModal(modal)
            }
        })
    }
}