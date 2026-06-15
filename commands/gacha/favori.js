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
  const card = await client.db.collection("player_cards").findOne({
    userId,
    cardKey,
  })

  return Boolean(card)
}

async function setFavoriteCard(client, userId, cardKey) {
  await client.db.collection("player_profiles").updateOne(
    {
      userId,
    },
    {
      $set: {
        userId,
        favoriteCardKey: cardKey,
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
      cardKey,
    },
    {
      $set: {
        favorite: true,
        updatedAt: new Date(),
      },
    }
  )
}

async function removeFavoriteCard(client, userId) {
  await client.db.collection("player_profiles").updateOne(
    {
      userId,
    },
    {
      $unset: {
        favoriteCardKey: "",
      },
      $set: {
        userId,
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
}

function getGlobalBonusPercent(level) {
  const multiplier = LEVEL_MULTIPLIERS[level] || 0
  return Math.round(multiplier * 100)
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

function buildFavoriteEmbed(user, card, baseStats, upgradedStats, upgrade) {
  const emoji = RARITY_EMOJIS[card.rarity] || "🎴"
  const bonusPercent = getGlobalBonusPercent(upgrade.level || 1)

  const embed = new EmbedBuilder()
    .setTitle("⭐ Carte favorite définie")
    .setColor(RARITY_COLORS[card.rarity] || 0x5865f2)
    .setDescription(
      `${emoji} **${card.name}** est maintenant ta carte favorite.\n\n` +
      "Elle sera aussi utilisée automatiquement comme **carte de combat par défaut** avec `/combat pve` et `/combat pvp`, sauf si tu précises une autre carte."
    )
    .addFields(
      {
        name: "📌 Carte",
        value:
          `ID : \`${card.key}\`\n` +
          `Rareté : **${card.rarityLabel || card.rarity}**\n` +
          `Valeur : **${card.value || 0} pts**`,
        inline: false,
      },
      {
        name: "⚙️ Amélioration",
        value:
          `Niveau : **${upgrade.level || 1}/${MAX_LEVEL}**\n` +
          `Bonus global : **+${bonusPercent}%**\n` +
          `Bonus spécifiques : ❤️ +${upgrade.hpBonus || 0} / ⚔️ +${upgrade.attackBonus || 0} / 🛡️ +${upgrade.defenseBonus || 0} / 💨 +${upgrade.speedBonus || 0}`,
        inline: false,
      },
      {
        name: "📉 Stats de base",
        value: formatStats(baseStats),
        inline: true,
      },
      {
        name: "📈 Stats en combat",
        value: formatStats(upgradedStats),
        inline: true,
      },
      {
        name: "➕ Gain",
        value: formatStatDiff(baseStats, upgradedStats),
        inline: false,
      }
    )
    .setFooter({
      text: "Utilise /ameliorer pour renforcer ta carte favorite.",
    })
    .setTimestamp()

  if (card.image) {
    embed.setImage(card.image)
  }

  return embed
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("favori")
    .setDescription("Choisir ou retirer ta carte favorite")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("carte")
        .setDescription("Définir une carte favorite et carte de combat par défaut")
        .addStringOption((option) =>
          option
            .setName("carte")
            .setDescription("Nom ou ID de la carte")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("retirer")
        .setDescription("Retirer ta carte favorite")
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand()

    if (subcommand === "retirer") {
      await removeFavoriteCard(client, interaction.user.id)

      return interaction.reply({
        content:
          "✅ Ta carte favorite a été retirée.\n" +
          "⚠️ Tu devras maintenant préciser une carte dans `/combat`, ou redéfinir une favorite avec `/favori carte:<nom>`.",
        ephemeral: true,
      })
    }

    if (subcommand === "carte") {
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

      await setFavoriteCard(client, interaction.user.id, card.key)

      const baseStats = getCardStats(card)
      const upgradedStats = await getCardStatsWithUpgrade(
        client,
        interaction.user.id,
        card
      )
      const upgrade = await getCardUpgrade(client, interaction.user.id, card.key)

      const embed = buildFavoriteEmbed(
        interaction.user,
        card,
        baseStats,
        upgradedStats,
        upgrade
      )

      return interaction.reply({
        embeds: [embed],
        ephemeral: true,
      })
    }
  },
}