const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js")

const arcaneCards = require("../../data/arcaneCards")
const { getCardStats } = require("../../utils/cardBattle")

const MAX_LEVEL = 5

const LEVEL_MULTIPLIERS = {
  1: 0,
  2: 0.05,
  3: 0.10,
  4: 0.15,
  5: 0.25,
}

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

const ITEM_LABELS = {
  upgrade_fragment: "Fragment d'amélioration",
  hextech_crystal: "Cristal Hextech",
  shimmer_catalyst: "Catalyseur Shimmer",
  hextech_armor: "Armure Hextech",
  speed_core: "Noyau de vitesse",
}

const SPECIALTIES = {
  attaque: {
    label: "Attaque",
    itemKey: "shimmer_catalyst",
    itemLabel: "Catalyseur Shimmer",
    bonusField: "attackBonus",
    bonusAmount: 5,
    emoji: "🧪",
  },
  defense: {
    label: "Défense",
    itemKey: "hextech_armor",
    itemLabel: "Armure Hextech",
    bonusField: "defenseBonus",
    bonusAmount: 5,
    emoji: "🛡️",
  },
  vitesse: {
    label: "Vitesse",
    itemKey: "speed_core",
    itemLabel: "Noyau de vitesse",
    bonusField: "speedBonus",
    bonusAmount: 5,
    emoji: "💨",
  },
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function findCard(search) {
  const query = normalizeText(search)

  const exactKey = arcaneCards.find((card) => normalizeText(card.key) === query)
  if (exactKey) return exactKey

  const exactName = arcaneCards.find((card) => normalizeText(card.name) === query)
  if (exactName) return exactName

  return arcaneCards.find((card) => {
    return (
      normalizeText(card.key).includes(query) ||
      normalizeText(card.name).includes(query) ||
      normalizeText(card.characterName || "").includes(query) ||
      normalizeText(card.characterKey || "").includes(query)
    )
  })
}

async function userOwnsCard(client, userId, cardKey) {
  const ownedCard = await client.db.collection("player_cards").findOne({
    userId,
    cardKey,
  })

  return Boolean(ownedCard)
}

async function getUpgrade(client, userId, cardKey) {
  const upgrade = await client.db.collection("player_card_upgrades").findOne({
    userId,
    cardKey,
  })

  return {
    userId,
    cardKey,
    level: upgrade?.level || 1,
    hpBonus: upgrade?.hpBonus || 0,
    attackBonus: upgrade?.attackBonus || 0,
    defenseBonus: upgrade?.defenseBonus || 0,
    speedBonus: upgrade?.speedBonus || 0,
    createdAt: upgrade?.createdAt || null,
    updatedAt: upgrade?.updatedAt || null,
  }
}

async function getInventoryItems(client, userId) {
  const items = await client.db.collection("player_items")
    .find({
      userId,
      quantity: {
        $gt: 0,
      },
    })
    .toArray()

  const map = new Map()

  for (const item of items) {
    map.set(item.itemKey, item.quantity || 0)
  }

  return map
}

function getItemQuantity(itemsMap, itemKey) {
  return itemsMap.get(itemKey) || 0
}

function getRequiredItemsForLevel(currentLevel, specialtyKey = null) {
  if (currentLevel === 1) {
    return [
      {
        itemKey: "upgrade_fragment",
        quantity: 3,
      },
    ]
  }

  if (currentLevel === 2) {
    const specialty = specialtyKey ? SPECIALTIES[specialtyKey] : null

    if (!specialty) {
      return null
    }

    return [
      {
        itemKey: "upgrade_fragment",
        quantity: 6,
      },
      {
        itemKey: specialty.itemKey,
        quantity: 1,
      },
    ]
  }

  if (currentLevel === 3) {
    return [
      {
        itemKey: "upgrade_fragment",
        quantity: 10,
      },
      {
        itemKey: "hextech_crystal",
        quantity: 1,
      },
    ]
  }

  if (currentLevel === 4) {
    return [
      {
        itemKey: "upgrade_fragment",
        quantity: 15,
      },
      {
        itemKey: "hextech_crystal",
        quantity: 2,
      },
    ]
  }

  return []
}

function formatRequiredItems(requiredItems) {
  if (!requiredItems || !requiredItems.length) {
    return "Aucun coût."
  }

  return requiredItems
    .map((item) => {
      const label = ITEM_LABELS[item.itemKey] || item.itemKey
      return `**${label}** x${item.quantity}`
    })
    .join("\n")
}

function hasRequiredItems(itemsMap, requiredItems) {
  for (const item of requiredItems) {
    if (getItemQuantity(itemsMap, item.itemKey) < item.quantity) {
      return false
    }
  }

  return true
}

function getMissingItemsText(itemsMap, requiredItems) {
  const missing = []

  for (const item of requiredItems) {
    const owned = getItemQuantity(itemsMap, item.itemKey)

    if (owned < item.quantity) {
      const label = ITEM_LABELS[item.itemKey] || item.itemKey
      missing.push(`**${label}** : ${owned}/${item.quantity}`)
    }
  }

  return missing.join("\n")
}

async function consumeRequiredItems(client, userId, requiredItems) {
  for (const item of requiredItems) {
    await client.db.collection("player_items").updateOne(
      {
        userId,
        itemKey: item.itemKey,
      },
      {
        $inc: {
          quantity: -item.quantity,
        },
        $set: {
          updatedAt: new Date(),
        },
      }
    )
  }

  await client.db.collection("player_items").deleteMany({
    userId,
    quantity: {
      $lte: 0,
    },
  })
}

function chooseAutomaticSpecialty(itemsMap) {
  if (getItemQuantity(itemsMap, "shimmer_catalyst") > 0) return "attaque"
  if (getItemQuantity(itemsMap, "hextech_armor") > 0) return "defense"
  if (getItemQuantity(itemsMap, "speed_core") > 0) return "vitesse"

  return null
}

function applyUpgradeToStats(baseStats, upgrade) {
  const level = Math.min(Math.max(upgrade.level || 1, 1), MAX_LEVEL)
  const multiplier = LEVEL_MULTIPLIERS[level] || 0

  const hp = Math.round(baseStats.hp * (1 + multiplier)) + (upgrade.hpBonus || 0)
  const attack = Math.round(baseStats.attack * (1 + multiplier)) + (upgrade.attackBonus || 0)
  const defense = Math.round(baseStats.defense * (1 + multiplier)) + (upgrade.defenseBonus || 0)
  const speed = Math.round(baseStats.speed * (1 + multiplier)) + (upgrade.speedBonus || 0)

  return {
    hp,
    attack,
    defense,
    speed,
    power: hp + attack * 3 + defense * 2 + speed * 2,
  }
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

function getNextLevelText(upgrade) {
  if (upgrade.level >= MAX_LEVEL) {
    return "Cette carte est déjà au niveau maximum."
  }

  const nextLevel = upgrade.level + 1
  const multiplier = LEVEL_MULTIPLIERS[nextLevel] || 0

  return `Niveau suivant : **${nextLevel}** — Bonus global : **+${Math.round(multiplier * 100)}%**`
}

function getSpecialtyHelpText() {
  return (
    "Pour passer du niveau **2** au niveau **3**, tu peux choisir une spécialité :\n" +
    "🧪 `attaque` → consomme 1 Catalyseur Shimmer et ajoute **+5 ATK**\n" +
    "🛡️ `defense` → consomme 1 Armure Hextech et ajoute **+5 DEF**\n" +
    "💨 `vitesse` → consomme 1 Noyau de vitesse et ajoute **+5 VIT**"
  )
}

function buildViewEmbed(user, card, upgrade, itemsMap) {
  const baseStats = getCardStats(card)
  const upgradedStats = applyUpgradeToStats(baseStats, upgrade)
  const emoji = RARITY_EMOJIS[card.rarity] || "🎴"

  let costText = "Aucun coût."

  if (upgrade.level >= MAX_LEVEL) {
    costText = "Niveau maximum atteint."
  } else if (upgrade.level === 2) {
    costText = getSpecialtyHelpText()
  } else {
    costText = formatRequiredItems(getRequiredItemsForLevel(upgrade.level))
  }

  const embed = new EmbedBuilder()
    .setTitle(`⚙️ Amélioration — ${card.name}`)
    .setColor(RARITY_COLORS[card.rarity] || 0x5865f2)
    .setDescription(
      `${emoji} Carte de **${user.username}**\n` +
      `Rareté : **${card.rarityLabel || card.rarity}**\n` +
      `Niveau actuel : **${upgrade.level}/${MAX_LEVEL}**\n` +
      `${getNextLevelText(upgrade)}`
    )
    .addFields(
      {
        name: "📊 Stats actuelles avec amélioration",
        value: formatStats(upgradedStats),
        inline: true,
      },
      {
        name: "📉 Stats de base",
        value: formatStats(baseStats),
        inline: true,
      },
      {
        name: "🎯 Bonus spécifiques",
        value:
          `❤️ PV bonus : **+${upgrade.hpBonus || 0}**\n` +
          `⚔️ ATK bonus : **+${upgrade.attackBonus || 0}**\n` +
          `🛡️ DEF bonus : **+${upgrade.defenseBonus || 0}**\n` +
          `💨 VIT bonus : **+${upgrade.speedBonus || 0}**`,
        inline: false,
      },
      {
        name: "📦 Coût de la prochaine amélioration",
        value: costText,
        inline: false,
      },
      {
        name: "🎒 Tes ressources",
        value:
          `🔧 Fragment d'amélioration : **${getItemQuantity(itemsMap, "upgrade_fragment")}**\n` +
          `💎 Cristal Hextech : **${getItemQuantity(itemsMap, "hextech_crystal")}**\n` +
          `🧪 Catalyseur Shimmer : **${getItemQuantity(itemsMap, "shimmer_catalyst")}**\n` +
          `🛡️ Armure Hextech : **${getItemQuantity(itemsMap, "hextech_armor")}**\n` +
          `💨 Noyau de vitesse : **${getItemQuantity(itemsMap, "speed_core")}**`,
        inline: false,
      }
    )
    .setFooter({
      text: "Les bonus seront appliqués aux combats après le branchement de cardBattle.js.",
    })
    .setTimestamp()

  if (card.image) {
    embed.setImage(card.image)
  }

  return embed
}

function buildSuccessEmbed(user, card, beforeUpgrade, afterUpgrade, requiredItems, specialtyKey) {
  const beforeStats = applyUpgradeToStats(getCardStats(card), beforeUpgrade)
  const afterStats = applyUpgradeToStats(getCardStats(card), afterUpgrade)
  const emoji = RARITY_EMOJIS[card.rarity] || "🎴"

  const specialty = specialtyKey ? SPECIALTIES[specialtyKey] : null

  const embed = new EmbedBuilder()
    .setTitle("✅ Carte améliorée")
    .setColor(0x2ecc71)
    .setDescription(
      `${emoji} **${card.name}** a été améliorée pour **${user.username}**.\n\n` +
      `Niveau : **${beforeUpgrade.level} → ${afterUpgrade.level}**`
    )
    .addFields(
      {
        name: "📦 Ressources consommées",
        value: formatRequiredItems(requiredItems),
        inline: false,
      },
      {
        name: "📊 Avant",
        value: formatStats(beforeStats),
        inline: true,
      },
      {
        name: "📈 Après",
        value: formatStats(afterStats),
        inline: true,
      }
    )
    .setTimestamp()

  if (specialty) {
    embed.addFields({
      name: "🎯 Spécialité ajoutée",
      value: `${specialty.emoji} **${specialty.label}** : +${specialty.bonusAmount}`,
      inline: false,
    })
  }

  if (card.image) {
    embed.setImage(card.image)
  }

  return embed
}

async function improveCard(client, userId, card, specialtyOption) {
  const upgrade = await getUpgrade(client, userId, card.key)

  if (upgrade.level >= MAX_LEVEL) {
    return {
      success: false,
      message: `❌ **${card.name}** est déjà au niveau maximum.`,
    }
  }

  const itemsMap = await getInventoryItems(client, userId)

  let specialtyKey = specialtyOption || null

  if (upgrade.level === 2 && !specialtyKey) {
    specialtyKey = chooseAutomaticSpecialty(itemsMap)
  }

  if (upgrade.level === 2 && !specialtyKey) {
    return {
      success: false,
      message:
        "❌ Tu dois choisir une spécialité ou posséder au moins un objet spécial.\n\n" +
        getSpecialtyHelpText(),
    }
  }

  const requiredItems = getRequiredItemsForLevel(upgrade.level, specialtyKey)

  if (!requiredItems || !requiredItems.length) {
    return {
      success: false,
      message: "❌ Impossible de calculer le coût de cette amélioration.",
    }
  }

  if (!hasRequiredItems(itemsMap, requiredItems)) {
    return {
      success: false,
      message:
        `❌ Tu n'as pas les ressources nécessaires pour améliorer **${card.name}**.\n\n` +
        `Ressources manquantes :\n${getMissingItemsText(itemsMap, requiredItems)}`,
    }
  }

  await consumeRequiredItems(client, userId, requiredItems)

  const afterUpgrade = {
    ...upgrade,
    level: upgrade.level + 1,
    updatedAt: new Date(),
  }

  if (upgrade.level === 2 && specialtyKey) {
    const specialty = SPECIALTIES[specialtyKey]
    afterUpgrade[specialty.bonusField] =
      (afterUpgrade[specialty.bonusField] || 0) + specialty.bonusAmount
  }

  await client.db.collection("player_card_upgrades").updateOne(
    {
      userId,
      cardKey: card.key,
    },
    {
      $set: {
        userId,
        cardKey: card.key,
        cardName: card.name,
        rarity: card.rarity,
        level: afterUpgrade.level,
        hpBonus: afterUpgrade.hpBonus || 0,
        attackBonus: afterUpgrade.attackBonus || 0,
        defenseBonus: afterUpgrade.defenseBonus || 0,
        speedBonus: afterUpgrade.speedBonus || 0,
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

  return {
    success: true,
    beforeUpgrade: upgrade,
    afterUpgrade,
    requiredItems,
    specialtyKey,
  }
}

async function resetCardUpgrade(client, userId, cardKey) {
  await client.db.collection("player_card_upgrades").deleteOne({
    userId,
    cardKey,
  })
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ameliorer")
    .setDescription("Améliorer une carte avec des objets d'amélioration")

    .addSubcommand((subcommand) =>
      subcommand
        .setName("voir")
        .setDescription("Voir le niveau d'amélioration d'une carte")
        .addStringOption((option) =>
          option
            .setName("carte")
            .setDescription("Nom ou ID de la carte")
            .setRequired(true)
        )
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName("carte")
        .setDescription("Améliorer une carte")
        .addStringOption((option) =>
          option
            .setName("carte")
            .setDescription("Nom ou ID de la carte")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("specialite")
            .setDescription("Spécialité à choisir au passage niveau 2 vers 3")
            .setRequired(false)
            .addChoices(
              {
                name: "🧪 Attaque",
                value: "attaque",
              },
              {
                name: "🛡️ Défense",
                value: "defense",
              },
              {
                name: "💨 Vitesse",
                value: "vitesse",
              }
            )
        )
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName("reset")
        .setDescription("Réinitialiser l'amélioration d'une carte sans remboursement")
        .addStringOption((option) =>
          option
            .setName("carte")
            .setDescription("Nom ou ID de la carte")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("confirmation")
            .setDescription("Écris CONFIRMER pour réinitialiser")
            .setRequired(true)
        )
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand()
    const search = interaction.options.getString("carte")
    const card = findCard(search)

    if (!card) {
      return interaction.reply({
        content: `❌ Aucune carte trouvée pour : **${search}**.`,
        ephemeral: true,
      })
    }

    const ownsCard = await userOwnsCard(client, interaction.user.id, card.key)

    if (!ownsCard) {
      return interaction.reply({
        content: `❌ Tu ne possèdes pas cette carte : **${card.name}**.`,
        ephemeral: true,
      })
    }

    if (subcommand === "voir") {
      const upgrade = await getUpgrade(client, interaction.user.id, card.key)
      const itemsMap = await getInventoryItems(client, interaction.user.id)
      const embed = buildViewEmbed(interaction.user, card, upgrade, itemsMap)

      return interaction.reply({
        embeds: [embed],
        ephemeral: true,
      })
    }

    if (subcommand === "carte") {
      const specialtyOption = interaction.options.getString("specialite")

      const result = await improveCard(
        client,
        interaction.user.id,
        card,
        specialtyOption
      )

      if (!result.success) {
        return interaction.reply({
          content: result.message,
          ephemeral: true,
        })
      }

      const embed = buildSuccessEmbed(
        interaction.user,
        card,
        result.beforeUpgrade,
        result.afterUpgrade,
        result.requiredItems,
        result.specialtyKey
      )

      return interaction.reply({
        embeds: [embed],
      })
    }

    if (subcommand === "reset") {
      const confirmation = interaction.options.getString("confirmation")

      if (confirmation !== "CONFIRMER") {
        return interaction.reply({
          content: "❌ Réinitialisation annulée. Tu dois écrire exactement `CONFIRMER`.",
          ephemeral: true,
        })
      }

      await resetCardUpgrade(client, interaction.user.id, card.key)

      return interaction.reply({
        content:
          `✅ Les améliorations de **${card.name}** ont été réinitialisées.\n` +
          "Aucune ressource n'a été remboursée.",
        ephemeral: true,
      })
    }
  },
}