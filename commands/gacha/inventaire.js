const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js")

const arcaneCards = require("../../data/arcaneCards")

const {
  getCardStatsWithUpgrade,
  getCardUpgrade,
  LEVEL_MULTIPLIERS,
  MAX_LEVEL,
} = require("../../utils/cardBattle")

const CATEGORIES = {
  resume: {
    label: "📌 Résumé",
    color: 0x5865f2,
  },
  effets: {
    label: "🍀 Effets",
    color: 0x2ecc71,
  },
  objets: {
    label: "⚙️ Objets",
    color: 0x9b59b6,
  },
  cosmetiques: {
    label: "🎖️ Cosmétiques",
    color: 0xf1c40f,
  },
}

const RARITY_EMOJIS = {
  common: "⚪",
  rare: "🔵",
  epic: "🟣",
  legendary: "🟡",
  mythic: "🔴",
}

function formatList(items, formatter, emptyText = "Aucun élément.") {
  if (!items.length) return emptyText

  return items
    .slice(0, 20)
    .map(formatter)
    .join("\n")
    .slice(0, 1024)
}

function getCardFromCatalog(cardKey) {
  return arcaneCards.find((card) => card.key === cardKey)
}

function getGlobalBonusPercent(level) {
  const multiplier = LEVEL_MULTIPLIERS[level] || 0
  return Math.round(multiplier * 100)
}

async function getWallet(client, userId) {
  const wallet = await client.db.collection("player_wallets").findOne({
    userId,
  })

  return {
    fragments: wallet?.fragments || 0,
  }
}

async function getCardsStats(client, userId) {
  const playerCards = await client.db.collection("player_cards")
    .find({
      userId,
    })
    .toArray()

  const uniqueMap = new Map()

  for (const playerCard of playerCards) {
    if (!uniqueMap.has(playerCard.cardKey)) {
      uniqueMap.set(playerCard.cardKey, playerCard)
    }
  }

  const rarityCounts = {
    common: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
    mythic: 0,
  }

  for (const [cardKey, playerCard] of uniqueMap.entries()) {
    const catalogCard = getCardFromCatalog(cardKey)
    const rarity = catalogCard?.rarity || playerCard.rarity || "common"

    if (rarityCounts[rarity] !== undefined) {
      rarityCounts[rarity] += 1
    }
  }

  return {
    totalCards: playerCards.length,
    uniqueCards: uniqueMap.size,
    totalAvailableCards: arcaneCards.length,
    rarityCounts,
  }
}

async function getEffects(client, userId) {
  return client.db.collection("player_effects")
    .find({
      userId,
      uses: {
        $gt: 0,
      },
    })
    .sort({
      updatedAt: -1,
    })
    .toArray()
}

async function getItems(client, userId) {
  return client.db.collection("player_items")
    .find({
      userId,
      quantity: {
        $gt: 0,
      },
    })
    .sort({
      updatedAt: -1,
    })
    .toArray()
}

