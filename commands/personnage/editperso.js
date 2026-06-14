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

                // ⚡ Champs fusionnés pour respecter la limite de 5 ActionRows
                const inputNomPrenom = new TextInputBuilder()
                    .setCustomId("nom_prenom")
                    .setLabel("Nom et Prénom")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setValue(`${charToEdit.nom} ${charToEdit.prenom}`)

                const inputAge = new TextInputBuilder()
                    .setCustomId("age")
                    .setLabel("Âge")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setValue(charToEdit.age || "")

                const inputGenre = new TextInputBuilder()
                    .setCustomId("sexe")
                    .setLabel("Genre")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setValue(charToEdit.sexe || "")

                const inputOrientation = new TextInputBuilder()
                    .setCustomId("orientation")
                    .setLabel("Orientation sexuelle")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setValue(charToEdit.orientation || "")

                const inputDescription = new TextInputBuilder()
                    .setCustomId("description")
                    .setLabel("Description")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setValue(charToEdit.description || "")

                // ⚡ Créer 5 ActionRows max
                modal.addComponents(
                    new ActionRowBuilder().addComponents(inputNomPrenom),
                    new ActionRowBuilder().addComponents(inputAge),
                    new ActionRowBuilder().addComponents(inputGenre),
                    new ActionRowBuilder().addComponents(inputOrientation),
                    new ActionRowBuilder().addComponents(inputDescription)
                )

                await i.showModal(modal)
            }
        })
    }
}