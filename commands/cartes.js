const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js")

const arcaneCards = require("../data/arcaneCards")

const RARITY_ORDER = {
  mythic: 1,
  legendary: 2,
  epic: 3,
  rare: 4,
  common: 5,
}

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

function sortCards(cards) {
  return [...cards].sort((a, b) => {
    const rarityDiff =
      (RARITY_ORDER[a.rarity] || 99) - (RARITY_ORDER[b.rarity] || 99)

    if (rarityDiff !== 0) {
      return rarityDiff
    }

    return a.name.localeCompare(b.name)
  })
}

function filterCards(search) {
  const cards = sortCards(arcaneCards)

  if (!search) {
    return cards
  }

  const query = normalizeText(search)

  return cards.filter((card) => {
    return (
      normalizeText(card.key).includes(query) ||
      normalizeText(card.name).includes(query) ||
      normalizeText(card.characterName || "").includes(query) ||
      normalizeText(card.characterKey || "").includes(query) ||
      normalizeText(card.rarityLabel || "").includes(query) ||
      normalizeText(card.rarity || "").includes(query) ||
      normalizeText(card.faction || "").includes(query)
    )
  })
}

function buildCardEmbed(cards, index, search = "") {
  const card = cards[index]
  const emoji = RARITY_EMOJIS[card.rarity] || "⚪"

  const embed = new EmbedBuilder()
    .setTitle(`${emoji} ${card.name}`)
    .setColor(RARITY_COLORS[card.rarity] || 0x5865f2)
    .setDescription(card.description || "Aucune description.")
    .addFields(
      {
        name: "ID",
        value: `\`${card.key}\``,
        inline: false,
      },
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
        name: "Progression",
        value: `${index + 1}/${cards.length}`,
        inline: true,
      }
    )
    .setFooter({
      text: search
        ? `Recherche : ${search}`
        : "Catalogue public des cartes Arcane",
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

  return embed
}

function buildButtons(index, total, search = "") {
  const encodedSearch = encodeURIComponent(search || "none")

  const previousButton = new ButtonBuilder()
    .setCustomId(`cartes:prev:${index}:${encodedSearch}`)
    .setLabel("⬅️ Précédente")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(index <= 0)

  const nextButton = new ButtonBuilder()
    .setCustomId(`cartes:next:${index}:${encodedSearch}`)
    .setLabel("Suivante ➡️")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(index >= total - 1)

  return new ActionRowBuilder().addComponents(previousButton, nextButton)
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cartes")
    .setDescription("Voir les cartes disponibles dans le bot")
    .addStringOption((option) =>
      option
        .setName("recherche")
        .setDescription("Chercher une carte, un personnage, une rareté ou une faction")
        .setRequired(false)
    ),

  async execute(interaction) {
    const search = interaction.options.getString("recherche") || ""
    const cards = filterCards(search)

    if (!cards.length) {
      return interaction.reply({
        content: `❌ Aucune carte trouvée pour : **${search}**.`,
        ephemeral: true,
      })
    }

    const index = 0
    const embed = buildCardEmbed(cards, index, search)
    const row = buildButtons(index, cards.length, search)

    return interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    })
  },

  async handleButton(interaction) {
    if (!interaction.customId.startsWith("cartes:")) return

    const parts = interaction.customId.split(":")
    const action = parts[1]
    const currentIndex = Number(parts[2]) || 0
    const rawSearch = parts[3] || "none"
    const search = rawSearch === "none" ? "" : decodeURIComponent(rawSearch)

    const cards = filterCards(search)

    if (!cards.length) {
      return interaction.reply({
        content: "❌ Aucune carte trouvée.",
        ephemeral: true,
      })
    }

    let newIndex = currentIndex

    if (action === "prev") {
      newIndex = Math.max(0, currentIndex - 1)
    }

    if (action === "next") {
      newIndex = Math.min(cards.length - 1, currentIndex + 1)
    }

    const embed = buildCardEmbed(cards, newIndex, search)
    const row = buildButtons(newIndex, cards.length, search)

    return interaction.update({
      embeds: [embed],
      components: [row],
    })
  },
}