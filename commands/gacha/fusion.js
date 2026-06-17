const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js")

const arcaneCards = require("../../data/arcaneCards")
const fusionCards = require("../../data/fusionCards")

const { getCardStats } = require("../../utils/cardBattle")

const EPHEMERAL_FLAG = 64

const AVAILABLE_ITEMS_PER_PAGE = 5
const SELECT_ITEMS_PER_PAGE = 25

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

const RARITY_ORDER = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
}

const RARITY_LABELS = {
  all: "Toutes les raretés",
  common: "Communes",
  rare: "Rares",
  epic: "Épiques",
  legendary: "Légendaires",
  mythic: "Mythiques",
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function sortFusions(cards) {
  return [...cards].sort((a, b) => {
    const rarityDiff = (RARITY_ORDER[a.rarity] || 99) - (RARITY_ORDER[b.rarity] || 99)

    if (rarityDiff !== 0) return rarityDiff

    return a.name.localeCompare(b.name)
  })
}

function filterFusionsByRarity(cards, rarity) {
  if (!rarity || rarity === "all") return cards

  return cards.filter((card) => card.rarity === rarity)
}

function getRarityLabel(rarity) {
  return RARITY_LABELS[rarity] || RARITY_LABELS.all
}

function findFusion(search) {
  const query = normalizeText(search)

  const exactKey = fusionCards.find((card) => normalizeText(card.key) === query)
  if (exactKey) return exactKey

  const exactName = fusionCards.find((card) => normalizeText(card.name) === query)
  if (exactName) return exactName

  return fusionCards.find((card) => {
    return (
      normalizeText(card.key).includes(query) ||
      normalizeText(card.name).includes(query) ||
      normalizeText(card.characterName || "").includes(query)
    )
  })
}

function getOfficialCard(cardKey) {
  return arcaneCards.find((card) => card.key === cardKey)
}

function getReadableCardName(cardKey) {
  const card = getOfficialCard(cardKey)

  if (!card) {
    return "Carte inconnue"
  }

  return card.name
}

function getFusionStats(fusionCard) {
  return getCardStats(fusionCard)
}

function formatStats(stats) {
  return (
    `❤️ PV : **${stats.hp}**\n` +
    `⚔️ ATK : **${stats.attack}**\n` +
    `🛡️ DEF : **${stats.defense}**\n` +
    `💨 VIT : **${stats.speed}**\n` +
    `⚡ Puissance : **${stats.power}**`
  )
}

function formatIngredientForStatus(cardKey, owned) {
  const cardName = getReadableCardName(cardKey)
  const emoji = owned ? "✅" : "❌"

  return `${emoji} **${cardName}**`
}

function formatIngredientsSimple(fusionCard) {
  return (fusionCard.ingredients || [])
    .map((ingredientKey) => `• **${getReadableCardName(ingredientKey)}**`)
    .join("\n")
}

function getPageCount(items, perPage) {
  return Math.max(1, Math.ceil(items.length / perPage))
}

function clampPage(page, totalPages) {
  return Math.min(Math.max(page, 0), totalPages - 1)
}

async function getOwnedCardKeys(client, userId) {
  const cards = await client.db.collection("player_cards")
    .find(
      { userId },
      { projection: { cardKey: 1 } }
    )
    .toArray()

  return new Set(cards.map((card) => card.cardKey))
}

function userCanCreateFusion(fusionCard, ownedKeys) {
  if (ownedKeys.has(fusionCard.key)) return false

  return (fusionCard.ingredients || []).every((ingredientKey) => {
    return ownedKeys.has(ingredientKey)
  })
}

function getAvailableFusions(ownedKeys) {
  return sortFusions(
    fusionCards.filter((fusionCard) => userCanCreateFusion(fusionCard, ownedKeys))
  )
}

function buildGalleryPaginationRow(page, totalPages, rarity) {
  const filter = rarity || "all"

  const previousButton = new ButtonBuilder()
    .setCustomId(`fusion:list:${page - 1}:${filter}`)
    .setLabel("⬅️")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page <= 0)

  const nextButton = new ButtonBuilder()
    .setCustomId(`fusion:list:${page + 1}:${filter}`)
    .setLabel("➡️")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page >= totalPages - 1)

  return new ActionRowBuilder().addComponents(previousButton, nextButton)
}

