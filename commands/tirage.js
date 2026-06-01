const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js")

const arcaneCards = require("../data/arcaneCards")

const RARITY_WEIGHTS = {
  common: 55,
  rare: 25,
  epic: 12,
  legendary: 6,
  mythic: 2,
}

const RARITY_COLORS = {
  common: 0x95a5a6,
  rare: 0x3498db,
  epic: 0x9b59b6,
  legendary: 0xf1c40f,
  mythic: 0xe74c3c,
}

function pickRandomCard() {
  const weightedCards = []

  for (const card of arcaneCards) {
    const weight = RARITY_WEIGHTS[card.rarity] || 1

    for (let i = 0; i < weight; i++) {
      weightedCards.push(card)
    }
  }

  return weightedCards[Math.floor(Math.random() * weightedCards.length)]
}

function generateTenCards() {
  const cards = []

  for (let i = 0; i < 10; i++) {
    cards.push(pickRandomCard())
  }

  return cards
}

function buildCardEmbed(card, index, total, claimed) {
  const embed = new EmbedBuilder()
    .setTitle(`🎴 ${card.name}`)
    .setDescription(card.description || "Carte Arcane")
    .setColor(RARITY_COLORS[card.rarity] || 0x5865f2)
    .addFields(
      {
        name: "Rareté",
        value: card.rarityLabel || card.rarity,
        inline: true,
      },
      {
        name: "Valeur",
        value: `${card.value} pts`,
        inline: true,
      },
      {
        name: "Progression",
        value: `Carte ${index + 1}/${total}`,
        inline: true,
      },
      {
        name: "Statut",
        value: claimed ? "✅ Carte déjà claim" : "🟢 Disponible",
        inline: true,
      }
    )
    .setFooter({
      text: "Mini-jeu de collection Arcane",
    })
    .setTimestamp()

  if (card.image) {
    embed.setImage(card.image)
  }

  return embed
}

function buildButtons(sessionId, index, total, claimed) {
  const previousButton = new ButtonBuilder()
    .setCustomId(`tirage:previous:${sessionId}`)
    .setLabel("⬅️ Précédente")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(index === 0)

  const claimButton = new ButtonBuilder()
    .setCustomId(`tirage:claim:${sessionId}`)
    .setLabel(claimed ? "Claimed" : "Claim")
    .setStyle(claimed ? ButtonStyle.Secondary : ButtonStyle.Success)
    .setDisabled(claimed)

  const nextButton = new ButtonBuilder()
    .setCustomId(`tirage:next:${sessionId}`)
    .setLabel("Suivante ➡️")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(index === total - 1)

  return new ActionRowBuilder().addComponents(
    previousButton,
    claimButton,
    nextButton
  )
}

async function renderSession(interaction, client, session) {
  const index = session.currentIndex
  const card = session.cards[index]
  const claimed = session.claimedIndexes.includes(index)

  const embed = buildCardEmbed(
    card,
    index,
    session.cards.length,
    claimed
  )

  const row = buildButtons(
    session._id.toString(),
    index,
    session.cards.length,
    claimed
  )

  return interaction.update({
    embeds: [embed],
    components: [row],
  })
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("tirage")
    .setDescription("Faire un tirage de 10 cartes Arcane"),

  async execute(interaction, client) {
    const cards = generateTenCards()

    const session = {
      userId: interaction.user.id,
      cards,
      currentIndex: 0,
      claimedIndexes: [],
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    }

    const result = await client.db.collection("tirage_sessions").insertOne(session)

    const savedSession = {
      ...session,
      _id: result.insertedId,
    }

    const firstCard = savedSession.cards[0]

    const embed = buildCardEmbed(
      firstCard,
      0,
      savedSession.cards.length,
      false
    )

    const row = buildButtons(
      savedSession._id.toString(),
      0,
      savedSession.cards.length,
      false
    )

    return interaction.reply({
      content: "🎲 Tirage de 10 cartes lancé.",
      embeds: [embed],
      components: [row],
    })
  },

  async handleButton(interaction, client) {
    if (!interaction.customId.startsWith("tirage:")) return

    const parts = interaction.customId.split(":")
    const action = parts[1]
    const sessionId = parts[2]

    const { ObjectId } = require("mongodb")

    if (!ObjectId.isValid(sessionId)) {
      return interaction.reply({
        content: "❌ Session de tirage invalide.",
        ephemeral: true,
      })
    }

    const sessions = client.db.collection("tirage_sessions")

    const session = await sessions.findOne({
      _id: new ObjectId(sessionId),
    })

    if (!session) {
      return interaction.reply({
        content: "❌ Ce tirage n'existe plus.",
        ephemeral: true,
      })
    }

    if (session.userId !== interaction.user.id) {
      return interaction.reply({
        content: "❌ Seul le joueur qui a lancé ce tirage peut utiliser ces boutons.",
        ephemeral: true,
      })
    }

    if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
      return interaction.reply({
        content: "❌ Ce tirage a expiré.",
        ephemeral: true,
      })
    }

    if (action === "previous") {
      const newIndex = Math.max(0, session.currentIndex - 1)

      await sessions.updateOne(
        { _id: new ObjectId(sessionId) },
        {
          $set: {
            currentIndex: newIndex,
          },
        }
      )

      session.currentIndex = newIndex

      return renderSession(interaction, client, session)
    }

    if (action === "next") {
      const newIndex = Math.min(session.cards.length - 1, session.currentIndex + 1)

      await sessions.updateOne(
        { _id: new ObjectId(sessionId) },
        {
          $set: {
            currentIndex: newIndex,
          },
        }
      )

      session.currentIndex = newIndex

      return renderSession(interaction, client, session)
    }

    if (action === "claim") {
      const index = session.currentIndex
      const card = session.cards[index]

      if (session.claimedIndexes.includes(index)) {
        return interaction.reply({
          content: "❌ Tu as déjà claim cette carte.",
          ephemeral: true,
        })
      }

      await client.db.collection("player_cards").insertOne({
        userId: interaction.user.id,
        cardKey: card.key,
        cardName: card.name,
        rarity: card.rarity,
        rarityLabel: card.rarityLabel,
        value: card.value,
        image: card.image,
        description: card.description || "",
        source: "tirage",
        tirageSessionId: new ObjectId(sessionId),
        tirageIndex: index,
        claimedAt: new Date(),
        favorite: false,
        locked: false,
      })

      await sessions.updateOne(
        { _id: new ObjectId(sessionId) },
        {
          $addToSet: {
            claimedIndexes: index,
          },
        }
      )

      session.claimedIndexes.push(index)

      const embed = buildCardEmbed(
        card,
        index,
        session.cards.length,
        true
      )

      const row = buildButtons(
        session._id.toString(),
        index,
        session.cards.length,
        true
      )

      await interaction.update({
        embeds: [embed],
        components: [row],
      })

      return interaction.followUp({
        content: `✅ Tu as claim **${card.name}** !`,
        ephemeral: true,
      })
    }
  },
}