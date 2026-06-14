const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require("discord.js")

const arcaneCards = require("../../data/arcaneCards")

const RARITY_ORDER = {
  mythic: 1,
  legendary: 2,
  epic: 3,
  rare: 4,
  common: 5,
}

const RARITY_EMOJIS = {
  common: "⚪",
  rare: "🔵",
  epic: "🟣",
  legendary: "🟡",
  mythic: "🔴",
}

function getCardFromCatalog(cardKey) {
  return arcaneCards.find((card) => card.key === cardKey)
}

function formatCardName(cardKey) {
  const card = getCardFromCatalog(cardKey)
  return card ? card.name : cardKey
}

function getRarity(cardKey) {
  const card = getCardFromCatalog(cardKey)
  return card?.rarity || "common"
}

async function getWallet(client, userId) {
  const wallet = await client.db.collection("player_wallets").findOne({ userId })

  return {
    fragments: wallet?.fragments || 0,
  }
}

async function buildCollectionEmbed(client, user, page, pageSize = 10) {
  const playerCards = await client.db
    .collection("player_cards")
    .find({ userId: user.id })
    .toArray()

  const wallet = await getWallet(client, user.id)

  if (!playerCards.length) {
    return {
      embed: new EmbedBuilder()
        .setTitle(`Collection de ${user.username}`)
        .setColor(0x5865f2)
        .setDescription("Cette collection est vide.")
        .addFields({
          name: "Fragments",
          value: `💠 ${wallet.fragments}`,
          inline: true,
        }),
      totalPages: 1,
    }
  }

  const grouped = new Map()

  for (const card of playerCards) {
    const key = card.cardKey

    if (!grouped.has(key)) {
      grouped.set(key, {
        cardKey: key,
        count: 0,
        rarity: card.rarity || getRarity(key),
        rarityLabel: card.rarityLabel || getCardFromCatalog(key)?.rarityLabel || "Commun",
        value: card.value || getCardFromCatalog(key)?.value || 0,
      })
    }

    grouped.get(key).count += 1
  }

  const cards = Array.from(grouped.values()).sort((a, b) => {
    const rarityDiff = (RARITY_ORDER[a.rarity] || 99) - (RARITY_ORDER[b.rarity] || 99)
    if (rarityDiff !== 0) return rarityDiff

    return formatCardName(a.cardKey).localeCompare(formatCardName(b.cardKey))
  })

  const totalCards = playerCards.length
  const uniqueCards = cards.length
  const duplicateCount = totalCards - uniqueCards
  const totalValue = playerCards.reduce((sum, card) => sum + (card.value || 0), 0)

  const totalPages = Math.max(1, Math.ceil(cards.length / pageSize))
  const safePage = Math.min(Math.max(page, 0), totalPages - 1)

  const start = safePage * pageSize
  const pageCards = cards.slice(start, start + pageSize)

  const list = pageCards
    .map((entry) => {
      const emoji = RARITY_EMOJIS[entry.rarity] || "⚪"
      const name = formatCardName(entry.cardKey)
      const duplicateText = entry.count > 1 ? ` **x${entry.count}**` : ""

      return `${emoji} **${name}**${duplicateText} — ${entry.rarityLabel}`
    })
    .join("\n")

  const embed = new EmbedBuilder()
    .setTitle(`Collection de ${user.username}`)
    .setColor(0x5865f2)
    .setDescription(list || "Aucune carte à afficher.")
    .addFields(
      {
        name: "Total",
        value: `🎴 ${totalCards}`,
        inline: true,
      },
      {
        name: "Uniques",
        value: `📘 ${uniqueCards}/${arcaneCards.length}`,
        inline: true,
      },
      {
        name: "Doublons",
        value: `♻️ ${duplicateCount}`,
        inline: true,
      },
      {
        name: "Valeur",
        value: `⭐ ${totalValue} pts`,
        inline: true,
      },
      {
        name: "Fragments",
        value: `💠 ${wallet.fragments}`,
        inline: true,
      },
      {
        name: "Page",
        value: `${safePage + 1}/${totalPages}`,
        inline: true,
      }
    )
    .setFooter({
      text: "Collection Arcane",
    })
    .setTimestamp()

  return {
    embed,
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
    const user = interaction.options.getUser("utilisateur") || interaction.user

    const result = await buildCollectionEmbed(client, user, 0)
    const row = buildButtons(user.id, result.page || 0, result.totalPages)

    return interaction.reply({
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