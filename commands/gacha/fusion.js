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

const allCatalogCards = [...arcaneCards, ...fusionCards]

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

const HEXCORE_EVOLUTION_RULES = [
  {
    legendaryCharacterKey: "jinx",
    legendaryText: "Légende de Zaun",
    mythicCharacterKey: "jinx",
    mythicText: "Blue Flare",
  },
  {
    legendaryCharacterKey: "vi",
    legendaryText: "Gants Hextech",
    mythicCharacterKey: "vi",
    mythicText: "Protectrice brisée",
  },
  {
    legendaryCharacterKey: "caitlyn",
    legendaryText: "Commandante",
    mythicCharacterKey: "caitlyn",
    mythicText: "Œil de Piltover",
  },
  {
    legendaryCharacterKey: "ekko",
    legendaryText: "Boy Savior",
    mythicCharacterKey: "ekko",
    mythicText: "Z-Drive",
  },
  {
    legendaryCharacterKey: "jayce",
    legendaryText: "Marteau Mercury",
    mythicCharacterKey: "jayce",
    mythicText: "Défenseur brisé",
  },
  {
    legendaryCharacterKey: "viktor",
    legendaryText: "Apôtre du progrès",
    mythicCharacterKey: "viktor",
    mythicText: "Glorious Evolution",
  },
  {
    legendaryCharacterKey: "mel",
    legendaryText: "Mage révélée",
    mythicCharacterKey: "mel",
    mythicText: "Lumière dorée",
  },
  {
    legendaryCharacterKey: "silco",
    legendaryText: "Père de Jinx",
    mythicCharacterKey: "silco",
    mythicText: "Rêve de Zaun",
  },
  {
    legendaryCharacterKey: "warwick",
    legendaryText: "Bête de Zaun",
    mythicCharacterKey: "warwick",
    mythicText: "Vander éveillé",
  },
  {
    legendaryCharacterKey: "ambessa",
    legendaryText: "Louve de Noxus",
    mythicCharacterKey: "ambessa",
    mythicText: "Matriarche de guerre",
  },
  {
    legendaryCharacterKey: "leblanc",
    legendaryText: "Rose Noire",
    mythicCharacterKey: "leblanc",
    mythicText: "Illusion de la Rose",
  },
]

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

function cardContainsText(card, text) {
  const query = normalizeText(text)
  const tokens = [
    card.key,
    card.name,
    card.cardName,
    card.characterName,
    card.characterKey,
    card.variant,
    card.faction,
    card.season,
    ...(card.tags || []),
  ]
    .filter(Boolean)
    .map(normalizeText)

  return tokens.some((token) => token.includes(query))
}

function isHexcoreLegendaryCard(card) {
  return card?.rarity === "legendary" && cardContainsText(card, "hexcore")
}

function findHexcoreLegendaryCards() {
  return allCatalogCards.filter(isHexcoreLegendaryCard)
}

function findLegendaryCardByRule(rule) {
  const searchText = normalizeText(rule.legendaryText)

  return arcaneCards.find((card) => {
    return (
      card.rarity === "legendary" &&
      card.characterKey === rule.legendaryCharacterKey &&
      normalizeText(card.name).includes(searchText)
    )
  })
}

function findMythicCardByRule(rule) {
  const searchText = normalizeText(rule.mythicText)

  return arcaneCards.find((card) => {
    return (
      card.rarity === "mythic" &&
      card.characterKey === rule.mythicCharacterKey &&
      normalizeText(card.name).includes(searchText)
    )
  })
}

function getHexcoreEvolutionCards() {
  const hexcoreCards = findHexcoreLegendaryCards()

  if (!hexcoreCards.length) return []

  const evolutions = []
  const seenKeys = new Set()

  for (const hexcoreCard of hexcoreCards) {
    for (const rule of HEXCORE_EVOLUTION_RULES) {
      const legendaryCard = findLegendaryCardByRule(rule)
      const mythicCard = findMythicCardByRule(rule)

      if (!legendaryCard || !mythicCard) continue

      const evolutionKey = `hexcore_evolution_${legendaryCard.key}_to_${mythicCard.key}`

      if (seenKeys.has(evolutionKey)) continue
      seenKeys.add(evolutionKey)

      evolutions.push({
        key: evolutionKey,
        name: `Hexcore & ${legendaryCard.characterName} — ${mythicCard.name}`,
        characterName: mythicCard.characterName,
        rarity: "mythic",
        rarityLabel: "Évolution mythique",
        value: mythicCard.value || 1000,
        image: mythicCard.image || "",
        description:
          `Utilise **${hexcoreCard.name}** avec **${legendaryCard.name}** pour obtenir la version mythique : **${mythicCard.name}**.`,
        faction: mythicCard.faction || legendaryCard.faction || "Hexcore",
        season: "Évolution Hexcore",
        tags: ["Hexcore", "Évolution", "Mythique", ...(mythicCard.tags || [])],
        source: "hexcore_evolution",
        isPullable: false,
        isHexcoreEvolution: true,
        fusionBonusPercent: 0,
        ingredients: [hexcoreCard.key, legendaryCard.key],
        outputCardKey: mythicCard.key,
      })
    }
  }

  return evolutions
}

