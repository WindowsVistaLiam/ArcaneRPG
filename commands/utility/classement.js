const { SlashCommandBuilder, EmbedBuilder } = require("discord.js")

const arcaneCards = require("../../data/arcaneCards")
const fusionCards = require("../../data/fusionCards")
const cardAlbums = require("../../data/cardAlbums")

const allCards = [...arcaneCards, ...fusionCards]

const LEVELS = {
  1: {
    label: "Niveau 1",
    rarities: ["common", "rare"],
  },
  2: {
    label: "Niveau 2",
    rarities: ["rare", "epic"],
  },
  3: {
    label: "Niveau 3",
    rarities: ["epic", "legendary"],
  },
  4: {
    label: "Niveau 4",
    rarities: ["common", "rare", "epic", "legendary"],
  },
  5: {
    label: "Niveau 5",
    rarities: ["mythic"],
  },
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function getCardFromCatalog(cardKey) {
  return allCards.find((card) => card.key === cardKey)
}

function getCardTokens(card) {
  return [
    card.name,
    card.characterName,
    card.characterKey,
    card.faction,
    card.season,
    card.source,
    ...(card.tags || []),
  ]
    .filter(Boolean)
    .map(normalizeText)
}

function tokenMatches(cardTokens, values = []) {
  if (!values.length) return false

  return values.some((value) => {
    const normalizedValue = normalizeText(value)

    return cardTokens.some((token) => {
      return token === normalizedValue || token.includes(normalizedValue)
    })
  })
}

function isFusionCard(card) {
  return card.source === "fusion" || card.isPullable === false
}

function cardMatchesAlbum(card, album) {
  if (album.excludeFusion && isFusionCard(card)) {
    return false
  }

  if (album.source && card.source !== album.source) {
    return false
  }

  const cardTokens = getCardTokens(card)

  if (album.matchTags?.length && tokenMatches(cardTokens, album.matchTags)) {
    return true
  }

  if (album.matchFactions?.length && tokenMatches(cardTokens, album.matchFactions)) {
    return true
  }

  if (album.matchNames?.length && tokenMatches(cardTokens, album.matchNames)) {
    return true
  }

  return Boolean(album.source && card.source === album.source)
}

function getAlbumCards(album) {
  const cards = new Map()

  for (const card of allCards) {
    if (!card?.key || !cardMatchesAlbum(card, album)) continue

    cards.set(card.key, card)
  }

  return Array.from(cards.values())
}

function getAlbumLevelCards(album, level) {
  const levelConfig = LEVELS[level]
  const allowedRarities = new Set(levelConfig?.rarities || [])

  return getAlbumCards(album).filter((card) => allowedRarities.has(card.rarity))
}

async function getDisplayName(client, guild, userId) {
  if (guild) {
    const member = await guild.members.fetch(userId).catch(() => null)

    if (member) {
      return member.displayName
    }
  }

  const user = await client.users.fetch(userId).catch(() => null)

  return user ? user.username : `Utilisateur ${userId}`
}

async function buildCardsRanking(client, type) {
  const playerCards = await client.db
    .collection("player_cards")
    .find({})
    .toArray()

  const stats = new Map()

  for (const card of playerCards) {
    if (!stats.has(card.userId)) {
      stats.set(card.userId, {
        userId: card.userId,
        totalCards: 0,
        totalValue: 0,
      })
    }

    const player = stats.get(card.userId)
    const catalogCard = getCardFromCatalog(card.cardKey)
    const value = card.value || catalogCard?.value || 0

    player.totalCards += 1
    player.totalValue += value
  }

  const players = Array.from(stats.values())

  if (type === "valeur") {
    players.sort((a, b) => b.totalValue - a.totalValue || b.totalCards - a.totalCards)
  }

  if (type === "cartes") {
    players.sort((a, b) => b.totalCards - a.totalCards || b.totalValue - a.totalValue)
  }

  return players.slice(0, 10)
}

async function buildFragmentsRanking(client) {
  const wallets = await client.db
    .collection("player_wallets")
    .find({})
    .sort({ fragments: -1 })
    .limit(10)
    .toArray()

  return wallets.map((wallet) => ({
    userId: wallet.userId,
    fragments: wallet.fragments || 0,
  }))
}

async function buildCombatRanking(client, type) {
  const combatStats = await client.db
    .collection("combat_stats")
    .find({})
    .toArray()

  const players = combatStats.map((stats) => {
    const pveWins = stats.pveWins || 0
    const pveLosses = stats.pveLosses || 0
    const pvpWins = stats.pvpWins || 0
    const pvpLosses = stats.pvpLosses || 0

    return {
      userId: stats.userId,
      pveWins,
      pveLosses,
      pvpWins,
      pvpLosses,
    }
  })

  if (type === "pve") {
    players.sort((a, b) => b.pveWins - a.pveWins || a.pveLosses - b.pveLosses)
  }

  if (type === "pvp") {
    players.sort((a, b) => b.pvpWins - a.pvpWins || a.pvpLosses - b.pvpLosses)
  }

  return players.slice(0, 10)
}

async function buildAlbumRanking(client) {
  const playerCards = await client.db
    .collection("player_cards")
    .find({}, { projection: { userId: 1, cardKey: 1 } })
    .toArray()

  const ownedByUser = new Map()

  for (const card of playerCards) {
    if (!ownedByUser.has(card.userId)) {
      ownedByUser.set(card.userId, new Set())
    }

    ownedByUser.get(card.userId).add(card.cardKey)
  }

  const allAlbumCardKeys = new Set()

  for (const album of cardAlbums) {
    for (const card of getAlbumCards(album)) {
      allAlbumCardKeys.add(card.key)
    }
  }

  const players = []

  for (const [userId, ownedKeys] of ownedByUser.entries()) {
    let completedLevels = 0
    let ownedAlbumCards = 0

    for (const cardKey of allAlbumCardKeys) {
      if (ownedKeys.has(cardKey)) {
        ownedAlbumCards += 1
      }
    }

    for (const album of cardAlbums) {
      for (const levelKey of Object.keys(LEVELS)) {
        const level = Number(levelKey)
        const requiredCards = getAlbumLevelCards(album, level)

        if (!requiredCards.length) continue

        const completed = requiredCards.every((card) => ownedKeys.has(card.key))

        if (completed) {
          completedLevels += 1
        }
      }
    }

    players.push({
      userId,
      completedLevels,
      ownedAlbumCards,
      totalAlbumCards: allAlbumCardKeys.size,
    })
  }

  players.sort((a, b) => {
    return (
      b.completedLevels - a.completedLevels ||
      b.ownedAlbumCards - a.ownedAlbumCards
    )
  })

  return players.slice(0, 10)
}

function getRankingTitle(type) {
  const titles = {
    valeur: "Classement par valeur totale",
    cartes: "Classement par nombre de cartes",
    fragments: "Classement par fragments",
    pve: "Classement PVE",
    pvp: "Classement PVP",
    albums: "Classement des niveaux d'album",
  }

  return titles[type] || "Classement"
}

function getRankingDescription(type) {
  const descriptions = {
    valeur: "Total de valeur de toutes les cartes possédées.",
    cartes: "Nombre total de cartes possédées, doublons inclus.",
    fragments: "Nombre de fragments actuellement possédés.",
    pve: "Trié par victoires PVE, puis par moins de défaites PVE.",
    pvp: "Trié par victoires PVP, puis par moins de défaites PVP.",
    albums: "Nombre de niveaux d'albums complétés, puis progression globale dans les albums.",
  }

  return descriptions[type] || null
}

async function buildRankingEmbed(client, guild, type) {
  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${getRankingTitle(type)}`)
    .setColor(0xf1c40f)
    .setTimestamp()

  const description = getRankingDescription(type)

  if (description) {
    embed.setFooter({ text: description })
  }

  if (type === "fragments") {
    const ranking = await buildFragmentsRanking(client)

    if (!ranking.length) {
      embed.setDescription("Aucun joueur classé pour le moment.")
      return embed
    }

    const text = []

    for (let i = 0; i < ranking.length; i++) {
      const player = ranking[i]
      const displayName = await getDisplayName(client, guild, player.userId)

      text.push(`**${i + 1}.** ${displayName} — 💠 ${player.fragments} fragment${player.fragments > 1 ? "s" : ""}`)
    }

    embed.setDescription(text.join("\n"))
    return embed
  }

  if (type === "pve" || type === "pvp") {
    const ranking = await buildCombatRanking(client, type)

    if (!ranking.length) {
      embed.setDescription("Aucun joueur classé pour le moment.")
      return embed
    }

    const text = []

    for (let i = 0; i < ranking.length; i++) {
      const player = ranking[i]
      const displayName = await getDisplayName(client, guild, player.userId)

      const wins = type === "pve" ? player.pveWins : player.pvpWins
      const losses = type === "pve" ? player.pveLosses : player.pvpLosses
      const label = type.toUpperCase()

      text.push(`**${i + 1}.** ${displayName} — ✅ ${wins} victoire${wins > 1 ? "s" : ""} / ❌ ${losses} défaite${losses > 1 ? "s" : ""} ${label}`)
    }

    embed.setDescription(text.join("\n"))
    return embed
  }

  if (type === "albums") {
    const ranking = await buildAlbumRanking(client)

    if (!ranking.length) {
      embed.setDescription("Aucun joueur classé pour le moment.")
      return embed
    }

    const text = []

    for (let i = 0; i < ranking.length; i++) {
      const player = ranking[i]
      const displayName = await getDisplayName(client, guild, player.userId)

      text.push(
        `**${i + 1}.** ${displayName} — 📚 ${player.completedLevels} niveau${player.completedLevels > 1 ? "x" : ""} complété${player.completedLevels > 1 ? "s" : ""} ` +
        `(${player.ownedAlbumCards}/${player.totalAlbumCards} cartes d'albums)`
      )
    }

    embed.setDescription(text.join("\n"))
    return embed
  }

  const ranking = await buildCardsRanking(client, type)

  if (!ranking.length) {
    embed.setDescription("Aucun joueur classé pour le moment.")
    return embed
  }

  const text = []

  for (let i = 0; i < ranking.length; i++) {
    const player = ranking[i]
    const displayName = await getDisplayName(client, guild, player.userId)

    let score = ""

    if (type === "valeur") {
      score = `⭐ ${player.totalValue} pts`
    }

    if (type === "cartes") {
      score = `🎴 ${player.totalCards} carte${player.totalCards > 1 ? "s" : ""}`
    }

    text.push(`**${i + 1}.** ${displayName} — ${score}`)
  }

  embed.setDescription(text.join("\n"))
  return embed
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("classement")
    .setDescription("Afficher les classements du mini-jeu Arcane")
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Type de classement")
        .setRequired(true)
        .addChoices(
          {
            name: "Valeur totale",
            value: "valeur",
          },
          {
            name: "Nombre de cartes",
            value: "cartes",
          },
          {
            name: "Fragments",
            value: "fragments",
          },
          {
            name: "PVP (victoires et défaites)",
            value: "pvp",
          },
          {
            name: "PVE (victoires et défaites)",
            value: "pve",
          },
          {
            name: "Niveaux d'album",
            value: "albums",
          }
        )
    ),

  async execute(interaction, client) {
    await interaction.deferReply()

    const type = interaction.options.getString("type")
    const embed = await buildRankingEmbed(client, interaction.guild, type)

    return interaction.editReply({
      embeds: [embed],
    })
  },
}