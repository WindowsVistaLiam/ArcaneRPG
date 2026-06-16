const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js")

const arcaneCards = require("../../data/arcaneCards")
const fusionCards = require("../../data/fusionCards")

const {
  getCardStats,
} = require("../../utils/cardBattle")

const EPHEMERAL_FLAG = 64

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

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

function formatIngredient(cardKey, owned) {
  const card = getOfficialCard(cardKey)

  if (!card) {
    return `❓ \`${cardKey}\` — introuvable dans le catalogue`
  }

  const emoji = owned ? "✅" : "❌"

  return `${emoji} **${card.name}** \`${card.key}\``
}

async function userOwnsCard(client, userId, cardKey) {
  const card = await client.db.collection("player_cards").findOne({
    userId,
    cardKey,
  })

  return Boolean(card)
}

async function getIngredientsStatus(client, userId, fusionCard) {
  const status = []

  for (const ingredientKey of fusionCard.ingredients || []) {
    const owned = await userOwnsCard(client, userId, ingredientKey)

    status.push({
      cardKey: ingredientKey,
      owned,
      card: getOfficialCard(ingredientKey),
    })
  }

  return status
}

async function userOwnsFusion(client, userId, fusionKey) {
  return userOwnsCard(client, userId, fusionKey)
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
    {
      userId,
    },
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
    {
      userId,
    },
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
    {
      upsert: true,
    }
  )

  await client.db.collection("player_cards").updateMany(
    {
      userId,
    },
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

  await client.db.collection("player_cards").insertOne({
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
    updatedAt: new Date(),
  })
}

function buildFusionListEmbed() {
  const embed = new EmbedBuilder()
    .setTitle("🧬 Fusions disponibles")
    .setColor(0x9b59b6)
    .setDescription(
      "Les cartes fusion sont des cartes uniques non obtenables en tirage.\n" +
      "Elles consomment les cartes ingrédients et donnent une carte spéciale avec **+10% de stats** selon sa rareté de base."
    )
    .setTimestamp()

  for (const fusionCard of fusionCards) {
    const emoji = RARITY_EMOJIS[fusionCard.rarity] || "🧬"
    const ingredients = (fusionCard.ingredients || [])
      .map((key) => {
        const card = getOfficialCard(key)
        return card ? `• ${card.name}` : `• ${key}`
      })
      .join("\n")

    embed.addFields({
      name: `${emoji} ${fusionCard.name}`,
      value:
        `ID : \`${fusionCard.key}\`\n` +
        `Rareté : **${fusionCard.rarityLabel || fusionCard.rarity}**\n` +
        `Bonus fusion : **+${fusionCard.fusionBonusPercent || 10}%**\n` +
        `Ingrédients :\n${ingredients}`,
      inline: false,
    })
  }

  return embed
}

async function buildFusionViewEmbed(client, userId, fusionCard) {
  const stats = getFusionStats(fusionCard)
  const ingredientStatus = await getIngredientsStatus(client, userId, fusionCard)
  const alreadyOwnsFusion = await userOwnsFusion(client, userId, fusionCard.key)

  const ingredientsText = ingredientStatus
    .map((ingredient) => formatIngredient(ingredient.cardKey, ingredient.owned))
    .join("\n")

  const canCreate = !alreadyOwnsFusion && ingredientStatus.every((item) => item.owned)

  const embed = new EmbedBuilder()
    .setTitle(`🧬 Fusion — ${fusionCard.name}`)
    .setColor(RARITY_COLORS[fusionCard.rarity] || 0x9b59b6)
    .setDescription(fusionCard.description || "Carte fusion unique.")
    .addFields(
      {
        name: "📌 Informations",
        value:
          `ID : \`${fusionCard.key}\`\n` +
          `Rareté : **${fusionCard.rarityLabel || fusionCard.rarity}**\n` +
          `Valeur : **${fusionCard.value || 0} pts**\n` +
          `Tirable : **Non**\n` +
          `Bonus fusion : **+${fusionCard.fusionBonusPercent || 10}%**`,
        inline: false,
      },
      {
        name: "📦 Ingrédients",
        value: ingredientsText || "Aucun ingrédient.",
        inline: false,
      },
      {
        name: "📊 Stats de la carte fusion",
        value: formatStats(stats),
        inline: false,
      },
      {
        name: "✅ État",
        value: alreadyOwnsFusion
          ? "Tu possèdes déjà cette fusion."
          : canCreate
            ? "Tu peux créer cette fusion avec `/fusion creer`."
            : "Il te manque au moins une carte ingrédient.",
        inline: false,
      }
    )
    .setTimestamp()

  if (fusionCard.image) {
    embed.setImage(fusionCard.image)
  }

  return embed
}