function buildAvailablePaginationRow(page, totalPages) {
  const previousButton = new ButtonBuilder()
    .setCustomId(`fusion:available:${page - 1}`)
    .setLabel("⬅️")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page <= 0)

  const nextButton = new ButtonBuilder()
    .setCustomId(`fusion:available:${page + 1}`)
    .setLabel("➡️")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page >= totalPages - 1)

  return new ActionRowBuilder().addComponents(previousButton, nextButton)
}

function buildCreatePaginationRow(page, totalPages) {
  const previousButton = new ButtonBuilder()
    .setCustomId(`fusion:create-page:${page - 1}`)
    .setLabel("⬅️")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page <= 0)

  const nextButton = new ButtonBuilder()
    .setCustomId(`fusion:create-page:${page + 1}`)
    .setLabel("➡️")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page >= totalPages - 1)

  return new ActionRowBuilder().addComponents(previousButton, nextButton)
}

function buildFusionGalleryEmbed({ fusions, page, rarity }) {
  const sortedFusions = sortFusions(fusions)
  const totalPages = getPageCount(sortedFusions, 1)
  const safePage = clampPage(page, totalPages)

  const fusionCard = sortedFusions[safePage]
  const emoji = RARITY_EMOJIS[fusionCard.rarity] || "🎴"

  const embed = new EmbedBuilder()
    .setTitle(`${emoji} ${fusionCard.name}`)
    .setColor(RARITY_COLORS[fusionCard.rarity] || 0x9b59b6)
    .setDescription(fusionCard.description || "Aucune description disponible.")
    .addFields(
      {
        name: "Rareté",
        value: `**${fusionCard.rarityLabel || fusionCard.rarity}**`,
        inline: true,
      },
      {
        name: "Bonus fusion",
        value: `**+${fusionCard.fusionBonusPercent || 10}%**`,
        inline: true,
      },
      {
        name: "Cartes nécessaires",
        value: formatIngredientsSimple(fusionCard) || "Aucune carte requise.",
        inline: false,
      }
    )
    .setFooter({
      text: `${getRarityLabel(rarity)} • Carte ${safePage + 1}/${totalPages}`,
    })
    .setTimestamp()

  if (fusionCard.image) {
    embed.setImage(fusionCard.image)
  }

  return {
    embed,
    safePage,
    totalPages,
  }
}

function buildAvailableFusionsEmbed({ availableFusions, page, ownedKeys }) {
  const totalPages = getPageCount(availableFusions, AVAILABLE_ITEMS_PER_PAGE)
  const safePage = clampPage(page, totalPages)

  const start = safePage * AVAILABLE_ITEMS_PER_PAGE
  const pageItems = availableFusions.slice(start, start + AVAILABLE_ITEMS_PER_PAGE)

  const embed = new EmbedBuilder()
    .setTitle("✅ Fusions disponibles")
    .setColor(0x2ecc71)
    .setDescription("Voici les fusions que tu peux créer maintenant avec tes cartes actuelles.")
    .setFooter({
      text: `Page ${safePage + 1}/${totalPages} • ${availableFusions.length} fusion${availableFusions.length > 1 ? "s" : ""} disponible${availableFusions.length > 1 ? "s" : ""}`,
    })
    .setTimestamp()

  for (const fusionCard of pageItems) {
    const emoji = RARITY_EMOJIS[fusionCard.rarity] || "🎴"

    const ingredientsText = (fusionCard.ingredients || [])
      .map((ingredientKey) => formatIngredientForStatus(ingredientKey, ownedKeys.has(ingredientKey)))
      .join("\n")

    embed.addFields({
      name: `${emoji} ${fusionCard.name}`,
      value:
        `Rareté : **${fusionCard.rarityLabel || fusionCard.rarity}**\n` +
        `Bonus fusion : **+${fusionCard.fusionBonusPercent || 10}%**\n` +
        `Cartes nécessaires :\n${ingredientsText || "Aucune carte requise."}`,
      inline: false,
    })
  }

  return {
    embed,
    safePage,
    totalPages,
  }
}

