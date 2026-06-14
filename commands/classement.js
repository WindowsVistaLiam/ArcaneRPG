const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js")

const arcaneCards = require("../data/arcaneCards")

function getCardFromCatalog(cardKey) {
  return arcaneCards.find((card) => card.key === cardKey)
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
    const fragmentsWon = stats.fragmentsWon || 0
    const fragmentsLost = stats.fragmentsLost || 0

    return {
      userId: stats.userId,
      pveWins,
      pveLosses,
      pvpWins,
      pvpLosses,
      totalWins: pveWins + pvpWins,
      totalLosses: pveLosses + pvpLosses,
      fragmentsWon,
      fragmentsLost,
    }
  })

  if (type === "pve_victoires") {
    players.sort((a, b) => b.pveWins - a.pveWins)
  }

  if (type === "pve_defaites") {
    players.sort((a, b) => b.pveLosses - a.pveLosses)
  }

  if (type === "pvp_victoires") {
    players.sort((a, b) => b.pvpWins - a.pvpWins)
  }

  if (type === "pvp_defaites") {
    players.sort((a, b) => b.pvpLosses - a.pvpLosses)
  }

  if (type === "victoires") {
    players.sort((a, b) => b.totalWins - a.totalWins)
  }

  if (type === "defaites") {
    players.sort((a, b) => b.totalLosses - a.totalLosses)
  }

  if (type === "fragments_combat_gagnes") {
    players.sort((a, b) => b.fragmentsWon - a.fragmentsWon)
  }

  if (type === "fragments_combat_perdus") {
    players.sort((a, b) => b.fragmentsLost - a.fragmentsLost)
  }

  return players.slice(0, 10)
}

function isCombatRanking(type) {
  return [
    "pve_victoires",
    "pve_defaites",
    "pvp_victoires",
    "pvp_defaites",
    "victoires",
    "defaites",
    "fragments_combat_gagnes",
    "fragments_combat_perdus",
  ].includes(type)
}

function getRankingTitle(type) {
  const titles = {
    valeur: "Classement par valeur",
    cartes: "Classement par nombre de cartes",
    uniques: "Classement par cartes uniques",
    mythiques: "Classement par cartes mythiques",
    fragments: "Classement par fragments",

    pve_victoires: "Classement des victoires PVE",
    pve_defaites: "Classement des défaites PVE",
    pvp_victoires: "Classement des victoires PVP",
    pvp_defaites: "Classement des défaites PVP",
    victoires: "Classement des victoires totales",
    defaites: "Classement des défaites totales",
    fragments_combat_gagnes: "Classement des fragments gagnés en combat",
    fragments_combat_perdus: "Classement des fragments perdus en combat",
  }

  return titles[type] || "Classement"
}

function getCombatScore(player, type) {
  if (type === "pve_victoires") {
    return `✅ ${player.pveWins} victoire${player.pveWins > 1 ? "s" : ""} PVE`
  }

  if (type === "pve_defaites") {
    return `❌ ${player.pveLosses} défaite${player.pveLosses > 1 ? "s" : ""} PVE`
  }

  if (type === "pvp_victoires") {
    return `✅ ${player.pvpWins} victoire${player.pvpWins > 1 ? "s" : ""} PVP`
  }

  if (type === "pvp_defaites") {
    return `❌ ${player.pvpLosses} défaite${player.pvpLosses > 1 ? "s" : ""} PVP`
  }

  if (type === "victoires") {
    return `✅ ${player.totalWins} victoire${player.totalWins > 1 ? "s" : ""} au total`
  }

  if (type === "defaites") {
    return `❌ ${player.totalLosses} défaite${player.totalLosses > 1 ? "s" : ""} au total`
  }

  if (type === "fragments_combat_gagnes") {
    return `💠 ${player.fragmentsWon} fragment${player.fragmentsWon > 1 ? "s" : ""} gagné${player.fragmentsWon > 1 ? "s" : ""}`
  }

  if (type === "fragments_combat_perdus") {
    return `💠 ${player.fragmentsLost} fragment${player.fragmentsLost > 1 ? "s" : ""} perdu${player.fragmentsLost > 1 ? "s" : ""}`
  }

  return "Aucun score"
}

async function buildRankingEmbed(client, guild, type) {
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
      const displayName = await getDisplayName(client, guild, player.userId)

      text.push(`**${i + 1}.** ${displayName} — 💠 ${player.fragments}`)
    }

    embed.setDescription(text.join("\n"))
    return embed
  }

  if (isCombatRanking(type)) {
    const ranking = await buildCombatRanking(client, type)

    if (!ranking.length) {
      embed.setDescription("Aucun joueur classé pour le moment.")
      return embed
    }

    const text = []

    for (let i = 0; i < ranking.length; i++) {
      const player = ranking[i]
      const displayName = await getDisplayName(client, guild, player.userId)
      const score = getCombatScore(player, type)

      text.push(`**${i + 1}.** ${displayName} — ${score}`)
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
      score = `🎴 ${player.totalCards} cartes`
    }

    if (type === "uniques") {
      score = `📘 ${player.uniqueCount}/${arcaneCards.length} uniques`
    }

    if (type === "mythiques") {
      score = `🔴 ${player.mythicCards} mythique${player.mythicCards > 1 ? "s" : ""}`
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
          },
          {
            name: "Victoires PVE",
            value: "pve_victoires",
          },
          {
            name: "Défaites PVE",
            value: "pve_defaites",
          },
          {
            name: "Victoires PVP",
            value: "pvp_victoires",
          },
          {
            name: "Défaites PVP",
            value: "pvp_defaites",
          },
          {
            name: "Victoires totales",
            value: "victoires",
          },
          {
            name: "Défaites totales",
            value: "defaites",
          },
          {
            name: "Fragments gagnés en combat",
            value: "fragments_combat_gagnes",
          },
          {
            name: "Fragments perdus en combat",
            value: "fragments_combat_perdus",
          }
        )
    ),

  async execute(interaction, client) {
    const type = interaction.options.getString("type")
    const embed = await buildRankingEmbed(client, interaction.guild, type)

    return interaction.reply({
      embeds: [embed],
    })
  },
}