async function getCosmetics(client, userId) {
  return client.db.collection("player_cosmetics")
    .find({
      userId,
    })
    .sort({
      boughtAt: -1,
    })
    .toArray()
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

async function getUpgradeStats(client, userId) {
  const playerCards = await client.db.collection("player_cards")
    .find({
      userId,
    })
    .toArray()

  const uniqueCardKeys = [...new Set(playerCards.map((card) => card.cardKey))]

  let upgradedCardsCount = 0
  let bestPowerEntry = null
  let bestUpgradeEntry = null

  for (const cardKey of uniqueCardKeys) {
    const card = getCardFromCatalog(cardKey)
    if (!card) continue

    const upgrade = await getCardUpgrade(client, userId, card.key)
    const stats = await getCardStatsWithUpgrade(client, userId, card)

    const entry = {
      card,
      upgrade,
      stats,
    }

    if ((upgrade.level || 1) > 1) {
      upgradedCardsCount += 1

      if (
        !bestUpgradeEntry ||
        (upgrade.level || 1) > (bestUpgradeEntry.upgrade.level || 1) ||
        ((upgrade.level || 1) === (bestUpgradeEntry.upgrade.level || 1) &&
          stats.power > bestUpgradeEntry.stats.power)
      ) {
        bestUpgradeEntry = entry
      }
    }

    if (!bestPowerEntry || stats.power > bestPowerEntry.stats.power) {
      bestPowerEntry = entry
    }
  }

  return {
    upgradedCardsCount,
    bestPowerEntry,
    bestUpgradeEntry,
  }
}

function formatCardEntry(entry) {
  if (!entry) return "Aucune carte."

  const emoji = RARITY_EMOJIS[entry.card.rarity] || "🎴"
  const level = entry.upgrade.level || 1
  const bonusPercent = getGlobalBonusPercent(level)

  return (
    `${emoji} **${entry.card.name}**\n` +
    `Niveau : **${level}/${MAX_LEVEL}** (**+${bonusPercent}%**)\n` +
    `Puissance : **${entry.stats.power}**\n` +
    `ID : \`${entry.card.key}\``
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

  const emoji = RARITY_EMOJIS[card.rarity] || "🎴"

  return `${emoji} **${card.name}**\n\`${card.key}\``
}

async function buildInventoryEmbed(client, user, category = "resume") {
  const safeCategory = CATEGORIES[category] ? category : "resume"
  const categoryData = CATEGORIES[safeCategory]

  const wallet = await getWallet(client, user.id)
  const cardsStats = await getCardsStats(client, user.id)
  const effects = await getEffects(client, user.id)
  const items = await getItems(client, user.id)
  const cosmetics = await getCosmetics(client, user.id)
  const combatStats = await getCombatStats(client, user.id)
  const profile = await getProfile(client, user.id)
  const upgradeStats = await getUpgradeStats(client, user.id)

  const embed = new EmbedBuilder()
    .setTitle(`${categoryData.label} — Inventaire de ${user.username}`)
    .setColor(categoryData.color)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .setTimestamp()

  if (safeCategory === "resume") {
    embed.setDescription(
      `💠 Fragments disponibles : **${wallet.fragments}**\n` +
      `🎴 Cartes uniques : **${cardsStats.uniqueCards}/${cardsStats.totalAvailableCards}**\n` +
      `🎒 Cartes totales : **${cardsStats.totalCards}**\n` +
      `⚙️ Cartes améliorées : **${upgradeStats.upgradedCardsCount}**`
    )

    embed.addFields(
      {
        name: "🎴 Raretés possédées",
        value:
          `⚪ Communes : **${cardsStats.rarityCounts.common}**\n` +
          `🔵 Rares : **${cardsStats.rarityCounts.rare}**\n` +
          `🟣 Épiques : **${cardsStats.rarityCounts.epic}**\n` +
          `🟡 Légendaires : **${cardsStats.rarityCounts.legendary}**\n` +
          `🔴 Mythiques : **${cardsStats.rarityCounts.mythic}**`,
        inline: true,
      },
      {
        name: "⚔️ Combats",
        value:
          `PVE : **${combatStats.pveWins}V / ${combatStats.pveLosses}D**\n` +
          `PVP : **${combatStats.pvpWins}V / ${combatStats.pvpLosses}D**\n` +
          `💠 Gagnés : **${combatStats.fragmentsWon}**\n` +
          `💠 Perdus : **${combatStats.fragmentsLost}**`,
        inline: true,
      },
      {
        name: "📌 Profil collectionneur",
        value:
          `Titre actif : **${profile.activeTitle || "Aucun"}**\n` +
          `Badge actif : **${profile.activeBadge || "Aucun"}**\n` +
          `Carte favorite : ${formatFavoriteCard(profile)}\n\n` +
          "⭐ La carte favorite est utilisée par défaut dans `/combat`.",
        inline: false,
      },
      {
        name: "⚙️ Améliorations",
        value:
          `Cartes améliorées : **${upgradeStats.upgradedCardsCount}**\n\n` +
          `🏆 **Meilleure puissance actuelle**\n${formatCardEntry(upgradeStats.bestPowerEntry)}\n\n` +
          `🔧 **Meilleure amélioration**\n${formatCardEntry(upgradeStats.bestUpgradeEntry)}`,
        inline: false,
      },
      {
        name: "📦 Inventaire spécial",
        value:
          `🍀 Effets actifs : **${effects.length}**\n` +
          `⚙️ Objets différents : **${items.length}**\n` +
          `🎖️ Cosmétiques : **${cosmetics.length}**`,
        inline: false,
      }
    )
  }

  if (safeCategory === "effets") {
    embed.setDescription(
      `💠 Fragments disponibles : **${wallet.fragments}**\n\n` +
      "Voici tes boosts et protections actifs."
    )

    embed.addFields({
      name: "🍀 Boosts / protections",
      value: formatList(
        effects,
        (effect) => `**${effect.label || effect.effectKey}** — x${effect.uses || 0}`,
        "Aucun effet actif."
      ),
      inline: false,
    })
  }

  if (safeCategory === "objets") {
    embed.setDescription(
      `💠 Fragments disponibles : **${wallet.fragments}**\n\n` +
      "Voici tes objets d'amélioration et ressources spéciales."
    )

    embed.addFields(
      {
        name: "⚙️ Objets possédés",
        value: formatList(
          items,
          (item) => `**${item.label || item.itemKey}** — x${item.quantity || 0}`,
          "Aucun objet possédé."
        ),
        inline: false,
      },
      {
        name: "🔧 Utilisation",
        value:
          "Les objets d'amélioration servent avec `/ameliorer`.\n\n" +
          "`/ameliorer voir carte:<nom>` — voir le niveau d'une carte\n" +
          "`/ameliorer carte carte:<nom>` — améliorer une carte\n" +
          "`/statscarte carte:<nom>` — voir les stats améliorées",
        inline: false,
      }
    )
  }

  if (safeCategory === "cosmetiques") {
    embed.setDescription(
      `💠 Fragments disponibles : **${wallet.fragments}**\n\n` +
      "Voici tes titres et badges débloqués."
    )

    const titles = cosmetics.filter((cosmetic) => cosmetic.cosmeticType === "title")
    const badges = cosmetics.filter((cosmetic) => cosmetic.cosmeticType === "badge")

    embed.addFields(
      {
        name: "🎖️ Titres",
        value: formatList(
          titles,
          (cosmetic) => `**${cosmetic.label || cosmetic.cosmeticKey}**`,
          "Aucun titre possédé."
        ),
        inline: false,
      },
      {
        name: "🏷️ Badges",
        value: formatList(
          badges,
          (cosmetic) => `**${cosmetic.label || cosmetic.cosmeticKey}**`,
          "Aucun badge possédé."
        ),
        inline: false,
      },
      {
        name: "📌 Actifs",
        value:
          `Titre actif : **${profile.activeTitle || "Aucun"}**\n` +
          `Badge actif : **${profile.activeBadge || "Aucun"}**\n\n` +
          "Utilise `/cosmetique titre` ou `/cosmetique badge` pour changer.",
        inline: false,
      }
    )
  }

  embed.setFooter({
    text: "Utilise /boutique pour acheter des objets, boosts ou cosmétiques.",
  })

  return embed
}

function buildInventoryButtons(activeCategory, userId) {
  const row = new ActionRowBuilder()

  for (const [categoryKey, categoryData] of Object.entries(CATEGORIES)) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`inventaire:category:${categoryKey}:${userId}`)
        .setLabel(categoryData.label)
        .setStyle(categoryKey === activeCategory ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(categoryKey === activeCategory)
    )
  }

  return row
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("inventaire")
    .setDescription("Voir ton inventaire de fragments, boosts, objets et cosmétiques")
    .addStringOption((option) =>
      option
        .setName("categorie")
        .setDescription("Catégorie à afficher")
        .setRequired(false)
        .addChoices(
          {
            name: "📌 Résumé",
            value: "resume",
          },
          {
            name: "🍀 Effets actifs",
            value: "effets",
          },
          {
            name: "⚙️ Objets",
            value: "objets",
          },
          {
            name: "🎖️ Cosmétiques",
            value: "cosmetiques",
          }
        )
    ),

  async execute(interaction, client) {
    const category = interaction.options.getString("categorie") || "resume"
    const safeCategory = CATEGORIES[category] ? category : "resume"

    const embed = await buildInventoryEmbed(client, interaction.user, safeCategory)
    const row = buildInventoryButtons(safeCategory, interaction.user.id)

    return interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    })
  },

  async handleButton(interaction, client) {
    if (!interaction.customId.startsWith("inventaire:")) return

    const parts = interaction.customId.split(":")
    const action = parts[1]
    const category = parts[2]
    const userId = parts[3]

    if (action !== "category") return

    if (interaction.user.id !== userId) {
      return interaction.reply({
        content: "❌ Tu ne peux pas utiliser l'inventaire d'un autre joueur.",
        ephemeral: true,
      })
    }

    const safeCategory = CATEGORIES[category] ? category : "resume"

    const embed = await buildInventoryEmbed(client, interaction.user, safeCategory)
    const row = buildInventoryButtons(safeCategory, interaction.user.id)

    return interaction.update({
      embeds: [embed],
      components: [row],
    })
  },
}