function buildFusionSuccessEmbed(fusionCard, stats) {
  const emoji = RARITY_EMOJIS[fusionCard.rarity] || "🧬"

  const embed = new EmbedBuilder()
    .setTitle("✅ Fusion réussie")
    .setColor(RARITY_COLORS[fusionCard.rarity] || 0x2ecc71)
    .setDescription(
      `${emoji} Tu as créé **${fusionCard.name}**.\n\n` +
      "Les cartes ingrédients ont été consommées.\n" +
      "Cette fusion est maintenant ta **carte favorite** et donc ta carte de combat par défaut."
    )
    .addFields(
      {
        name: "📌 Carte obtenue",
        value:
          `ID : \`${fusionCard.key}\`\n` +
          `Rareté : **${fusionCard.rarityLabel || fusionCard.rarity}**\n` +
          `Valeur : **${fusionCard.value || 0} pts**\n` +
          `Bonus fusion : **+${fusionCard.fusionBonusPercent || 10}%**`,
        inline: false,
      },
      {
        name: "📊 Stats",
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

module.exports = {
  data: new SlashCommandBuilder()
    .setName("fusion")
    .setDescription("Créer des cartes fusion uniques avec plusieurs cartes")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("liste")
        .setDescription("Voir les fusions disponibles")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("voir")
        .setDescription("Voir les détails d'une fusion")
        .addStringOption((option) =>
          option
            .setName("fusion")
            .setDescription("Nom ou ID de la fusion")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("creer")
        .setDescription("Créer une carte fusion")
        .addStringOption((option) =>
          option
            .setName("fusion")
            .setDescription("Nom ou ID de la fusion")
            .setRequired(true)
        )
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand()

    await interaction.deferReply({
      flags: EPHEMERAL_FLAG,
    })

    if (subcommand === "liste") {
      const embed = buildFusionListEmbed()

      return interaction.editReply({
        embeds: [embed],
      })
    }

    const search = interaction.options.getString("fusion")
    const fusionCard = findFusion(search)

    if (!fusionCard) {
      return interaction.editReply({
        content: `❌ Aucune fusion trouvée pour : **${search}**.`,
      })
    }

    if (subcommand === "voir") {
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
      const alreadyOwnsFusion = await userOwnsFusion(
        client,
        interaction.user.id,
        fusionCard.key
      )

      if (alreadyOwnsFusion) {
        return interaction.editReply({
          content: `❌ Tu possèdes déjà cette fusion : **${fusionCard.name}**.`,
        })
      }

      const ingredientStatus = await getIngredientsStatus(
        client,
        interaction.user.id,
        fusionCard
      )

      const missingIngredients = ingredientStatus.filter((item) => !item.owned)

      if (missingIngredients.length > 0) {
        const missingText = missingIngredients
          .map((item) => formatIngredient(item.cardKey, false))
          .join("\n")

        return interaction.editReply({
          content:
            `❌ Tu ne peux pas créer **${fusionCard.name}**.\n\n` +
            `Cartes manquantes :\n${missingText}`,
        })
      }

      await consumeIngredientCards(
        client,
        interaction.user.id,
        fusionCard.ingredients || []
      )

      await removeFavoriteIfConsumed(
        client,
        interaction.user.id,
        fusionCard.ingredients || []
      )

      await addFusionCard(client, interaction.user.id, fusionCard)

      await setFusionAsFavorite(
        client,
        interaction.user.id,
        fusionCard.key
      )

      const stats = getFusionStats(fusionCard)
      const embed = buildFusionSuccessEmbed(fusionCard, stats)

      return interaction.editReply({
        embeds: [embed],
      })
    }
  },
}