function getAllFusionOptions() {
  return [...fusionCards, ...getHexcoreEvolutionCards()]
}

function findFusionByKey(fusionKey) {
  return getAllFusionOptions().find((card) => card.key === fusionKey)
}

function findFusion(search) {
  const query = normalizeText(search)
  const allFusionOptions = getAllFusionOptions()

  const exactKey = allFusionOptions.find((card) => normalizeText(card.key) === query)
  if (exactKey) return exactKey

  const exactName = allFusionOptions.find((card) => normalizeText(card.name) === query)
  if (exactName) return exactName

  return allFusionOptions.find((card) => {
    return (
      normalizeText(card.key).includes(query) ||
      normalizeText(card.name).includes(query) ||
      normalizeText(card.characterName || "").includes(query)
    )
  })
}

function getFusionResultCard(fusionCard) {
  if (!fusionCard?.isHexcoreEvolution) return fusionCard

  return arcaneCards.find((card) => card.key === fusionCard.outputCardKey) || fusionCard
}

function getFusionResultKey(fusionCard) {
  return fusionCard?.outputCardKey || fusionCard?.key
}

function getFusionBonusText(fusionCard) {
  if (fusionCard?.isHexcoreEvolution) {
    return "**Version mythique obtenue**"
  }

  return `**+${fusionCard.fusionBonusPercent || 10}%**`
}

function getOfficialCard(cardKey) {
  return allCatalogCards.find((card) => card.key === cardKey)
}

function getReadableCardName(cardKey) {
  const card = getOfficialCard(cardKey)

  if (!card) {
    return "Carte inconnue"
  }

  return card.name
}

function getFusionStats(fusionCard) {
  return getCardStats(getFusionResultCard(fusionCard))
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
  const resultKey = getFusionResultKey(fusionCard)

  if (resultKey && ownedKeys.has(resultKey)) return false

  return (fusionCard.ingredients || []).every((ingredientKey) => {
    return ownedKeys.has(ingredientKey)
  })
}

