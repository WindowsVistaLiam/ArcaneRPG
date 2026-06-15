const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js")

const arcaneCards = require("../../data/arcaneCards")

const {
  getCardStats,
  getCardStatsWithUpgrade,
  getCardUpgrade,
  LEVEL_MULTIPLIERS,
  MAX_LEVEL,
} = require("../../utils/cardBattle")

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

const RARITY_LABELS = {
  common: "Commune",
  rare: "Rare",
  epic: "Épique",
  legendary: "Légendaire",
  mythic: "Mythique",
}

const ITEM_LABELS = {
  upgrade_fragment: "Fragment d'amélioration",
  hextech_crystal: "Cristal Hextech",
  shimmer_catalyst: "Catalyseur Shimmer",
  hextech_armor: "Armure Hextech",
  speed_core: "Noyau de vitesse",
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

async function getOwnedCard(client, userId, cardKey) {
  return client.db.collection("player_cards").findOne({
    userId,
    cardKey,
  })
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

function formatStatDiff(baseStats, upgradedStats) {
  const hpDiff = upgradedStats.hp - baseStats.hp
  const attackDiff = upgradedStats.attack - baseStats.attack
  const defenseDiff = upgradedStats.defense - baseStats.defense
  const speedDiff = upgradedStats.speed - baseStats.speed
  const powerDiff = upgradedStats.power - baseStats.power

  return (
    `❤️ PV : **${hpDiff >= 0 ? "+" : ""}${hpDiff}**\n` +
    `⚔️ ATK : **${attackDiff >= 0 ? "+" : ""}${attackDiff}**\n` +
    `🛡️ DEF : **${defenseDiff >= 0 ? "+" : ""}${defenseDiff}**\n` +
    `💨 VIT : **${speedDiff >= 0 ? "+" : ""}${speedDiff}**\n` +
    `⚡ Puissance : **${powerDiff >= 0 ? "+" : ""}${powerDiff}**`
  )
}

function getGlobalBonusPercent(level) {
  const multiplier = LEVEL_MULTIPLIERS[level] || 0
  return Math.round(multiplier * 100)
}

function getNextLevelCost(level) {
  if (level >= MAX_LEVEL) {
    return "Niveau maximum atteint."
  }

  if (level === 1) {
    return `**${ITEM_LABELS.upgrade_fragment}** x3`
  }

  if (level === 2) {
    return (
      `**${ITEM_LABELS.upgrade_fragment}** x6\n` +
      `+ 1 spécialité au choix :\n` +
      `🧪 **${ITEM_LABELS.shimmer_catalyst}** pour +5 ATK\n` +
      `🛡️ **${ITEM_LABELS.hextech_armor}** pour +5 DEF\n` +
      `💨 **${ITEM_LABELS.speed_core}** pour +5 VIT`
    )
  }

  if (level === 3) {
    return (
      `**${ITEM_LABELS.upgrade_fragment}** x10\n` +
      `**${ITEM_LABELS.hextech_crystal}** x1`
    )
  }

  if (level === 4) {
    return (
      `**${ITEM_LABELS.upgrade_fragment}** x15\n` +
      `**${ITEM_LABELS.hextech_crystal}** x2`
    )
  }

  return "Aucun coût."
}

function getUpgradeStatusText(upgrade, ownsCard) {
  if (!ownsCard) {
    return "Tu ne possèdes pas cette carte. Les améliorations ne sont donc pas actives pour toi."
  }

  if (upgrade.level >= MAX_LEVEL) {
    return `Niveau **${upgrade.level}/${MAX_LEVEL}** — amélioration maximale atteinte.`
  }

  const currentBonus = getGlobalBonusPercent(upgrade.level)
  const nextBonus = getGlobalBonusPercent(upgrade.level + 1)

  return (
    `Niveau **${upgrade.level}/${MAX_LEVEL}**\n` +
    `Bonus global actuel : **+${currentBonus}%**\n` +
    `Prochain niveau : **${upgrade.level + 1}/${MAX_LEVEL}** avec **+${nextBonus}%**`
  )
}

function buildStatsEmbed({
  interaction,
  card,
  ownsCard,
  ownedCard,
  baseStats,
  upgradedStats,
  upgrade,
}) {
  const emoji = RARITY_EMOJIS[card.rarity] || "🎴"
  const rarityLabel = card.rarityLabel || RARITY_LABELS[card.rarity] || card.rarity

  const embed = new EmbedBuilder()
    .setTitle(`${emoji} Stats carte — ${card.name}`)
    .setColor(RARITY_COLORS[card.rarity] || 0x5865f2)
    .setDescription(card.description || "Carte Arcane")
    .addFields(
      {
        name: "📌 Informations",
        value:
          `ID : \`${card.key}\`\n` +
          `Rareté : **${rarityLabel}**\n` +
          `Valeur collection : **${card.value || 0} pts**\n` +
          `Possédée : **${ownsCard ? "Oui" : "Non"}**`,
        inline: false,
      },
      {
        name: "📉 Stats de base",
        value: formatStats(baseStats),
        inline: true,
      },
      {
        name: ownsCard ? "📈 Stats avec améliorations" : "📈 Stats améliorées",
        value: ownsCard
          ? formatStats(upgradedStats)
          : "Non disponible tant que tu ne possèdes pas cette carte.",
        inline: true,
      },
      {
        name: "➕ Gain actuel",
        value: ownsCard
          ? formatStatDiff(baseStats, upgradedStats)
          : "Aucun gain actif.",
        inline: false,
      },
      {
        name: "⚙️ Amélioration",
        value: getUpgradeStatusText(upgrade, ownsCard),
        inline: false,
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
        name: "📦 Coût prochaine amélioration",
        value: ownsCard ? getNextLevelCost(upgrade.level) : "Tu dois d'abord posséder cette carte.",
        inline: false,
      }
    )
    .setFooter({
      text: ownsCard
        ? "Ces stats améliorées sont utilisées en combat PVE/PVP."
        : "Utilise /tirage, /boutique ou /echange pour obtenir cette carte.",
    })
    .setTimestamp()

  if (card.image) {
    embed.setImage(card.image)
  }

  if (ownedCard?.favorite) {
    embed.addFields({
      name: "⭐ Favorite",
      value: "Cette carte est définie comme ta carte favorite.",
      inline: false,
    })
  }

  return embed
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("statscarte")
    .setDescription("Voir les statistiques de combat d'une carte")
    .addStringOption((option) =>
      option
        .setName("carte")
        .setDescription("Nom ou ID de la carte")
        .setRequired(true)
    ),

  async execute(interaction, client) {
    const search = interaction.options.getString("carte")
    const card = findCard(search)

    if (!card) {
      return interaction.reply({
        content: `❌ Aucune carte trouvée pour : **${search}**.`,
        ephemeral: true,
      })
    }

    const ownedCard = await getOwnedCard(client, interaction.user.id, card.key)
    const ownsCard = Boolean(ownedCard)

    const baseStats = getCardStats(card)

    const upgrade = ownsCard
      ? await getCardUpgrade(client, interaction.user.id, card.key)
      : {
          level: 1,
          hpBonus: 0,
          attackBonus: 0,
          defenseBonus: 0,
          speedBonus: 0,
        }

    const upgradedStats = ownsCard
      ? await getCardStatsWithUpgrade(client, interaction.user.id, card)
      : baseStats

    const embed = buildStatsEmbed({
      interaction,
      card,
      ownsCard,
      ownedCard,
      baseStats,
      upgradedStats,
      upgrade,
    })

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    })
  },
}