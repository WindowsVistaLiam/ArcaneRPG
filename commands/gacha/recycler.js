const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
} = require("discord.js")

const arcaneCards = require("../../data/arcaneCards")

const FRAGMENTS_BY_RARITY = {
  common: 1,
  rare: 4,
  epic: 12,
  legendary: 35,
  mythic: 100,
}

const RARITY_ORDER = {
  mythic: 1,
  legendary: 2,
  epic: 3,
  rare: 4,
  common: 5,
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

function getCardName(cardKey) {
  const card = getCardFromCatalog(cardKey)
  return card ? card.name : cardKey
}

function getCardRarity(cardKey) {
  const card = getCardFromCatalog(cardKey)
  return card?.rarity || "common"
}

function getCardRarityLabel(cardKey) {
  const card = getCardFromCatalog(cardKey)
  return card?.rarityLabel || "Commun"
}

async function getDuplicateOptions(client, userId) {
  const playerCards = await client.db
    .collection("player_cards")
    .find({ userId })
    .toArray()

  const grouped = new Map()

  for (const card of playerCards) {
    if (!grouped.has(card.cardKey)) {
      grouped.set(card.cardKey, {
        cardKey: card.cardKey,
        count: 0,
        rarity: card.rarity || getCardRarity(card.cardKey),
        rarityLabel: card.rarityLabel || getCardRarityLabel(card.cardKey),
      })
    }

    grouped.get(card.cardKey).count += 1
  }

  return Array.from(grouped.values())
    .filter((entry) => entry.count > 1)
    .sort((a, b) => {
      const rarityDiff = (RARITY_ORDER[a.rarity] || 99) - (RARITY_ORDER[b.rarity] || 99)
      if (rarityDiff !== 0) return rarityDiff

      return getCardName(a.cardKey).localeCompare(getCardName(b.cardKey))
    })
    .slice(0, 25)
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("recycler")
    .setDescription("Recycler un doublon de carte contre des fragments"),

  async execute(interaction, client) {
    const duplicateOptions = await getDuplicateOptions(client, interaction.user.id)

    if (!duplicateOptions.length) {
      return interaction.reply({
        content: "❌ Tu n'as aucun doublon à recycler.",
        ephemeral: true,
      })
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("recycler:select")
      .setPlaceholder("Choisis un doublon à recycler")
      .addOptions(
        duplicateOptions.map((entry) => {
          const fragments = FRAGMENTS_BY_RARITY[entry.rarity] || 1
          const emoji = RARITY_EMOJIS[entry.rarity] || "⚪"

          return {
            label: getCardName(entry.cardKey).slice(0, 100),
            description: `${entry.rarityLabel} — x${entry.count} — +${fragments} fragments`,
            value: entry.cardKey,
            emoji,
          }
        })
      )

    const row = new ActionRowBuilder().addComponents(selectMenu)

    return interaction.reply({
      content: "Choisis la carte à recycler. Le bot supprimera **un seul exemplaire**.",
      components: [row],
      ephemeral: true,
    })
  },

  async handleSelect(interaction, client) {
    if (interaction.customId !== "recycler:select") return

    const cardKey = interaction.values[0]

    const cards = await client.db
      .collection("player_cards")
      .find({
        userId: interaction.user.id,
        cardKey,
      })
      .sort({ claimedAt: 1 })
      .toArray()

    if (cards.length <= 1) {
      return interaction.reply({
        content: "❌ Tu ne peux recycler que des doublons. Tu dois garder au moins un exemplaire.",
        ephemeral: true,
      })
    }

    const cardToRecycle = cards[0]
    const rarity = cardToRecycle.rarity || getCardRarity(cardKey)
    const fragments = FRAGMENTS_BY_RARITY[rarity] || 1

    await client.db.collection("player_cards").deleteOne({
      _id: cardToRecycle._id,
      userId: interaction.user.id,
    })

    await client.db.collection("player_wallets").updateOne(
      {
        userId: interaction.user.id,
      },
      {
        $inc: {
          fragments,
        },
        $set: {
          updatedAt: new Date(),
        },
        $setOnInsert: {
          userId: interaction.user.id,
          createdAt: new Date(),
        },
      },
      {
        upsert: true,
      }
    )

    const remainingCount = cards.length - 1
    const cardName = cardToRecycle.cardName || getCardName(cardKey)
    const rarityLabel = cardToRecycle.rarityLabel || getCardRarityLabel(cardKey)

    const embed = new EmbedBuilder()
      .setTitle("♻️ Carte recyclée")
      .setColor(0x2ecc71)
      .setDescription(`Tu as recyclé **${cardName}**.`)
      .addFields(
        {
          name: "Rareté",
          value: rarityLabel,
          inline: true,
        },
        {
          name: "Fragments gagnés",
          value: `💠 +${fragments}`,
          inline: true,
        },
        {
          name: "Exemplaires restants",
          value: `x${remainingCount}`,
          inline: true,
        }
      )
      .setTimestamp()

    return interaction.update({
      content: "",
      embeds: [embed],
      components: [],
    })
  },
}