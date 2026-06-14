const {
    SlashCommandBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle
} = require("discord.js")

const { characterEmbed } = require("../../style")

async function getPopularityScore(client, characterId) {
    return await client.db.collection("popularity_votes").countDocuments({
        characterId: characterId,
        value: 1
    })
}

async function getRelationsCount(client, characterId) {
    return await client.db.collection("relations").countDocuments({
        sourceCharacterId: characterId
    })
}

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

            return interaction.reply({
                content: msg,
                ephemeral: true
            })
        }

        let page = 0

        // --- Boutons de navigation ---
        const prev = new ButtonBuilder()
            .setCustomId("profil_prev")
            .setLabel("⬅️")
            .setStyle(ButtonStyle.Primary)

        const next = new ButtonBuilder()
            .setCustomId("profil_next")
            .setLabel("➡️")
            .setStyle(ButtonStyle.Primary)

        const row = new ActionRowBuilder().addComponents(prev, next)

        // --- Fonction pour générer l'embed avec la popularité ---
        const generateEmbed = async () => {
            const perso = persos[page]
            const embed = characterEmbed(perso, page, persos.length)

            const popularityScore = await getPopularityScore(client, perso._id)

            embed.addFields({
                name: "Popularité",
                value: `⭐ ${popularityScore} vote${popularityScore > 1 ? "s" : ""}`,
                inline: true
            })
            const relationsCount = await getRelationsCount(client, perso._id)

            embed.addFields({
                name: "Relations",
                value: `🔗 ${relationsCount} relation${relationsCount > 1 ? "s" : ""}`,
                inline: true
            })

            return embed
        }

        await interaction.deferReply()

        const msg = await interaction.editReply({
            embeds: [await generateEmbed()],
            components: [row]
        })

        // --- Collector pour les boutons ---
        const collector = msg.createMessageComponentCollector({
            time: 60000
        })

        collector.on("collect", async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({
                    content: "❌ Tu ne peux pas utiliser les boutons de ce profil.",
                    ephemeral: true
                })
            }

            if (i.customId === "profil_prev") {
                page = page > 0 ? page - 1 : persos.length - 1
            }

            if (i.customId === "profil_next") {
                page = page + 1 < persos.length ? page + 1 : 0
            }

            await i.update({
                embeds: [await generateEmbed()],
                components: [row]
            })
        })

        collector.on("end", () => {
            const disabledRow = new ActionRowBuilder().addComponents(
                ButtonBuilder.from(prev).setDisabled(true),
                ButtonBuilder.from(next).setDisabled(true)
            )

            interaction.editReply({
                components: [disabledRow]
            }).catch(() => {})
        })
    }
}