function getAvailableFusions(ownedKeys) {
  return sortFusions(
    getAllFusionOptions().filter((fusionCard) => userCanCreateFusion(fusionCard, ownedKeys))
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
        name: fusionCard.isHexcoreEvolution ? "Évolution" : "Bonus fusion",
        value: getFusionBonusText(fusionCard),
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
    .setDescription(
      "Voici les fusions et évolutions Hexcore que tu peux créer maintenant avec tes cartes actuelles, en excluant celles que tu possèdes déjà."
    )
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
        `${fusionCard.isHexcoreEvolution ? "Évolution" : "Bonus fusion"} : ${getFusionBonusText(fusionCard)}\n` +
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

  const resultKey = getFusionResultKey(fusionCard)
  const alreadyOwnsFusion = resultKey ? ownedKeys.has(resultKey) : false
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
        name: fusionCard.isHexcoreEvolution ? "Évolution" : "Bonus fusion",
        value: getFusionBonusText(fusionCard),
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
          ? fusionCard.isHexcoreEvolution
            ? "✅ Tu possèdes déjà cette version mythique."
            : "✅ Tu possèdes déjà cette fusion."
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
  const resultCard = getFusionResultCard(fusionCard)
  const emoji = RARITY_EMOJIS[resultCard.rarity] || RARITY_EMOJIS[fusionCard.rarity] || "🎴"
  const isHexcoreEvolution = Boolean(fusionCard.isHexcoreEvolution)

  const embed = new EmbedBuilder()
    .setTitle(isHexcoreEvolution ? "✅ Évolution Hexcore réussie" : "✅ Fusion réussie")
    .setColor(RARITY_COLORS[resultCard.rarity] || RARITY_COLORS[fusionCard.rarity] || 0x2ecc71)
    .setDescription(
      `${emoji} Tu as obtenu **${resultCard.name || fusionCard.name}**.\n\n` +
      (isHexcoreEvolution
        ? "L'Hexcore et la carte légendaire ont été consommés.\nLa version mythique a été ajoutée à ton inventaire."
        : "Les cartes nécessaires ont été consommées.\nCette fusion a été ajoutée à ton inventaire.")
    )
    .addFields(
      {
        name: "Carte obtenue",
        value:
          `Rareté : **${resultCard.rarityLabel || fusionCard.rarityLabel || resultCard.rarity || fusionCard.rarity}**\n` +
          `Valeur : **${resultCard.value || fusionCard.value || 0} pts**\n` +
          `${fusionCard.isHexcoreEvolution ? "Évolution" : "Bonus fusion"} : ${getFusionBonusText(fusionCard)}`,
        inline: false,
      },
      {
        name: "Stats",
        value: formatStats(stats),
        inline: false,
      }
    )
    .setTimestamp()

  if (resultCard.image || fusionCard.image) {
    embed.setImage(resultCard.image || fusionCard.image)
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

async function addCatalogCard(client, userId, card, source = "hexcore_evolution", evolutionData = null) {
  const stats = getCardStats(card)

  await client.db.collection("player_cards").updateOne(
    {
      userId,
      cardKey: card.key,
    },
    {
      $setOnInsert: {
        userId,
        cardKey: card.key,
        cardName: card.name,
        characterName: card.characterName || card.name,
        rarity: card.rarity,
        rarityLabel: card.rarityLabel || card.rarity,
        value: card.value || 0,
        image: card.image || "",
        description: card.description || "",
        faction: card.faction || "Inconnue",
        season: card.season || "Arcane",
        tags: card.tags || [],
        source,
        isPullable: card.isPullable,
        evolutionSource: evolutionData?.key || null,
        evolutionIngredients: evolutionData?.ingredients || [],
        battleStats: {
          hp: stats.hp,
          attack: stats.attack,
          defense: stats.defense,
          speed: stats.speed,
          power: stats.power,
        },
        favorite: false,
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
        favorite: false,
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
  const resultCard = getFusionResultCard(fusionCard)
  const resultKey = getFusionResultKey(fusionCard)

  if (resultKey && ownedKeys.has(resultKey)) {
    return {
      success: false,
      message: fusionCard.isHexcoreEvolution
        ? `❌ Tu possèdes déjà la version mythique : **${resultCard.name}**.`
        : `❌ Tu possèdes déjà cette fusion : **${fusionCard.name}**.`,
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

  const profile = await client.db.collection("player_profiles").findOne({
    userId,
  })

  const currentFavoriteKey = profile?.favoriteCardKey || null
  const ingredients = fusionCard.ingredients || []
  const favoriteWasConsumed = currentFavoriteKey && ingredients.includes(currentFavoriteKey)

  await consumeIngredientCards(client, userId, ingredients)

  if (fusionCard.isHexcoreEvolution) {
    await addCatalogCard(client, userId, resultCard, "hexcore_evolution", fusionCard)
  } else {
    await addFusionCard(client, userId, fusionCard)
  }

  if (favoriteWasConsumed) {
    await setFusionAsFavorite(client, userId, resultKey)

    return {
      success: true,
      favoriteChanged: true,
    }
  }

  return {
    success: true,
    favoriteChanged: false,
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("fusion")
    .setDescription("Créer des cartes fusion ou évoluer une légendaire avec l'Hexcore")

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
        sortFusions(getAllFusionOptions()),
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
            "Il te manque sûrement une ou plusieurs cartes nécessaires, ou tu possèdes déjà les fusions possibles.",
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
        sortFusions(getAllFusionOptions()),
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
      const fusionCard = findFusionByKey(fusionKey)

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

      if (result.favoriteChanged) {
        embed.addFields({
          name: "Carte favorite",
          value:
            "Ta carte favorite précédente a été consommée pendant la fusion.\n" +
            "La nouvelle carte obtenue est donc devenue ta carte favorite.",
          inline: false,
        })
      } else {
        embed.addFields({
          name: "Carte favorite",
          value:
            "Ta carte favorite actuelle a été conservée.\n" +
            "Tu peux changer de favorite avec `/favori` si tu veux utiliser cette carte en combat.",
          inline: false,
        })
      }

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
    const fusionCard = findFusionByKey(fusionKey)

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
        "Clique sur **Confirmer la fusion** pour consommer les cartes nécessaires et obtenir la carte indiquée.\n" +
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