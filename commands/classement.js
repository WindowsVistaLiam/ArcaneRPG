const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js")

const arcaneCards = require("../data/arcaneCards")

function getCardFromCatalog(cardKey) {
  return arcaneCards.find((card) => card.key === cardKey)
}

async function getUsername(client, userId) {
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
        uniqueCards: new Set(),
        mythicCards: 0,
      })
    }

    const player = stats.get(card.userId)
    const catalogCard = getCardFromCatalog(card.cardKey)

    const rarity = card.rarity || catalogCard?.rarity || "common"
    const value = card.value || catalogCard?.value || 0

    player.totalCards += 1
    player.totalValue += value
    player.uniqueCards.add(card.cardKey)

    if (rarity === "mythic") {
      player.mythicCards += 1
    }
  }

  const players = Array.from(stats.values()).map((player) => ({
    ...player,
    uniqueCount: player.uniqueCards.size,
  }))

  if (type === "valeur") {
    players.sort((a, b) => b.totalValue - a.totalValue)
  }

  if (type === "cartes") {
    players.sort((a, b) => b.totalCards - a.totalCards)
  }

  if (type === "uniques") {
    players.sort((a, b) => b.uniqueCount - a.uniqueCount)
  }

  if (type === "mythiques") {
    players.sort((a, b) => b.mythicCards - a.mythicCards)
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

function getRankingTitle(type) {
  const titles = {
    valeur: "Classement par valeur",
    cartes: "Classement par nombre de cartes",
    uniques: "Classement par cartes uniques",
    mythiques: "Classement par cartes mythiques",
    fragments: "Classement par fragments",
  }

  return titles[type] || "Classement"
}

async function buildRankingEmbed(client, type) {
  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${getRankingTitle(type)}`)
    .setColor(0xf1c40f)
    .setTimestamp()

  if (type === "fragments") {
    const ranking = await buildFragmentsRanking(client)

    if (!ranking.length) {
      embed.setDescription("Aucun joueur classé pour le moment.")
      return embed
    }

    const text = []

    for (let i = 0; i < ranking.length; i++) {
      const player = ranking[i]
      const username = await getUsername(client, player.userId)

      text.push(`**${i + 1}.** ${username} — 💠 ${player.fragments}`)
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
    const username = await getUsername(client, player.userId)

    let score = ""

    if (type === "valeur") {
      score = `⭐ ${player.totalValue} pts`
    }

    if (type === "cartes") {
      score = `🎴 ${player.totalCards} cartes`
    }

    if (type === "uniques") {
      score = `📘 ${player.uniqueCount}/${arcaneCards.length} uniques`
    }

    if (type === "mythiques") {
      score = `🔴 ${player.mythicCards} mythique${player.mythicCards > 1 ? "s" : ""}`
    }

    text.push(`**${i + 1}.** ${username} — ${score}`)
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
            name: "Cartes uniques",
            value: "uniques",
          },
          {
            name: "Cartes mythiques",
            value: "mythiques",
          },
          {
            name: "Fragments",
            value: "fragments",
          }
        )
    ),

  async execute(interaction, client) {
    const type = interaction.options.getString("type")
    const embed = await buildRankingEmbed(client, type)

    return interaction.reply({
      embeds: [embed],
    })
  },
}