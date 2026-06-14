const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js")

const arcaneCards = require("../data/arcaneCards")
const { getCardStats } = require("../utils/cardBattle")

const RARITY_COLORS = {
  common: 0x95a5a6,
  rare: 0x3498db,
  epic: 0x9b59b6,
  legendary: 0xf1c40f,
  mythic: 0xe74c3c,
}

const RARITY_EMOJIS = {
  common: "⚪",
  rare: "🔵",
  epic: "🟣",
  legendary: "🟡",
  mythic: "🔴",
}

function normalizeText(text) {
  return String(text)
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
    .setName("statscarte")
    .setDescription("Voir les statistiques de combat d'une carte")
    .addStringOption((option) =>
      option
        .setName("carte")
        .setDescription("Nom ou ID de la carte")
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

    const stats = getCardStats(card)
    const emoji = RARITY_EMOJIS[card.rarity] || "🎴"

    const embed = new EmbedBuilder()
      .setTitle(`${emoji} Stats — ${card.name}`)
      .setColor(RARITY_COLORS[card.rarity] || 0x5865f2)
      .setDescription(card.description || "Carte Arcane")
      .addFields(
        {
          name: "ID",
          value: `\`${card.key}\``,
          inline: false,
        },
        {
          name: "Rareté",
          value: card.rarityLabel || card.rarity,
          inline: true,
        },
        {
          name: "Possédée",
          value: ownedCount > 0 ? `✅ Oui — x${ownedCount}` : "❌ Non",
          inline: true,
        },
        {
          name: "Puissance",
          value: `⚡ ${stats.power}`,
          inline: true,
        },
        {
          name: "PV",
          value: `❤️ ${stats.hp}`,
          inline: true,
        },
        {
          name: "Attaque",
          value: `⚔️ ${stats.attack}`,
          inline: true,
        },
        {
          name: "Défense",
          value: `🛡️ ${stats.defense}`,
          inline: true,
        },
        {
          name: "Vitesse",
          value: `💨 ${stats.speed}`,
          inline: true,
        }
      )
      .setFooter({
        text: "Statistiques générées automatiquement selon la rareté",
      })
      .setTimestamp()

    if (card.image) {
      embed.setImage(card.image)
    }

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    })
  },
}