async function buildFusionViewEmbed(client, userId, fusionCard) {
  const ownedKeys = await getOwnedCardKeys(client, userId)
  const stats = getFusionStats(fusionCard)

  const alreadyOwnsFusion = ownedKeys.has(fusionCard.key)
  const canCreate = userCanCreateFusion(fusionCard, ownedKeys)

  const ingredientsText = (fusionCard.ingredients || [])
    .map((ingredientKey) => {
      return formatIngredientForStatus(ingredientKey, ownedKeys.has(ingredientKey))
    })
    .join("\n")

  const embed = new EmbedBuilder()
    .setTitle(`🧬 ${fusionCard.name}`)
    .setColor(RARITY_COLORS[fusionCard.rarity] || 0x9b59b6)
    .setDescription(fusionCard.description || "Carte fusion unique.")
    .addFields(
      {
        name: "Rareté",
        value: `**${fusionCard.rarityLabel || fusionCard.rarity}**`,
        inline: true,
      },
      {
        name: "Valeur",
        value: `**${fusionCard.value || 0} pts**`,
        inline: true,
      },
      {
        name: "Bonus fusion",
        value: `**+${fusionCard.fusionBonusPercent || 10}%**`,
        inline: true,
      },
      {
        name: "Cartes nécessaires",
        value: ingredientsText || "Aucune carte requise.",
        inline: false,
      },
      {
        name: "Stats de la fusion",
        value: formatStats(stats),
        inline: false,
      },
      {
        name: "État",
        value: alreadyOwnsFusion
          ? "✅ Tu possèdes déjà cette fusion."
          : canCreate
            ? "✅ Tu peux créer cette fusion avec `/fusion creer`."
            : "❌ Il te manque au moins une carte nécessaire.",
        inline: false,
      }
    )
    .setTimestamp()

  if (fusionCard.image) {
    embed.setImage(fusionCard.image)
  }

  return embed
}

function buildCreateMenuEmbed(availableFusions, page) {
  const totalPages = getPageCount(availableFusions, SELECT_ITEMS_PER_PAGE)
  const safePage = clampPage(page, totalPages)

  const start = safePage * SELECT_ITEMS_PER_PAGE
  const pageItems = availableFusions.slice(start, start + SELECT_ITEMS_PER_PAGE)

  const lines = pageItems.map((fusionCard) => {
    const emoji = RARITY_EMOJIS[fusionCard.rarity] || "🎴"
    return `${emoji} **${fusionCard.name}**`
  })

  return new EmbedBuilder()
    .setTitle("🧬 Créer une fusion")
    .setColor(0x9b59b6)
    .setDescription(
      "Sélectionne une fusion disponible dans le menu ci-dessous.\n\n" +
      lines.join("\n")
    )
    .setFooter({
      text: `Page ${safePage + 1}/${totalPages} • ${availableFusions.length} fusion${availableFusions.length > 1 ? "s" : ""} créable${availableFusions.length > 1 ? "s" : ""}`,
    })
    .setTimestamp()
}

function buildCreateSelectRows(availableFusions, page) {
  const totalPages = getPageCount(availableFusions, SELECT_ITEMS_PER_PAGE)
  const safePage = clampPage(page, totalPages)

  const start = safePage * SELECT_ITEMS_PER_PAGE
  const pageItems = availableFusions.slice(start, start + SELECT_ITEMS_PER_PAGE)

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`fusion:create-select:${safePage}`)
    .setPlaceholder("Choisis la fusion à créer")
    .addOptions(
      pageItems.map((fusionCard) => {
        const emoji = RARITY_EMOJIS[fusionCard.rarity] || "🎴"

        return {
          label: `${emoji} ${fusionCard.name}`.slice(0, 100),
          description: `${fusionCard.rarityLabel || fusionCard.rarity} • ${fusionCard.ingredients.length} cartes nécessaires`.slice(0, 100),
          value: fusionCard.key,
        }
      })
    )

  const rows = [
    new ActionRowBuilder().addComponents(selectMenu),
  ]

  if (totalPages > 1) {
    rows.push(buildCreatePaginationRow(safePage, totalPages))
  }

  return {
    rows,
    safePage,
    totalPages,
  }
}

