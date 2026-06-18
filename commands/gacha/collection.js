const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require("discord.js")

const arcaneCards = require("../../data/arcaneCards")
const fusionCards = require("../../data/fusionCards")

const allCards = [...arcaneCards, ...fusionCards]

const LIST_PAGE_SIZE = 15

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

const FEATURED_RARITIES = new Set(["mythic", "legendary"])

function getCardFromCatalog(cardKey) {
  return allCards.find((card) => card.key === cardKey)
}

function formatCardName(cardKey, playerCard = null) {
  const card = getCardFromCatalog(cardKey)

  if (card?.name) return card.name
  if (playerCard?.cardName) return playerCard.cardName
  if (playerCard?.name) return playerCard.name
  if (playerCard?.characterName) return playerCard.characterName

  return cardKey
}

function getRarity(cardKey, playerCard = null) {
  const card = getCardFromCatalog(cardKey)

  return card?.rarity || playerCard?.rarity || "common"
}

function getRarityLabel(cardKey, playerCard = null) {
  const card = getCardFromCatalog(cardKey)

  return card?.rarityLabel || playerCard?.rarityLabel || "Commun"
}

function getCardValue(cardKey, playerCard = null) {
  const card = getCardFromCatalog(cardKey)

  return card?.value || playerCard?.value || 0
}

function getCardImage(cardKey, playerCard = null) {
  const card = getCardFromCatalog(cardKey)

  return card?.image || playerCard?.image || ""
}

function getCardDescription(cardKey, playerCard = null) {
  const card = getCardFromCatalog(cardKey)

  return card?.description || playerCard?.description || "Carte de collection."
}

function getCardSource(cardKey, playerCard = null) {
  const card = getCardFromCatalog(cardKey)

  return card?.source || playerCard?.source || "arcane"
}

async function getWallet(client, userId) {
  const wallet = await client.db.collection("player_wallets").findOne({ userId })

  return {
    fragments: wallet?.fragments || 0,
  }
}

function buildCardLine(entry) {
  const emoji = RARITY_EMOJIS[entry.rarity] || "⚪"
  const duplicateText = entry.count > 1 ? ` **x${entry.count}**` : ""

  return `${emoji} **${entry.name}**${duplicateText} — ${entry.rarityLabel}`
}

function groupPlayerCards(playerCards) {
  const grouped = new Map()

  for (const playerCard of playerCards) {
    const key = playerCard.cardKey

    if (!grouped.has(key)) {
      grouped.set(key, {
        cardKey: key,
        count: 0,
        name: formatCardName(key, playerCard),
        rarity: getRarity(key, playerCard),
        rarityLabel: getRarityLabel(key, playerCard),
        value: getCardValue(key, playerCard),
        image: getCardImage(key, playerCard),
        description: getCardDescription(key, playerCard),
        source: getCardSource(key, playerCard),
      })
    }

    grouped.get(key).count += 1
  }

  return Array.from(grouped.values()).sort((a, b) => {
    const rarityDiff = (RARITY_ORDER[a.rarity] || 99) - (RARITY_ORDER[b.rarity] || 99)

    if (rarityDiff !== 0) return rarityDiff

    return a.name.localeCompare(b.name)
  })
}

function getCollectionStats({ playerCards, groupedCards, wallet }) {
  const totalCards = playerCards.length
  const uniqueCards = groupedCards.length
  const duplicateCount = totalCards - uniqueCards

  const totalValue = playerCards.reduce((sum, playerCard) => {
    return sum + getCardValue(playerCard.cardKey, playerCard)
  }, 0)

  return {
    totalCards,
    uniqueCards,
    duplicateCount,
    totalValue,
    fragments: wallet.fragments,
  }
}

function buildFeaturedPageEmbed({
  user,
  entry,
  page,
  totalPages,
  stats,
}) {
  const emoji = RARITY_EMOJIS[entry.rarity] || "🎴"
  const duplicateText = entry.count > 1 ? ` x${entry.count}` : ""
  const sourceText = entry.source === "fusion" ? "🧬 Carte fusion" : "🎴 Carte Arcane"

  const embed = new EmbedBuilder()
    .setTitle(`${emoji} ${entry.name}${duplicateText}`)
    .setColor(RARITY_COLORS[entry.rarity] || 0x5865f2)
    .setDescription(entry.description || "Carte de collection.")
    .addFields(
      {
        name: "Rareté",
        value: `**${entry.rarityLabel}**`,
        inline: true,
      },
      {
        name: "Valeur",
        value: `⭐ ${entry.value} pts`,
        inline: true,
      },
      {
        name: "Type",
        value: sourceText,
        inline: true,
      },
      {
        name: "Collection",
        value:
          `🎴 Total : **${stats.totalCards}**\n` +
          `📘 Uniques : **${stats.uniqueCards}/${allCards.length}**\n` +
          `♻️ Doublons : **${stats.duplicateCount}**\n` +
          `💠 Fragments : **${stats.fragments}**`,
        inline: false,
      }
    )
    .setFooter({
      text: `Collection de ${user.username} • Carte ${page + 1}/${totalPages}`,
    })
    .setTimestamp()

  if (entry.image) {
    embed.setImage(entry.image)
  }

  return embed
}

