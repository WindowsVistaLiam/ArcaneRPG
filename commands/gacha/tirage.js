const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js")

const { ObjectId } = require("mongodb")
const arcaneCards = require("../../data/arcaneCards")

const TIRAGE_COOLDOWN_MS = 60 * 60 * 1000

const RARITY_WEIGHTS = {
  common: 500,
  rare: 300,
  epic: 160,
  legendary: 38,
  mythic: 2,
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

const FRAGMENTS_BY_RARITY = {
  common: 1,
  rare: 4,
  epic: 12,
  legendary: 35,
  mythic: 100,
}

function formatRemainingTime(ms) {
  const totalMinutes = Math.ceil(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}min`
  }

  if (hours > 0) {
    return `${hours}h`
  }

  return `${minutes}min`
}

async function checkTirageCooldown(client, userId) {
  const cooldown = await client.db.collection("tirage_cooldowns").findOne({
    userId,
  })

  if (!cooldown || !cooldown.lastTirageAt) {
    return {
      allowed: true,
      remainingMs: 0,
    }
  }

  const lastTirageAt = new Date(cooldown.lastTirageAt).getTime()
  const now = Date.now()
  const elapsed = now - lastTirageAt
  const remainingMs = TIRAGE_COOLDOWN_MS - elapsed

  return {
    allowed: remainingMs <= 0,
    remainingMs: Math.max(0, remainingMs),
  }
}

async function setTirageCooldown(client, userId) {
  await client.db.collection("tirage_cooldowns").updateOne(
    {
      userId,
    },
    {
      $set: {
        userId,
        lastTirageAt: new Date(),
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

async function processTirageCards(client, userId, cards) {
  const playerCardsCollection = client.db.collection("player_cards")
  const walletsCollection = client.db.collection("player_wallets")

  const existingCards = await playerCardsCollection
    .find({
      userId,
    })
    .project({
      cardKey: 1,
    })
    .toArray()

  const ownedCardKeys = new Set(existingCards.map((card) => card.cardKey))

  const newCards = []
  const duplicateCards = []

  let totalFragmentsEarned = 0

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    const alreadyOwned = ownedCardKeys.has(card.key)

    if (alreadyOwned) {
      const fragments = FRAGMENTS_BY_RARITY[card.rarity] || 1

      totalFragmentsEarned += fragments

      duplicateCards.push({
        ...card,
        tirageIndex: i,
        fragmentsEarned: fragments,
      })

      continue
    }

    await playerCardsCollection.insertOne({
      userId,
      cardKey: card.key,
      cardName: card.name,
      rarity: card.rarity,
      rarityLabel: card.rarityLabel,
      value: card.value,
      image: card.image,
      description: card.description || "",
      source: "tirage",
      claimedAt: new Date(),
      favorite: false,
      locked: false,
    })

    ownedCardKeys.add(card.key)

    newCards.push({
      ...card,
      tirageIndex: i,
    })
  }

  if (totalFragmentsEarned > 0) {
    await walletsCollection.updateOne(
      {
        userId,
      },
      {
        $inc: {
          fragments: totalFragmentsEarned,
        },
        $set: {
          updatedAt: new Date(),
        },
        $setOnInsert: {
          userId,
          createdAt: new Date(),
        },
      },
      {
        upsert: true,
      }
    )
  }

  return {
    newCards,
    duplicateCards,
    totalFragmentsEarned,
    newCardsCount: newCards.length,
    duplicatesCount: duplicateCards.length,
  }
}

function buildNewCardEmbed(session) {
  const index = session.currentIndex
  const card = session.displayCards[index]
  const emoji = RARITY_EMOJIS[card.rarity] || "🎴"

  const embed = new EmbedBuilder()
    .setTitle(`${emoji} ${card.name}`)
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
        value: `${card.value || 0} pts`,
        inline: true,
      },
      {
        name: "Progression",
        value: `Carte ${index + 1}/${session.displayCards.length}`,
        inline: true,
      }
    )
    .setFooter({
      text: "Nouvelle carte ajoutée à ton inventaire",
    })
    .setTimestamp()

  if (card.image) {
    embed.setImage(card.image)
  }

  return embed
}

function buildDuplicatesSummaryEmbed(session) {
  const duplicateCards = session.duplicateCards || []

  const embed = new EmbedBuilder()
    .setTitle("♻️ Résumé des doublons")
    .setColor(0x5865f2)
    .setTimestamp()

  if (!duplicateCards.length) {
    embed.setDescription(
      "Aucun doublon dans ce tirage.\n\n" +
      `🆕 Nouvelles cartes : **${session.newCardsCount}**\n` +
      `💠 Fragments gagnés : **0**`
    )

    return embed
  }

  const grouped = new Map()

  for (const card of duplicateCards) {
    if (!grouped.has(card.key)) {
      grouped.set(card.key, {
        name: card.name,
        rarity: card.rarity,
        rarityLabel: card.rarityLabel,
        count: 0,
        fragments: 0,
      })
    }

    const entry = grouped.get(card.key)
    entry.count += 1
    entry.fragments += card.fragmentsEarned || 0
  }

  const duplicateList = Array.from(grouped.values())
    .map((entry) => {
      const emoji = RARITY_EMOJIS[entry.rarity] || "🎴"
      const countText = entry.count > 1 ? ` x${entry.count}` : ""

      return `${emoji} **${entry.name}**${countText} — 💠 ${entry.fragments}`
    })
    .join("\n")

  embed.setDescription(
    `${duplicateList}\n\n` +
    `🆕 Nouvelles cartes : **${session.newCardsCount}**\n` +
    `♻️ Doublons : **${session.duplicatesCount}**\n` +
    `💠 Fragments gagnés : **${session.totalFragmentsEarned}**`
  )

  embed.setFooter({
    text: "Les doublons ont été automatiquement convertis en fragments",
  })

  return embed
}

function buildCurrentEmbed(session) {
  const isSummaryPage = session.currentIndex === session.displayCards.length

  if (isSummaryPage) {
    return buildDuplicatesSummaryEmbed(session)
  }

  return buildNewCardEmbed(session)
}

function buildButtons(sessionId, index, totalPages) {
  const previousButton = new ButtonBuilder()
    .setCustomId(`tirage:previous:${sessionId}`)
    .setLabel("⬅️ Précédente")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(index === 0)

  const nextButton = new ButtonBuilder()
    .setCustomId(`tirage:next:${sessionId}`)
    .setLabel("Suivante ➡️")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(index >= totalPages - 1)

  return new ActionRowBuilder().addComponents(previousButton, nextButton)
}

async function renderSession(interaction, session) {
  const embed = buildCurrentEmbed(session)

  const totalPages = session.displayCards.length + 1

  const row = buildButtons(
    session._id.toString(),
    session.currentIndex,
    totalPages
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
    const cooldown = await checkTirageCooldown(client, interaction.user.id)

    if (!cooldown.allowed) {
      return interaction.reply({
        content: `⏳ Tu dois attendre encore **${formatRemainingTime(cooldown.remainingMs)}** avant de refaire un tirage.`,
        ephemeral: true,
      })
    }

    const cards = generateTenCards()

    const processed = await processTirageCards(
      client,
      interaction.user.id,
      cards
    )

    const displayCards = processed.newCards

    const session = {
      userId: interaction.user.id,
      displayCards,
      duplicateCards: processed.duplicateCards,
      currentIndex: 0,
      newCardsCount: processed.newCardsCount,
      duplicatesCount: processed.duplicatesCount,
      totalFragmentsEarned: processed.totalFragmentsEarned,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    }

    const result = await client.db.collection("tirage_sessions").insertOne(session)

    await setTirageCooldown(client, interaction.user.id)

    const savedSession = {
      ...session,
      _id: result.insertedId,
    }

    const totalPages = savedSession.displayCards.length + 1

    if (savedSession.displayCards.length === 0) {
      savedSession.currentIndex = 0

      await client.db.collection("tirage_sessions").updateOne(
        {
          _id: result.insertedId,
        },
        {
          $set: {
            currentIndex: 0,
          },
        }
      )
    }

    const embed = buildCurrentEmbed(savedSession)

    const row = buildButtons(
      savedSession._id.toString(),
      savedSession.currentIndex,
      totalPages
    )

    return interaction.reply({
      content:
        `🎲 Tirage de 10 cartes terminé.\n` +
        `🆕 **${savedSession.newCardsCount}** nouvelle${savedSession.newCardsCount > 1 ? "s" : ""} carte${savedSession.newCardsCount > 1 ? "s" : ""} ajoutée${savedSession.newCardsCount > 1 ? "s" : ""}.\n` +
        `♻️ **${savedSession.duplicatesCount}** doublon${savedSession.duplicatesCount > 1 ? "s" : ""} converti${savedSession.duplicatesCount > 1 ? "s" : ""} en 💠 **${savedSession.totalFragmentsEarned}** fragment${savedSession.totalFragmentsEarned > 1 ? "s" : ""}.`,
      embeds: [embed],
      components: [row],
    })
  },

  async handleButton(interaction, client) {
    if (!interaction.customId.startsWith("tirage:")) return

    const parts = interaction.customId.split(":")
    const action = parts[1]
    const sessionId = parts[2]

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

    const totalPages = session.displayCards.length + 1

    if (action === "previous") {
      const newIndex = Math.max(0, session.currentIndex - 1)

      await sessions.updateOne(
        {
          _id: new ObjectId(sessionId),
        },
        {
          $set: {
            currentIndex: newIndex,
          },
        }
      )

      session.currentIndex = newIndex

      return renderSession(interaction, session)
    }

    if (action === "next") {
      const newIndex = Math.min(totalPages - 1, session.currentIndex + 1)

      await sessions.updateOne(
        {
          _id: new ObjectId(sessionId),
        },
        {
          $set: {
            currentIndex: newIndex,
          },
        }
      )

      session.currentIndex = newIndex

      return renderSession(interaction, session)
    }
  },
}