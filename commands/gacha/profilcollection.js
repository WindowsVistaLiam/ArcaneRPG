const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js")

const arcaneCards = require("../../data/arcaneCards")
const fusionCards = require("../../data/fusionCards")

const {
  getCardStats,
  getCardStatsWithUpgrade,
  getCardUpgrade,
  LEVEL_MULTIPLIERS,
  MAX_LEVEL,
} = require("../../utils/cardBattle")

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

function getGlobalBonusPercent(level) {
  const multiplier = LEVEL_MULTIPLIERS[level] || 0
  return Math.round(multiplier * 100)
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

    if (!catalogCard) continue

    const baseStats = getCardStats(catalogCard)
    const upgradedStats = await getCardStatsWithUpgrade(client, userId, catalogCard)
    const upgrade = await getCardUpgrade(client, userId, catalogCard.key)

    uniqueCards.push({
      card: catalogCard,
      baseStats,
      upgradedStats,
      upgrade,
    })
  }

  const rarityCounts = {
    common: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
    mythic: 0,
  }

  let totalValue = 0
  let upgradedCardsCount = 0
  let highestUpgrade = null

  for (const entry of uniqueCards) {
    const card = entry.card

    if (rarityCounts[card.rarity] !== undefined) {
      rarityCounts[card.rarity] += 1
    }

    totalValue += card.value || 0

    if ((entry.upgrade.level || 1) > 1) {
      upgradedCardsCount += 1
    }

    if (
      !highestUpgrade ||
      (entry.upgrade.level || 1) > (highestUpgrade.upgrade.level || 1) ||
      (
        (entry.upgrade.level || 1) === (highestUpgrade.upgrade.level || 1) &&
        entry.upgradedStats.power > highestUpgrade.upgradedStats.power
      )
    ) {
      highestUpgrade = entry
    }
  }

  const sortedByPower = [...uniqueCards].sort((a, b) => {
    const powerDiff = (b.upgradedStats.power || 0) - (a.upgradedStats.power || 0)

    if (powerDiff !== 0) {
      return powerDiff
    }

    const rarityDiff =
      (RARITY_ORDER[a.card.rarity] || 99) - (RARITY_ORDER[b.card.rarity] || 99)

    if (rarityDiff !== 0) {
      return rarityDiff
    }

    return (b.card.value || 0) - (a.card.value || 0)
  })

  const bestCardEntry = sortedByPower[0] || null

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
    bestCardEntry,
    upgradedCardsCount,
    highestUpgrade,
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

function formatCardEntry(entry) {
  if (!entry) {
    return "Aucune carte possédée."
  }

  const card = entry.card
  const stats = entry.upgradedStats
  const upgrade = entry.upgrade
  const emoji = RARITY_EMOJIS[card.rarity] || "🎴"
  const rarityLabel = card.rarityLabel || RARITY_LABELS[card.rarity] || card.rarity
  const bonusPercent = getGlobalBonusPercent(upgrade.level || 1)

  return (
    `${emoji} **${card.name}**\n` +
    `Rareté : **${rarityLabel}**\n` +
    `Niveau : **${upgrade.level || 1}/${MAX_LEVEL}** (**+${bonusPercent}%**)\n` +
    `Puissance : **${stats.power}**\n` +
    `Valeur : **${card.value || 0} pts**\n` +
    `ID : \`${card.key}\``
  )
}

async function getFavoriteCardEntry(client, userId, profile) {
  if (!profile.favoriteCardKey) {
    return null
  }

  const ownedCard = await client.db.collection("player_cards").findOne({
    userId,
    cardKey: profile.favoriteCardKey,
  })

  if (!ownedCard) {
    return {
      missing: true,
      cardKey: profile.favoriteCardKey,
    }
  }

  const card = getCardFromCatalog(profile.favoriteCardKey)

  if (!card) {
    return {
      missing: true,
      cardKey: profile.favoriteCardKey,
    }
  }

  const baseStats = getCardStats(card)
  const upgradedStats = await getCardStatsWithUpgrade(client, userId, card)
  const upgrade = await getCardUpgrade(client, userId, card.key)

  return {
    card,
    baseStats,
    upgradedStats,
    upgrade,
  }
}

function formatFavoriteCardEntry(favoriteEntry) {
  if (!favoriteEntry) {
    return (
      "Aucune carte favorite définie.\n\n" +
      "Utilise `/favori carte:<nom>` pour définir ta carte de combat par défaut."
    )
  }

  if (favoriteEntry.missing) {
    return (
      `Carte favorite introuvable ou non possédée : \`${favoriteEntry.cardKey}\`\n\n` +
      "Utilise `/favori carte:<nom>` pour définir une nouvelle carte favorite."
    )
  }

  return (
    `${formatCardEntry(favoriteEntry)}\n\n` +
    "⭐ Cette carte est aussi utilisée par défaut avec `/combat pve` et `/combat pvp`."
  )
}

function getProfileImage(favoriteEntry, bestCardEntry) {
  if (favoriteEntry?.card?.image) {
    return favoriteEntry.card.image
  }

  if (bestCardEntry?.card?.image) {
    return bestCardEntry.card.image
  }

  return null
}

async function buildProfileCollectionEmbed(client, guild, user) {
  const displayName = await getDisplayName(client, guild, user.id)

  const [
    wallet,
    combatStats,
    profile,
    collectionStats,
  ] = await Promise.all([
    getWallet(client, user.id),
    getCombatStats(client, user.id),
    getProfile(client, user.id),
    getCollectionStats(client, user.id),
  ])

  const favoriteEntry = await getFavoriteCardEntry(client, user.id, profile)

  const collectorRank = getCollectorRank(
    collectionStats.uniqueCards,
    collectionStats.totalAvailableCards
  )

  const activeTitle = profile.activeTitle || "Aucun titre"
  const activeBadge = profile.activeBadge || "Aucun badge"

  const totalWins = combatStats.pveWins + combatStats.pvpWins
  const totalLosses = combatStats.pveLosses + combatStats.pvpLosses

  const bestCardText = formatCardEntry(collectionStats.bestCardEntry)

  const highestUpgradeText = collectionStats.highestUpgrade
    ? formatCardEntry(collectionStats.highestUpgrade)
    : "Aucune carte améliorée."

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
        name: "⚙️ Améliorations",
        value:
          `Cartes améliorées : **${collectionStats.upgradedCardsCount}**\n` +
          `Niveau max possible : **${MAX_LEVEL}**`,
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
        name: "⭐ Carte favorite / combat par défaut",
        value: formatFavoriteCardEntry(favoriteEntry),
        inline: false,
      },
      {
        name: "🏆 Meilleure carte actuelle",
        value: bestCardText,
        inline: false,
      },
      {
        name: "⚙️ Meilleure amélioration",
        value: highestUpgradeText,
        inline: false,
      }
    )
    .setFooter({
      text: "La carte favorite est utilisée automatiquement si aucune carte n'est précisée dans /combat.",
    })
    .setTimestamp()

  const image = getProfileImage(favoriteEntry, collectionStats.bestCardEntry)

  if (image) {
    embed.setImage(image)
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
    await interaction.deferReply()

    const user = interaction.options.getUser("utilisateur") || interaction.user

    const embed = await buildProfileCollectionEmbed(
      client,
      interaction.guild,
      user
    )

    return interaction.editReply({
      embeds: [embed],
    })
  },
}