function buildListPageEmbed({
  user,
  listCards,
  listPage,
  totalListPages,
  page,
  totalPages,
  stats,
}) {
  const start = listPage * LIST_PAGE_SIZE
  const pageCards = listCards.slice(start, start + LIST_PAGE_SIZE)

  const list = pageCards.length
    ? pageCards.map(buildCardLine).join("\n")
    : "Aucune carte épique, rare ou commune à afficher."

  const embed = new EmbedBuilder()
    .setTitle(`Collection de ${user.username}`)
    .setColor(0x5865f2)
    .setDescription(
      "📜 **Cartes épiques, rares et communes**\n\n" +
      list
    )
    .addFields(
      {
        name: "Total",
        value: `🎴 ${stats.totalCards}`,
        inline: true,
      },
      {
        name: "Uniques",
        value: `📘 ${stats.uniqueCards}/${allCards.length}`,
        inline: true,
      },
      {
        name: "Doublons",
        value: `♻️ ${stats.duplicateCount}`,
        inline: true,
      },
      {
        name: "Valeur",
        value: `⭐ ${stats.totalValue} pts`,
        inline: true,
      },
      {
        name: "Fragments",
        value: `💠 ${stats.fragments}`,
        inline: true,
      },
      {
        name: "Liste",
        value: `${listPage + 1}/${totalListPages}`,
        inline: true,
      }
    )
    .setFooter({
      text: `Collection Arcane • Page ${page + 1}/${totalPages}`,
    })
    .setTimestamp()

  return embed
}

function buildCollectionPages({ user, groupedCards, stats }) {
  const featuredCards = groupedCards.filter((entry) => {
    return FEATURED_RARITIES.has(entry.rarity)
  })

  const listCards = groupedCards.filter((entry) => {
    return !FEATURED_RARITIES.has(entry.rarity)
  })

  const totalListPages = Math.max(1, Math.ceil(listCards.length / LIST_PAGE_SIZE))
  const totalPages = featuredCards.length + totalListPages

  return {
    featuredCards,
    listCards,
    totalListPages,
    totalPages: Math.max(1, totalPages),
  }
}

async function buildCollectionEmbed(client, user, page) {
  const playerCards = await client.db
    .collection("player_cards")
    .find({ userId: user.id })
    .toArray()

  const wallet = await getWallet(client, user.id)

  if (!playerCards.length) {
    const embed = new EmbedBuilder()
      .setTitle(`Collection de ${user.username}`)
      .setColor(0x5865f2)
      .setDescription("Cette collection est vide.")
      .addFields({
        name: "Fragments",
        value: `💠 ${wallet.fragments}`,
        inline: true,
      })
      .setTimestamp()

    return {
      embed,
      totalPages: 1,
      page: 0,
    }
  }

  const groupedCards = groupPlayerCards(playerCards)
  const stats = getCollectionStats({
    playerCards,
    groupedCards,
    wallet,
  })

  const {
    featuredCards,
    listCards,
    totalListPages,
    totalPages,
  } = buildCollectionPages({
    user,
    groupedCards,
    stats,
  })

  const safePage = Math.min(Math.max(page, 0), totalPages - 1)

  if (safePage < featuredCards.length) {
    const entry = featuredCards[safePage]

    return {
      embed: buildFeaturedPageEmbed({
        user,
        entry,
        page: safePage,
        totalPages,
        stats,
      }),
      totalPages,
      page: safePage,
    }
  }

  const listPage = safePage - featuredCards.length

  return {
    embed: buildListPageEmbed({
      user,
      listCards,
      listPage,
      totalListPages,
      page: safePage,
      totalPages,
      stats,
    }),
    totalPages,
    page: safePage,
  }
}

function buildButtons(userId, page, totalPages) {
  const previous = new ButtonBuilder()
    .setCustomId(`collection:prev:${userId}:${page}`)
    .setLabel("⬅️")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page <= 0)

  const next = new ButtonBuilder()
    .setCustomId(`collection:next:${userId}:${page}`)
    .setLabel("➡️")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(page >= totalPages - 1)

  return new ActionRowBuilder().addComponents(previous, next)
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("collection")
    .setDescription("Voir ta collection de cartes Arcane ou celle d'un joueur")
    .addUserOption((option) =>
      option
        .setName("utilisateur")
        .setDescription("Utilisateur dont tu veux voir la collection")
        .setRequired(false)
    ),

  async execute(interaction, client) {
    await interaction.deferReply()

    const user = interaction.options.getUser("utilisateur") || interaction.user

    const result = await buildCollectionEmbed(client, user, 0)
    const row = buildButtons(user.id, result.page || 0, result.totalPages)

    return interaction.editReply({
      embeds: [result.embed],
      components: [row],
    })
  },

  async handleButton(interaction, client) {
    if (!interaction.customId.startsWith("collection:")) return

    const parts = interaction.customId.split(":")
    const action = parts[1]
    const userId = parts[2]
    const currentPage = Number(parts[3]) || 0

    const user = await client.users.fetch(userId).catch(() => null)

    if (!user) {
      return interaction.reply({
        content: "❌ Utilisateur introuvable.",
        ephemeral: true,
      })
    }

    let newPage = currentPage

    if (action === "prev") {
      newPage = currentPage - 1
    }

    if (action === "next") {
      newPage = currentPage + 1
    }

    const result = await buildCollectionEmbed(client, user, newPage)
    const row = buildButtons(user.id, result.page || 0, result.totalPages)

    return interaction.update({
      embeds: [result.embed],
      components: [row],
    })
  },
}