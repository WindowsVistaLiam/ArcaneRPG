const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js")

const arcaneCards = require("../../data/arcaneCards")
const { getCardStats } = require("../../utils/cardBattle")

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

module.exports = {
  data: new SlashCommandBuilder()
    .setName("favori")
    .setDescription("Choisir ou retirer ta carte favorite")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("carte")
        .setDescription("Définir une carte favorite")
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
        content: "✅ Ta carte favorite a été retirée.",
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

      const stats = getCardStats(card)
      const emoji = RARITY_EMOJIS[card.rarity] || "🎴"

      const embed = new EmbedBuilder()
        .setTitle("⭐ Carte favorite définie")
        .setColor(RARITY_COLORS[card.rarity] || 0x5865f2)
        .setDescription(`${emoji} **${card.name}** est maintenant ta carte favorite.`)
        .addFields(
          {
            name: "ID",
            value: `\`${card.key}\``,
            inline: false,
          },
          {
            name: "Rareté",
            value: card.rarityLabel || card.rarity,
            inline: true,
          },
          {
            name: "Puissance",
            value: `⚡ ${stats.power}`,
            inline: true,
          },
          {
            name: "Valeur",
            value: `⭐ ${card.value || 0} pts`,
            inline: true,
          }
        )
        .setTimestamp()

      if (card.image) {
        embed.setImage(card.image)
      }

      return interaction.reply({
        embeds: [embed],
        ephemeral: true,
      })
    }
  },
}