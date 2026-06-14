const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js")

const arcaneCards = require("../../data/arcaneCards")

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

function formatList(items, formatter, emptyText = "Aucun élément.") {
  if (!items.length) {
    return emptyText
  }

  return items
    .slice(0, 20)
    .map(formatter)
    .join("\n")
    .slice(0, 1024)
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

  const uniqueCardKeys = new Set(playerCards.map((card) => card.cardKey))

  const rarityCounts = {
    common: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
    mythic: 0,
  }

  for (const card of playerCards) {
    const rarity = card.rarity || "common"

    if (rarityCounts[rarity] !== undefined) {
      rarityCounts[rarity] += 1
    }
  }

  return {
    totalCards: playerCards.length,
    uniqueCards: uniqueCardKeys.size,
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

  const embed = new EmbedBuilder()
    .setTitle(`${categoryData.label} — Inventaire de ${user.username}`)
    .setColor(categoryData.color)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .setTimestamp()

  if (safeCategory === "resume") {
    embed.setDescription(
      `💠 Fragments disponibles : **${wallet.fragments}**\n` +
      `🎴 Cartes uniques : **${cardsStats.uniqueCards}/${cardsStats.totalAvailableCards}**\n` +
      `🎒 Cartes totales : **${cardsStats.totalCards}**`
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
          `Carte favorite : **${profile.favoriteCardKey || "Aucune"}**`,
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
        (effect) => {
          return `**${effect.label || effect.effectKey}** — x${effect.uses || 0}`
        },
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

    embed.addFields({
      name: "⚙️ Objets possédés",
      value: formatList(
        items,
        (item) => {
          return `**${item.label || item.itemKey}** — x${item.quantity || 0}`
        },
        "Aucun objet possédé."
      ),
      inline: false,
    })
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