function buildConfirmRows(fusionCard) {
  const confirmButton = new ButtonBuilder()
    .setCustomId(`fusion:confirm:${fusionCard.key}`)
    .setLabel("Confirmer la fusion")
    .setStyle(ButtonStyle.Success)

  const cancelButton = new ButtonBuilder()
    .setCustomId("fusion:cancel")
    .setLabel("Annuler")
    .setStyle(ButtonStyle.Secondary)

  return [
    new ActionRowBuilder().addComponents(confirmButton, cancelButton),
  ]
}

function buildFusionSuccessEmbed(fusionCard, stats) {
  const emoji = RARITY_EMOJIS[fusionCard.rarity] || "🎴"

  const embed = new EmbedBuilder()
    .setTitle("✅ Fusion réussie")
    .setColor(RARITY_COLORS[fusionCard.rarity] || 0x2ecc71)
    .setDescription(
      `${emoji} Tu as créé **${fusionCard.name}**.\n\n` +
      "Les cartes nécessaires ont été consommées.\n" +
      "Cette fusion est maintenant ta **carte favorite** et donc ta carte de combat par défaut."
    )
    .addFields(
      {
        name: "Carte obtenue",
        value:
          `Rareté : **${fusionCard.rarityLabel || fusionCard.rarity}**\n` +
          `Valeur : **${fusionCard.value || 0} pts**\n` +
          `Bonus fusion : **+${fusionCard.fusionBonusPercent || 10}%**`,
        inline: false,
      },
      {
        name: "Stats",
        value: formatStats(stats),
        inline: false,
      }
    )
    .setTimestamp()

  if (fusionCard.image) {
    embed.setImage(fusionCard.image)
  }

  return embed
}

async function consumeIngredientCards(client, userId, ingredientKeys) {
  for (const cardKey of ingredientKeys) {
    await client.db.collection("player_cards").deleteOne({
      userId,
      cardKey,
    })
  }
}

async function removeFavoriteIfConsumed(client, userId, ingredientKeys) {
  const profile = await client.db.collection("player_profiles").findOne({
    userId,
  })

  if (!profile?.favoriteCardKey) return
  if (!ingredientKeys.includes(profile.favoriteCardKey)) return

  await client.db.collection("player_profiles").updateOne(
    { userId },
    {
      $unset: {
        favoriteCardKey: "",
      },
      $set: {
        updatedAt: new Date(),
      },
    }
  )
}

