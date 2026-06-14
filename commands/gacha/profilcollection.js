const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js")

const arcaneCards = require("../../data/arcaneCards")
const { getCardStats } = require("../../utils/cardBattle")

const RARITY_ORDER = {
  mythic: 1,
  legendary: 2,
  epic: 3,
  rare: 4,
  common: 5,
}

const RARITY_LABELS = {
  common: "Commune",
  rare: "Rare",
  epic: "Épique",
  legendary: "Légendaire",
  mythic: "Mythique",
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

async function getWallet(client, userId) {
  const wallet = await client.db.collection("player_wallets").findOne({
    userId,
  })

  return {
    fragments: wallet?.fragments || 0,
  }
}

async function getCombatStats(client, userId) {
  const stats = await client.db.collection("combat_stats").findOne({
    userId,
  })

  return {
    pveWins: stats?.pveWins || 0,
    pveLosses: stats?.pveLosses || 0,
    pvpWins: stats?.pvpWins || 0,
    pvpLosses: stats?.pvpLosses || 0,
    fragmentsWon: stats?.fragmentsWon || 0,
    fragmentsLost: stats?.fragmentsLost || 0,
  }
}

async function getProfile(client, userId) {
  const profile = await client.db.collection("player_profiles").findOne({
    userId,
  })

  return {
    activeTitle: profile?.activeTitle || null,
    activeBadge: profile?.activeBadge || null,
    favoriteCardKey: profile?.favoriteCardKey || null,
  }
}

async function getCollectionStats(client, userId) {
  const playerCards = await client.db.collection("player_cards")
    .find({
      userId,
    })
    .toArray()

  const uniqueCardKeys = new Set(playerCards.map((card) => card.cardKey))

  const uniqueCards = []

  for (const cardKey of uniqueCardKeys) {
    const catalogCard = getCardFromCatalog(cardKey)

    if (catalogCard) {
      uniqueCards.push(catalogCard)
    }
  }

  const rarityCounts = {
    common: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
    mythic: 0,
  }

  let totalValue = 0

  for (const card of uniqueCards) {
    if (rarityCounts[card.rarity] !== undefined) {
      rarityCounts[card.rarity] += 1
    }

    totalValue += card.value || 0
  }

  const sortedByRarity = [...uniqueCards].sort((a, b) => {
    const rarityDiff =
      (RARITY_ORDER[a.rarity] || 99) - (RARITY_ORDER[b.rarity] || 99)

    if (rarityDiff !== 0) {
      return rarityDiff
    }

    return (b.value || 0) - (a.value || 0)
  })

  const bestCard = sortedByRarity[0] || null

  const completionPercent = arcaneCards.length > 0
    ? Math.round((uniqueCards.length / arcaneCards.length) * 100)
    : 0

  return {
    totalCards: playerCards.length,
    uniqueCards: uniqueCards.length,
    totalAvailableCards: arcaneCards.length,
    completionPercent,
    rarityCounts,
    totalValue,
    bestCard,
  }
}

function getCollectorRank(uniqueCards, totalAvailableCards) {
  const percent = totalAvailableCards > 0
    ? (uniqueCards / totalAvailableCards) * 100
    : 0

  if (percent >= 100) return "🏆 Collection complète"
  if (percent >= 80) return "💎 Maître collectionneur"
  if (percent >= 60) return "🔴 Collectionneur mythique"
  if (percent >= 40) return "🟡 Collectionneur légendaire"
  if (percent >= 25) return "🟣 Collectionneur confirmé"
  if (percent >= 10) return "🔵 Collectionneur émergent"

  return "⚪ Débutant"
}

function formatRarityCounts(rarityCounts) {
  return (
    `⚪ Communes : **${rarityCounts.common}**\n` +
    `🔵 Rares : **${rarityCounts.rare}**\n` +
    `🟣 Épiques : **${rarityCounts.epic}**\n` +
    `🟡 Légendaires : **${rarityCounts.legendary}**\n` +
    `🔴 Mythiques : **${rarityCounts.mythic}**`
  )
}

function formatFavoriteCard(profile) {
  if (!profile.favoriteCardKey) {
    return "Aucune carte favorite définie."
  }

  const card = getCardFromCatalog(profile.favoriteCardKey)

  if (!card) {
    return `Carte favorite introuvable : \`${profile.favoriteCardKey}\``
  }

  const stats = getCardStats(card)
  const emoji = RARITY_EMOJIS[card.rarity] || "🎴"

  return (
    `${emoji} **${card.name}**\n` +
    `Rareté : **${card.rarityLabel || RARITY_LABELS[card.rarity] || card.rarity}**\n` +
    `Puissance : **${stats.power}**\n` +
    `ID : \`${card.key}\``
  )
}

function getFavoriteCardImage(profile) {
  if (!profile.favoriteCardKey) return null

  const card = getCardFromCatalog(profile.favoriteCardKey)

  return card?.image || null
}

async function buildProfileCollectionEmbed(client, guild, user) {
  const displayName = await getDisplayName(client, guild, user.id)
  const wallet = await getWallet(client, user.id)
  const combatStats = await getCombatStats(client, user.id)
  const profile = await getProfile(client, user.id)
  const collectionStats = await getCollectionStats(client, user.id)

  const collectorRank = getCollectorRank(
    collectionStats.uniqueCards,
    collectionStats.totalAvailableCards
  )

  const bestCard = collectionStats.bestCard
  const bestCardText = bestCard
    ? `${RARITY_EMOJIS[bestCard.rarity] || "🎴"} **${bestCard.name}**\nRareté : **${bestCard.rarityLabel || bestCard.rarity}**\nValeur : **${bestCard.value || 0} pts**`
    : "Aucune carte possédée."

  const activeTitle = profile.activeTitle || "Aucun titre"
  const activeBadge = profile.activeBadge || "Aucun badge"

  const totalWins = combatStats.pveWins + combatStats.pvpWins
  const totalLosses = combatStats.pveLosses + combatStats.pvpLosses

  const embed = new EmbedBuilder()
    .setTitle(`📘 Profil collectionneur — ${displayName}`)
    .setColor(0x5865f2)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .setDescription(
      `**Rang :** ${collectorRank}\n` +
      `**Titre actif :** ${activeTitle}\n` +
      `**Badge actif :** ${activeBadge}`
    )
    .addFields(
      {
        name: "💠 Économie",
        value:
          `Fragments : **${wallet.fragments}**\n` +
          `Valeur collection : **${collectionStats.totalValue} pts**`,
        inline: true,
      },
      {
        name: "🎴 Collection",
        value:
          `Cartes uniques : **${collectionStats.uniqueCards}/${collectionStats.totalAvailableCards}**\n` +
          `Progression : **${collectionStats.completionPercent}%**\n` +
          `Cartes totales : **${collectionStats.totalCards}**`,
        inline: true,
      },
      {
        name: "⚔️ Combats",
        value:
          `Total : **${totalWins}V / ${totalLosses}D**\n` +
          `PVE : **${combatStats.pveWins}V / ${combatStats.pveLosses}D**\n` +
          `PVP : **${combatStats.pvpWins}V / ${combatStats.pvpLosses}D**`,
        inline: true,
      },
      {
        name: "🎴 Raretés possédées",
        value: formatRarityCounts(collectionStats.rarityCounts),
        inline: true,
      },
      {
        name: "💠 Combats — fragments",
        value:
          `Gagnés : **${combatStats.fragmentsWon}**\n` +
          `Perdus : **${combatStats.fragmentsLost}**\n` +
          `Solde combat : **${combatStats.fragmentsWon - combatStats.fragmentsLost}**`,
        inline: true,
      },
      {
        name: "🌟 Meilleure carte",
        value: bestCardText,
        inline: false,
      },
      {
        name: "⭐ Carte favorite",
        value: formatFavoriteCard(profile),
        inline: false,
      }
    )
    .setFooter({
      text: "Les titres, badges et carte favorite seront configurables avec les prochaines commandes.",
    })
    .setTimestamp()

  const favoriteImage = getFavoriteCardImage(profile)

  if (favoriteImage) {
    embed.setImage(favoriteImage)
  } else if (bestCard?.image) {
    embed.setImage(bestCard.image)
  }

  return embed
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profilcollection")
    .setDescription("Voir le profil collectionneur d'un joueur")
    .addUserOption((option) =>
      option
        .setName("utilisateur")
        .setDescription("Joueur à consulter")
        .setRequired(false)
    ),

  async execute(interaction, client) {
    const user = interaction.options.getUser("utilisateur") || interaction.user

    const embed = await buildProfileCollectionEmbed(
      client,
      interaction.guild,
      user
    )

    return interaction.reply({
      embeds: [embed],
    })
  },
}