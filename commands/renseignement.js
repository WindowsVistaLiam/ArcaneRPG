const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js")

const arcaneCards = require("../data/arcaneCards")

const RARITY_COLORS = {
  common: 0x95a5a6,
  rare: 0x3498db,
  epic: 0x9b59b6,
  legendary: 0xf1c40f,
  mythic: 0xe74c3c,
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function findCard(search) {
  const query = normalizeText(search)

  return arcaneCards.find((card) => {
    return (
      normalizeText(card.key).includes(query) ||
      normalizeText(card.name).includes(query) ||
      normalizeText(card.characterName || "").includes(query) ||
      normalizeText(card.characterKey || "").includes(query)
    )
  })
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("renseignement")
    .setDescription("Obtenir des renseignements sur une carte Arcane")
    .addStringOption((option) =>
      option
        .setName("carte")
        .setDescription("Nom de la carte ou du personnage")
        .setRequired(true)
    ),

  async execute(interaction, client) {
    const search = interaction.options.getString("carte")
    const card = findCard(search)

    if (!card) {
      return interaction.reply({
        content: `❌ Aucune carte trouvée pour : **${search}**.`,
        ephemeral: true,
      })
    }

    const ownedCount = await client.db.collection("player_cards").countDocuments({
      userId: interaction.user.id,
      cardKey: card.key,
    })

    const totalOwned = await client.db.collection("player_cards").countDocuments({
      cardKey: card.key,
    })

    const embed = new EmbedBuilder()
      .setTitle(`🔎 ${card.name}`)
      .setColor(RARITY_COLORS[card.rarity] || 0x5865f2)
      .setDescription(card.description || "Aucune description.")
      .addFields(
        {
          name: "Personnage",
          value: card.characterName || "Inconnu",
          inline: true,
        },
        {
          name: "Rareté",
          value: card.rarityLabel || card.rarity,
          inline: true,
        },
        {
          name: "Valeur",
          value: `⭐ ${card.value || 0} pts`,
          inline: true,
        },
        {
          name: "Faction",
          value: card.faction || "Inconnue",
          inline: true,
        },
        {
          name: "Saison",
          value: card.season || "Arcane",
          inline: true,
        },
        {
          name: "Dans ta collection",
          value: ownedCount > 0
            ? `✅ Oui — x${ownedCount}`
            : "❌ Non",
          inline: true,
        },
        {
          name: "Possédée sur le serveur",
          value: `🎴 ${totalOwned} exemplaire${totalOwned > 1 ? "s" : ""}`,
          inline: true,
        }
      )
      .setFooter({
        text: `ID carte : ${card.key}`,
      })
      .setTimestamp()

    if (card.tags && card.tags.length) {
      embed.addFields({
        name: "Tags",
        value: card.tags.join(", ").slice(0, 1024),
        inline: false,
      })
    }

    if (card.image) {
      embed.setImage(card.image)
    }

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    })
  },
}