async function setFusionAsFavorite(client, userId, fusionCardKey) {
  await client.db.collection("player_profiles").updateOne(
    { userId },
    {
      $set: {
        userId,
        favoriteCardKey: fusionCardKey,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true }
  )

  await client.db.collection("player_cards").updateMany(
    { userId },
    {
      $set: {
        favorite: false,
        updatedAt: new Date(),
      },
    }
  )

  await client.db.collection("player_cards").updateOne(
    {
      userId,
      cardKey: fusionCardKey,
    },
    {
      $set: {
        favorite: true,
        updatedAt: new Date(),
      },
    }
  )
}

async function addFusionCard(client, userId, fusionCard) {
  const stats = getFusionStats(fusionCard)

  await client.db.collection("player_cards").updateOne(
    {
      userId,
      cardKey: fusionCard.key,
    },
    {
      $setOnInsert: {
        userId,
        cardKey: fusionCard.key,
        cardName: fusionCard.name,
        characterName: fusionCard.characterName,
        rarity: fusionCard.rarity,
        rarityLabel: fusionCard.rarityLabel,
        value: fusionCard.value || 0,
        image: fusionCard.image || "",
        description: fusionCard.description || "",
        faction: fusionCard.faction || "Fusion",
        season: fusionCard.season || "Fusion",
        tags: fusionCard.tags || [],
        source: "fusion",
        isPullable: false,
        fusionBonusPercent: fusionCard.fusionBonusPercent || 10,
        ingredients: fusionCard.ingredients || [],
        battleStats: {
          hp: stats.hp,
          attack: stats.attack,
          defense: stats.defense,
          speed: stats.speed,
          power: stats.power,
        },
        obtainedAt: new Date(),
        createdAt: new Date(),
      },
      $set: {
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  )
}

async function createFusionForUser(client, userId, fusionCard) {
  const ownedKeys = await getOwnedCardKeys(client, userId)

  if (ownedKeys.has(fusionCard.key)) {
    return {
      success: false,
      message: `❌ Tu possèdes déjà cette fusion : **${fusionCard.name}**.`,
    }
  }

  const missingIngredients = (fusionCard.ingredients || [])
    .filter((ingredientKey) => !ownedKeys.has(ingredientKey))

  if (missingIngredients.length > 0) {
    const missingText = missingIngredients
      .map((ingredientKey) => formatIngredientForStatus(ingredientKey, false))
      .join("\n")

    return {
      success: false,
      message:
        `❌ Tu ne peux pas créer **${fusionCard.name}**.\n\n` +
        `Cartes manquantes :\n${missingText}`,
    }
  }

  await consumeIngredientCards(client, userId, fusionCard.ingredients || [])
  await removeFavoriteIfConsumed(client, userId, fusionCard.ingredients || [])
  await addFusionCard(client, userId, fusionCard)
  await setFusionAsFavorite(client, userId, fusionCard.key)

  return {
    success: true,
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("fusion")
    .setDescription("Créer des cartes fusion uniques avec plusieurs cartes")

    .addSubcommand((subcommand) =>
      subcommand
        .setName("liste")
        .setDescription("Voir les cartes fusion")
        .addStringOption((option) =>
          option
            .setName("rarete")
            .setDescription("Filtrer les cartes fusion par rareté")
            .setRequired(false)
            .addChoices(
              { name: "Toutes", value: "all" },
              { name: "Commune", value: "common" },
              { name: "Rare", value: "rare" },
              { name: "Épique", value: "epic" },
              { name: "Légendaire", value: "legendary" },
              { name: "Mythique", value: "mythic" }
            )
        )
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName("disponible")
        .setDescription("Voir les fusions que tu peux créer maintenant")
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName("voir")
        .setDescription("Voir les détails d'une fusion")
        .addStringOption((option) =>
          option
            .setName("fusion")
            .setDescription("Nom de la fusion")
            .setRequired(true)
        )
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName("creer")
        .setDescription("Créer une carte fusion via une interface")
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand()

    await interaction.deferReply({
      flags: EPHEMERAL_FLAG,
    })

    if (subcommand === "liste") {
      const rarity = interaction.options.getString("rarete") || "all"

      const filteredFusions = filterFusionsByRarity(
        sortFusions(fusionCards),
        rarity
      )

      if (!filteredFusions.length) {
        return interaction.editReply({
          content: "❌ Aucune carte fusion trouvée pour cette rareté.",
        })
      }

      const { embed, safePage, totalPages } = buildFusionGalleryEmbed({
        fusions: filteredFusions,
        page: 0,
        rarity,
      })

      return interaction.editReply({
        embeds: [embed],
        components: [buildGalleryPaginationRow(safePage, totalPages, rarity)],
      })
    }

    if (subcommand === "disponible") {
      const ownedKeys = await getOwnedCardKeys(client, interaction.user.id)
      const availableFusions = getAvailableFusions(ownedKeys)

      if (!availableFusions.length) {
        return interaction.editReply({
          content:
            "❌ Tu n'as aucune fusion disponible pour le moment.\n" +
            "Il te manque sûrement une ou plusieurs cartes nécessaires.",
        })
      }

      const { embed, safePage, totalPages } = buildAvailableFusionsEmbed({
        availableFusions,
        page: 0,
        ownedKeys,
      })

      return interaction.editReply({
        embeds: [embed],
        components: [buildAvailablePaginationRow(safePage, totalPages)],
      })
    }

    if (subcommand === "voir") {
      const search = interaction.options.getString("fusion")
      const fusionCard = findFusion(search)

      if (!fusionCard) {
        return interaction.editReply({
          content: `❌ Aucune fusion trouvée pour : **${search}**.`,
        })
      }

      const embed = await buildFusionViewEmbed(
        client,
        interaction.user.id,
        fusionCard
      )

      return interaction.editReply({
        embeds: [embed],
      })
    }

    if (subcommand === "creer") {
      const ownedKeys = await getOwnedCardKeys(client, interaction.user.id)
      const availableFusions = getAvailableFusions(ownedKeys)

      if (!availableFusions.length) {
        return interaction.editReply({
          content:
            "❌ Tu ne peux créer aucune fusion pour le moment.\n" +
            "Utilise `/fusion liste` pour voir les cartes nécessaires.",
        })
      }

      const embed = buildCreateMenuEmbed(availableFusions, 0)
      const { rows } = buildCreateSelectRows(availableFusions, 0)

      return interaction.editReply({
        embeds: [embed],
        components: rows,
      })
    }
  },

  async handleButton(interaction, client) {
    if (!interaction.customId.startsWith("fusion:")) return

    const parts = interaction.customId.split(":")
    const action = parts[1]

    if (action === "list") {
      const page = Number(parts[2] || 0)
      const rarity = parts[3] || "all"

      const filteredFusions = filterFusionsByRarity(
        sortFusions(fusionCards),
        rarity
      )

      if (!filteredFusions.length) {
        return interaction.update({
          content: "❌ Aucune carte fusion trouvée pour cette rareté.",
          embeds: [],
          components: [],
        })
      }

      const { embed, safePage, totalPages } = buildFusionGalleryEmbed({
        fusions: filteredFusions,
        page,
        rarity,
      })

      return interaction.update({
        embeds: [embed],
        components: [buildGalleryPaginationRow(safePage, totalPages, rarity)],
      })
    }

    if (action === "available") {
      const page = Number(parts[2] || 0)
      const ownedKeys = await getOwnedCardKeys(client, interaction.user.id)
      const availableFusions = getAvailableFusions(ownedKeys)

      if (!availableFusions.length) {
        return interaction.update({
          content: "❌ Tu n'as plus aucune fusion disponible.",
          embeds: [],
          components: [],
        })
      }

      const { embed, safePage, totalPages } = buildAvailableFusionsEmbed({
        availableFusions,
        page,
        ownedKeys,
      })

      return interaction.update({
        embeds: [embed],
        components: [buildAvailablePaginationRow(safePage, totalPages)],
      })
    }

    if (action === "create-page") {
      const page = Number(parts[2] || 0)
      const ownedKeys = await getOwnedCardKeys(client, interaction.user.id)
      const availableFusions = getAvailableFusions(ownedKeys)

      if (!availableFusions.length) {
        return interaction.update({
          content: "❌ Tu n'as plus aucune fusion disponible.",
          embeds: [],
          components: [],
        })
      }

      const embed = buildCreateMenuEmbed(availableFusions, page)
      const { rows } = buildCreateSelectRows(availableFusions, page)

      return interaction.update({
        embeds: [embed],
        components: rows,
      })
    }

    if (action === "confirm") {
      await interaction.deferUpdate()

      const fusionKey = parts.slice(2).join(":")
      const fusionCard = fusionCards.find((card) => card.key === fusionKey)

      if (!fusionCard) {
        return interaction.editReply({
          content: "❌ Cette fusion n'existe plus.",
          embeds: [],
          components: [],
        })
      }

      const result = await createFusionForUser(
        client,
        interaction.user.id,
        fusionCard
      )

      if (!result.success) {
        return interaction.editReply({
          content: result.message,
          embeds: [],
          components: [],
        })
      }

      const stats = getFusionStats(fusionCard)
      const embed = buildFusionSuccessEmbed(fusionCard, stats)

      return interaction.editReply({
        content: "",
        embeds: [embed],
        components: [],
      })
    }

    if (action === "cancel") {
      return interaction.update({
        content: "Fusion annulée.",
        embeds: [],
        components: [],
      })
    }
  },

  async handleSelect(interaction, client) {
    if (!interaction.customId.startsWith("fusion:create-select:")) return

    await interaction.deferUpdate()

    const fusionKey = interaction.values[0]
    const fusionCard = fusionCards.find((card) => card.key === fusionKey)

    if (!fusionCard) {
      return interaction.editReply({
        content: "❌ Cette fusion n'existe plus.",
        embeds: [],
        components: [],
      })
    }

    const embed = await buildFusionViewEmbed(
      client,
      interaction.user.id,
      fusionCard
    )

    embed.addFields({
      name: "Confirmation",
      value:
        "Clique sur **Confirmer la fusion** pour consommer les cartes nécessaires et créer cette fusion.\n" +
        "Cette action est définitive.",
      inline: false,
    })

    return interaction.editReply({
      content: "",
      embeds: [embed],
      components: buildConfirmRows(fusionCard),
    })
  },
}