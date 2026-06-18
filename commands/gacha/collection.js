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

const PAGE_SIZE = 9

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

const IMAGE_RARITIES = new Set(["legendary", "mythic"])

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

  return card?.description || playerCard?.description || ""
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

function buildImageEmbed(entry, user) {
  const emoji = RARITY_EMOJIS[entry.rarity] || "🎴"
  const duplicateText = entry.count > 1 ? ` x${entry.count}` : ""

  const embed = new EmbedBuilder()
    .setTitle(`${emoji} ${entry.name}${duplicateText}`)
    .setColor(entry.rarity === "mythic" ? 0xe74c3c : 0xf1c40f)
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
      }
    )
    .setFooter({
      text: `Collection de ${user.username}`,
    })

  if (entry.image) {
    embed.setImage(entry.image)
  }

  return embed
}

async function buildCollectionEmbeds(client, user, page, pageSize = PAGE_SIZE) {
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
      embeds: [embed],
      totalPages: 1,
      page: 0,
    }
  }

  const grouped = new Map()

  for (const card of playerCards) {
    const key = card.cardKey

    if (!grouped.has(key)) {
      grouped.set(key, {
        cardKey: key,
        count: 0,
        name: formatCardName(key, card),
        rarity: getRarity(key, card),
        rarityLabel: getRarityLabel(key, card),
        value: getCardValue(key, card),
        image: getCardImage(key, card),
        description: getCardDescription(key, card),
      })
    }

    grouped.get(key).count += 1
  }

  const cards = Array.from(grouped.values()).sort((a, b) => {
    const rarityDiff = (RARITY_ORDER[a.rarity] || 99) - (RARITY_ORDER[b.rarity] || 99)
    if (rarityDiff !== 0) return rarityDiff

    return a.name.localeCompare(b.name)
  })

  const totalCards = playerCards.length
  const uniqueCards = cards.length
  const duplicateCount = totalCards - uniqueCards
  const totalValue = playerCards.reduce((sum, card) => {
    return sum + getCardValue(card.cardKey, card)
  }, 0)

  const totalPages = Math.max(1, Math.ceil(cards.length / pageSize))
  const safePage = Math.min(Math.max(page, 0), totalPages - 1)

  const start = safePage * pageSize
  const pageCards = cards.slice(start, start + pageSize)

  const imageCards = pageCards.filter((entry) => {
    return IMAGE_RARITIES.has(entry.rarity) && entry.image
  })

  const listedCards = pageCards.filter((entry) => {
    return !IMAGE_RARITIES.has(entry.rarity) || !entry.image
  })

  const imageCardLines = imageCards.length
    ? imageCards.map(buildCardLine).join("\n")
    : "Aucune carte légendaire ou mythique avec image sur cette page."

  const listedCardLines = listedCards.length
    ? listedCards.map(buildCardLine).join("\n")
    : "Aucune carte commune, rare ou épique sur cette page."

  const mainEmbed = new EmbedBuilder()
    .setTitle(`Collection de ${user.username}`)
    .setColor(0x5865f2)
    .setDescription(
      "Les cartes **mythiques** et **légendaires** avec image sont affichées juste après cet encadré.\n" +
      "Les autres cartes restent en liste."
    )
    .addFields(
      {
        name: "Cartes affichées avec image",
        value: imageCardLines,
        inline: false,
      },
      {
        name: "Autres cartes",
        value: listedCardLines,
        inline: false,
      },
      {
        name: "Total",
        value: `🎴 ${totalCards}`,
        inline: true,
      },
      {
        name: "Uniques",
        value: `📘 ${uniqueCards}/${allCards.length}`,
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

  const imageEmbeds = imageCards.map((entry) => buildImageEmbed(entry, user))

  return {
    embeds: [mainEmbed, ...imageEmbeds],
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

    const result = await buildCollectionEmbeds(client, user, 0)
    const row = buildButtons(user.id, result.page || 0, result.totalPages)

    return interaction.editReply({
      embeds: result.embeds,
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

    const result = await buildCollectionEmbeds(client, user, newPage)
    const row = buildButtons(user.id, result.page || 0, result.totalPages)

    return interaction.update({
      embeds: result.embeds,
      components: [row],
    })
  },
}