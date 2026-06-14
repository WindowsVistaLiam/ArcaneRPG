const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js")

const { ObjectId } = require("mongodb")
const arcaneCards = require("../../data/arcaneCards")

const EXCHANGE_EXPIRES_MS = 10 * 60 * 1000

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
  return String(text)
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

function getCardFromCatalog(cardKey) {
  return arcaneCards.find((card) => card.key === cardKey)
}

async function getDisplayName(client, guild, userId) {
  if (guild) {
    const member = await guild.members.fetch(userId).catch(() => null)

    if (member) {
      return member.displayName
    }
  }

  const user = await client.users.fetch(userId).catch(() => null)

  return user ? user.username : `Utilisateur ${userId}`
}

async function getWalletFragments(client, userId) {
  const wallet = await client.db.collection("player_wallets").findOne({
    userId,
  })

  return wallet?.fragments || 0
}

async function addFragments(client, userId, amount) {
  if (amount <= 0) return

  await client.db.collection("player_wallets").updateOne(
    {
      userId,
    },
    {
      $inc: {
        fragments: amount,
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

async function removeFragments(client, userId, amount) {
  const currentFragments = await getWalletFragments(client, userId)
  const removed = Math.min(currentFragments, amount)
  const newFragments = Math.max(0, currentFragments - removed)

  await client.db.collection("player_wallets").updateOne(
    {
      userId,
    },
    {
      $set: {
        userId,
        fragments: newFragments,
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
    before: currentFragments,
    after: newFragments,
    removed,
  }
}

async function userOwnsCard(client, userId, cardKey) {
  const card = await client.db.collection("player_cards").findOne({
    userId,
    cardKey,
  })

  return Boolean(card)
}

function buildExchangeButtons(sessionId) {
  const acceptButton = new ButtonBuilder()
    .setCustomId(`echange:accept:${sessionId}`)
    .setLabel("✅ Accepter")
    .setStyle(ButtonStyle.Success)

  const refuseButton = new ButtonBuilder()
    .setCustomId(`echange:refuse:${sessionId}`)
    .setLabel("❌ Refuser")
    .setStyle(ButtonStyle.Danger)

  return new ActionRowBuilder().addComponents(acceptButton, refuseButton)
}

async function buildCardForCardEmbed({
  client,
  guild,
  proposerId,
  targetId,
  offeredCard,
  requestedCard,
}) {
  const proposerName = await getDisplayName(client, guild, proposerId)
  const targetName = await getDisplayName(client, guild, targetId)

  const offeredEmoji = RARITY_EMOJIS[offeredCard.rarity] || "🎴"
  const requestedEmoji = RARITY_EMOJIS[requestedCard.rarity] || "🎴"

  const embed = new EmbedBuilder()
    .setTitle("🔁 Proposition d'échange")
    .setColor(RARITY_COLORS[offeredCard.rarity] || 0x5865f2)
    .setDescription(
      `**${proposerName}** propose un échange à **${targetName}**.`
    )
    .addFields(
      {
        name: `${offeredEmoji} Carte proposée`,
        value:
          `**${offeredCard.name}**\n` +
          `ID : \`${offeredCard.key}\`\n` +
          `Rareté : **${offeredCard.rarityLabel || offeredCard.rarity}**\n` +
          `Valeur : **${offeredCard.value || 0} pts**`,
        inline: true,
      },
      {
        name: `${requestedEmoji} Carte demandée`,
        value:
          `**${requestedCard.name}**\n` +
          `ID : \`${requestedCard.key}\`\n` +
          `Rareté : **${requestedCard.rarityLabel || requestedCard.rarity}**\n` +
          `Valeur : **${requestedCard.value || 0} pts**`,
        inline: true,
      }
    )
    .setFooter({
      text: "L'échange expire dans 10 minutes.",
    })
    .setTimestamp()

  if (offeredCard.image) {
    embed.setThumbnail(offeredCard.image)
  }

  return embed
}

async function buildCardForFragmentsEmbed({
  client,
  guild,
  proposerId,
  targetId,
  offeredCard,
  priceFragments,
}) {
  const proposerName = await getDisplayName(client, guild, proposerId)
  const targetName = await getDisplayName(client, guild, targetId)

  const emoji = RARITY_EMOJIS[offeredCard.rarity] || "🎴"

  const embed = new EmbedBuilder()
    .setTitle("💠 Proposition de vente")
    .setColor(RARITY_COLORS[offeredCard.rarity] || 0x5865f2)
    .setDescription(
      `**${proposerName}** propose de vendre une carte à **${targetName}**.`
    )
    .addFields(
      {
        name: `${emoji} Carte proposée`,
        value:
          `**${offeredCard.name}**\n` +
          `ID : \`${offeredCard.key}\`\n` +
          `Rareté : **${offeredCard.rarityLabel || offeredCard.rarity}**\n` +
          `Valeur : **${offeredCard.value || 0} pts**`,
        inline: false,
      },
      {
        name: "Prix demandé",
        value: `💠 **${priceFragments}** fragment${priceFragments > 1 ? "s" : ""}`,
        inline: true,
      }
    )
    .setFooter({
      text: "La proposition expire dans 10 minutes.",
    })
    .setTimestamp()

  if (offeredCard.image) {
    embed.setThumbnail(offeredCard.image)
  }

  return embed
}

async function completeCardForCardExchange(client, session) {
  const cardsCollection = client.db.collection("player_cards")

  const offeredCard = getCardFromCatalog(session.offeredCardKey)
  const requestedCard = getCardFromCatalog(session.requestedCardKey)

  if (!offeredCard || !requestedCard) {
    return {
      success: false,
      message: "❌ Une des cartes de l'échange n'existe plus dans le catalogue.",
    }
  }

  const proposerOwnsOffered = await userOwnsCard(
    client,
    session.proposerId,
    offeredCard.key
  )

  const targetOwnsRequested = await userOwnsCard(
    client,
    session.targetId,
    requestedCard.key
  )

  if (!proposerOwnsOffered) {
    return {
      success: false,
      message: `❌ Le joueur qui a proposé l'échange ne possède plus **${offeredCard.name}**.`,
    }
  }

  if (!targetOwnsRequested) {
    return {
      success: false,
      message: `❌ Le joueur ciblé ne possède plus **${requestedCard.name}**.`,
    }
  }

  const proposerAlreadyOwnsRequested = await userOwnsCard(
    client,
    session.proposerId,
    requestedCard.key
  )

  const targetAlreadyOwnsOffered = await userOwnsCard(
    client,
    session.targetId,
    offeredCard.key
  )

  if (proposerAlreadyOwnsRequested) {
    return {
      success: false,
      message: `❌ Échange annulé : le proposant possède déjà **${requestedCard.name}**.`,
    }
  }

  if (targetAlreadyOwnsOffered) {
    return {
      success: false,
      message: `❌ Échange annulé : le joueur ciblé possède déjà **${offeredCard.name}**.`,
    }
  }

  await cardsCollection.updateOne(
    {
      userId: session.proposerId,
      cardKey: offeredCard.key,
    },
    {
      $set: {
        userId: session.targetId,
        exchangedAt: new Date(),
        exchangeSessionId: session._id.toString(),
        updatedAt: new Date(),
      },
    }
  )

  await cardsCollection.updateOne(
    {
      userId: session.targetId,
      cardKey: requestedCard.key,
    },
    {
      $set: {
        userId: session.proposerId,
        exchangedAt: new Date(),
        exchangeSessionId: session._id.toString(),
        updatedAt: new Date(),
      },
    }
  )

  return {
    success: true,
    offeredCard,
    requestedCard,
  }
}

async function completeCardForFragmentsExchange(client, session) {
  const cardsCollection = client.db.collection("player_cards")

  const offeredCard = getCardFromCatalog(session.offeredCardKey)

  if (!offeredCard) {
    return {
      success: false,
      message: "❌ La carte proposée n'existe plus dans le catalogue.",
    }
  }

  const proposerOwnsOffered = await userOwnsCard(
    client,
    session.proposerId,
    offeredCard.key
  )

  if (!proposerOwnsOffered) {
    return {
      success: false,
      message: `❌ Le vendeur ne possède plus **${offeredCard.name}**.`,
    }
  }

  const targetAlreadyOwnsOffered = await userOwnsCard(
    client,
    session.targetId,
    offeredCard.key
  )

  if (targetAlreadyOwnsOffered) {
    return {
      success: false,
      message: `❌ L'acheteur possède déjà **${offeredCard.name}**.`,
    }
  }

  const buyerFragments = await getWalletFragments(client, session.targetId)

  if (buyerFragments < session.priceFragments) {
    return {
      success: false,
      message:
        `❌ L'acheteur n'a pas assez de fragments.\n` +
        `Prix : **${session.priceFragments}**\n` +
        `Fragments disponibles : **${buyerFragments}**`,
    }
  }

  const removed = await removeFragments(
    client,
    session.targetId,
    session.priceFragments
  )

  if (removed.removed < session.priceFragments) {
    return {
      success: false,
      message: "❌ Paiement impossible. L'échange a été annulé.",
    }
  }

  await addFragments(client, session.proposerId, session.priceFragments)

  await cardsCollection.updateOne(
    {
      userId: session.proposerId,
      cardKey: offeredCard.key,
    },
    {
      $set: {
        userId: session.targetId,
        exchangedAt: new Date(),
        exchangeSessionId: session._id.toString(),
        soldForFragments: session.priceFragments,
        updatedAt: new Date(),
      },
    }
  )

  return {
    success: true,
    offeredCard,
    priceFragments: session.priceFragments,
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("echange")
    .setDescription("Échanger des cartes avec un autre joueur")

    .addSubcommand((subcommand) =>
      subcommand
        .setName("carte")
        .setDescription("Proposer un échange carte contre carte")
        .addUserOption((option) =>
          option
            .setName("joueur")
            .setDescription("Joueur avec qui échanger")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("ma-carte")
            .setDescription("Nom ou ID de la carte que tu proposes")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("sa-carte")
            .setDescription("Nom ou ID de la carte que tu demandes")
            .setRequired(true)
        )
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName("fragments")
        .setDescription("Proposer une carte contre des fragments")
        .addUserOption((option) =>
          option
            .setName("joueur")
            .setDescription("Joueur à qui tu proposes la carte")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("carte")
            .setDescription("Nom ou ID de la carte que tu proposes")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("prix")
            .setDescription("Prix en fragments")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100000)
        )
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand()
    const target = interaction.options.getUser("joueur")

    if (target.bot) {
      return interaction.reply({
        content: "❌ Tu ne peux pas faire d'échange avec un bot.",
        ephemeral: true,
      })
    }

    if (target.id === interaction.user.id) {
      return interaction.reply({
        content: "❌ Tu ne peux pas faire un échange avec toi-même.",
        ephemeral: true,
      })
    }

    if (subcommand === "carte") {
      const offeredSearch = interaction.options.getString("ma-carte")
      const requestedSearch = interaction.options.getString("sa-carte")

      const offeredCard = findCard(offeredSearch)
      const requestedCard = findCard(requestedSearch)

      if (!offeredCard) {
        return interaction.reply({
          content: `❌ Aucune carte trouvée pour ta carte : **${offeredSearch}**.`,
          ephemeral: true,
        })
      }

      if (!requestedCard) {
        return interaction.reply({
          content: `❌ Aucune carte trouvée pour la carte demandée : **${requestedSearch}**.`,
          ephemeral: true,
        })
      }

      if (offeredCard.key === requestedCard.key) {
        return interaction.reply({
          content: "❌ Tu ne peux pas échanger une carte contre la même carte.",
          ephemeral: true,
        })
      }

      const proposerOwnsOffered = await userOwnsCard(
        client,
        interaction.user.id,
        offeredCard.key
      )

      if (!proposerOwnsOffered) {
        return interaction.reply({
          content: `❌ Tu ne possèdes pas **${offeredCard.name}**.`,
          ephemeral: true,
        })
      }

      const targetOwnsRequested = await userOwnsCard(
        client,
        target.id,
        requestedCard.key
      )

      if (!targetOwnsRequested) {
        return interaction.reply({
          content: `❌ ${target} ne possède pas **${requestedCard.name}**.`,
          ephemeral: true,
        })
      }

      const proposerAlreadyOwnsRequested = await userOwnsCard(
        client,
        interaction.user.id,
        requestedCard.key
      )

      if (proposerAlreadyOwnsRequested) {
        return interaction.reply({
          content: `❌ Tu possèdes déjà **${requestedCard.name}**.`,
          ephemeral: true,
        })
      }

      const targetAlreadyOwnsOffered = await userOwnsCard(
        client,
        target.id,
        offeredCard.key
      )

      if (targetAlreadyOwnsOffered) {
        return interaction.reply({
          content: `❌ ${target} possède déjà **${offeredCard.name}**.`,
          ephemeral: true,
        })
      }

      const session = {
        type: "card_for_card",
        proposerId: interaction.user.id,
        targetId: target.id,
        offeredCardKey: offeredCard.key,
        requestedCardKey: requestedCard.key,
        status: "pending",
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + EXCHANGE_EXPIRES_MS),
      }

      const result = await client.db.collection("exchange_sessions").insertOne(session)

      const embed = await buildCardForCardEmbed({
        client,
        guild: interaction.guild,
        proposerId: interaction.user.id,
        targetId: target.id,
        offeredCard,
        requestedCard,
      })

      const row = buildExchangeButtons(result.insertedId.toString())

      return interaction.reply({
        content: `${target}, tu as reçu une proposition d'échange.`,
        embeds: [embed],
        components: [row],
      })
    }

    if (subcommand === "fragments") {
      const offeredSearch = interaction.options.getString("carte")
      const priceFragments = interaction.options.getInteger("prix")

      const offeredCard = findCard(offeredSearch)

      if (!offeredCard) {
        return interaction.reply({
          content: `❌ Aucune carte trouvée pour : **${offeredSearch}**.`,
          ephemeral: true,
        })
      }

      const proposerOwnsOffered = await userOwnsCard(
        client,
        interaction.user.id,
        offeredCard.key
      )

      if (!proposerOwnsOffered) {
        return interaction.reply({
          content: `❌ Tu ne possèdes pas **${offeredCard.name}**.`,
          ephemeral: true,
        })
      }

      const targetAlreadyOwnsOffered = await userOwnsCard(
        client,
        target.id,
        offeredCard.key
      )

      if (targetAlreadyOwnsOffered) {
        return interaction.reply({
          content: `❌ ${target} possède déjà **${offeredCard.name}**.`,
          ephemeral: true,
        })
      }

      const targetFragments = await getWalletFragments(client, target.id)

      if (targetFragments < priceFragments) {
        return interaction.reply({
          content:
            `❌ ${target} n'a pas assez de fragments pour cette proposition.\n` +
            `Prix : **${priceFragments}**\n` +
            `Fragments disponibles : **${targetFragments}**`,
          ephemeral: true,
        })
      }

      const session = {
        type: "card_for_fragments",
        proposerId: interaction.user.id,
        targetId: target.id,
        offeredCardKey: offeredCard.key,
        priceFragments,
        status: "pending",
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + EXCHANGE_EXPIRES_MS),
      }

      const result = await client.db.collection("exchange_sessions").insertOne(session)

      const embed = await buildCardForFragmentsEmbed({
        client,
        guild: interaction.guild,
        proposerId: interaction.user.id,
        targetId: target.id,
        offeredCard,
        priceFragments,
      })

      const row = buildExchangeButtons(result.insertedId.toString())

      return interaction.reply({
        content: `${target}, tu as reçu une proposition d'achat de carte.`,
        embeds: [embed],
        components: [row],
      })
    }
  },

  async handleButton(interaction, client) {
    if (!interaction.customId.startsWith("echange:")) return

    const parts = interaction.customId.split(":")
    const action = parts[1]
    const sessionId = parts[2]

    if (!ObjectId.isValid(sessionId)) {
      return interaction.reply({
        content: "❌ Proposition d'échange invalide.",
        ephemeral: true,
      })
    }

    const sessions = client.db.collection("exchange_sessions")

    const session = await sessions.findOne({
      _id: new ObjectId(sessionId),
    })

    if (!session) {
      return interaction.reply({
        content: "❌ Cette proposition d'échange n'existe plus.",
        ephemeral: true,
      })
    }

    if (session.status !== "pending") {
      return interaction.reply({
        content: "❌ Cette proposition d'échange a déjà été traitée.",
        ephemeral: true,
      })
    }

    if (interaction.user.id !== session.targetId) {
      return interaction.reply({
        content: "❌ Seul le joueur ciblé peut accepter ou refuser cet échange.",
        ephemeral: true,
      })
    }

    if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
      await sessions.updateOne(
        {
          _id: new ObjectId(sessionId),
        },
        {
          $set: {
            status: "expired",
            updatedAt: new Date(),
          },
        }
      )

      return interaction.update({
        content: "⏳ Cette proposition d'échange a expiré.",
        embeds: [],
        components: [],
      })
    }

    if (action === "refuse") {
      await sessions.updateOne(
        {
          _id: new ObjectId(sessionId),
        },
        {
          $set: {
            status: "refused",
            updatedAt: new Date(),
          },
        }
      )

      return interaction.update({
        content: "❌ La proposition d'échange a été refusée.",
        embeds: [],
        components: [],
      })
    }

    if (action === "accept") {
      let result = null

      if (session.type === "card_for_card") {
        result = await completeCardForCardExchange(client, session)
      }

      if (session.type === "card_for_fragments") {
        result = await completeCardForFragmentsExchange(client, session)
      }

      if (!result || !result.success) {
        await sessions.updateOne(
          {
            _id: new ObjectId(sessionId),
          },
          {
            $set: {
              status: "cancelled",
              updatedAt: new Date(),
            },
          }
        )

        return interaction.update({
          content: result?.message || "❌ L'échange a été annulé.",
          embeds: [],
          components: [],
        })
      }

      await sessions.updateOne(
        {
          _id: new ObjectId(sessionId),
        },
        {
          $set: {
            status: "completed",
            completedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      )

      const proposerName = await getDisplayName(
        client,
        interaction.guild,
        session.proposerId
      )

      const targetName = await getDisplayName(
        client,
        interaction.guild,
        session.targetId
      )

      if (session.type === "card_for_card") {
        const embed = new EmbedBuilder()
          .setTitle("✅ Échange terminé")
          .setColor(0x2ecc71)
          .setDescription(
            `**${proposerName}** et **${targetName}** ont échangé leurs cartes.`
          )
          .addFields(
            {
              name: proposerName,
              value: `Reçoit : **${result.requestedCard.name}**`,
              inline: true,
            },
            {
              name: targetName,
              value: `Reçoit : **${result.offeredCard.name}**`,
              inline: true,
            }
          )
          .setTimestamp()

        return interaction.update({
          content: "✅ Échange accepté.",
          embeds: [embed],
          components: [],
        })
      }

      if (session.type === "card_for_fragments") {
        const embed = new EmbedBuilder()
          .setTitle("✅ Vente terminée")
          .setColor(0x2ecc71)
          .setDescription(
            `**${targetName}** a acheté une carte à **${proposerName}**.`
          )
          .addFields(
            {
              name: "Carte vendue",
              value: `**${result.offeredCard.name}**`,
              inline: true,
            },
            {
              name: "Prix",
              value: `💠 **${result.priceFragments}** fragment${result.priceFragments > 1 ? "s" : ""}`,
              inline: true,
            }
          )
          .setTimestamp()

        if (result.offeredCard.image) {
          embed.setThumbnail(result.offeredCard.image)
        }

        return interaction.update({
          content: "✅ Vente acceptée.",
          embeds: [embed],
          components: [],
        })
      }
    }
  },
}