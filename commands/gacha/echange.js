const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js")

const { ObjectId } = require("mongodb")
const arcaneCards = require("../../data/arcaneCards")
const { progressQuest } = require("../../utils/quests")

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

function getCardFromCatalog(cardKey) {
  return arcaneCards.find((card) => card.key === cardKey)
}

function getCardDisplayName(card) {
  if (!card) return "Carte inconnue"

  const emoji = RARITY_EMOJIS[card.rarity] || "🎴"

  return `${emoji} ${card.name}`
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

async function getOwnedCardDoc(client, userId, cardKey) {
  return client.db.collection("player_cards").findOne({
    userId,
    cardKey,
  })
}

async function userOwnsCard(client, userId, cardKey) {
  const card = await getOwnedCardDoc(client, userId, cardKey)
  return Boolean(card)
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
}

async function spendFragments(client, userId, amount) {
  const before = await getWalletFragments(client, userId)

  if (before < amount) {
    return {
      success: false,
      before,
      after: before,
      spent: 0,
    }
  }

  const after = before - amount

  await client.db.collection("player_wallets").updateOne(
    {
      userId,
    },
    {
      $set: {
        userId,
        fragments: after,
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
    before,
    after,
    spent: amount,
  }
}

function sanitizePlayerCardDoc(cardDoc, newUserId, source = "exchange") {
  const cloned = {
    ...cardDoc,
    userId: newUserId,
    source,
    exchangedAt: new Date(),
    updatedAt: new Date(),
  }

  delete cloned._id

  return cloned
}

async function moveCard(client, fromUserId, toUserId, cardKey) {
  const cardsCollection = client.db.collection("player_cards")

  const cardDoc = await cardsCollection.findOne({
    userId: fromUserId,
    cardKey,
  })

  if (!cardDoc) {
    return {
      success: false,
      message: "Carte introuvable au moment du transfert.",
    }
  }

  const receiverAlreadyOwns = await cardsCollection.findOne({
    userId: toUserId,
    cardKey,
  })

  if (receiverAlreadyOwns) {
    return {
      success: false,
      message: "Le destinataire possède déjà cette carte.",
    }
  }

  await cardsCollection.deleteOne({
    _id: cardDoc._id,
  })

  await cardsCollection.insertOne(
    sanitizePlayerCardDoc(cardDoc, toUserId)
  )

  return {
    success: true,
  }
}

async function swapCards(client, fromUserId, toUserId, offeredCardKey, requestedCardKey) {
  const cardsCollection = client.db.collection("player_cards")

  const offeredDoc = await cardsCollection.findOne({
    userId: fromUserId,
    cardKey: offeredCardKey,
  })

  const requestedDoc = await cardsCollection.findOne({
    userId: toUserId,
    cardKey: requestedCardKey,
  })

  if (!offeredDoc) {
    return {
      success: false,
      message: "❌ Le joueur qui propose ne possède plus la carte offerte.",
    }
  }

  if (!requestedDoc) {
    return {
      success: false,
      message: "❌ Le joueur défié ne possède plus la carte demandée.",
    }
  }

  const fromAlreadyOwnsRequested = await cardsCollection.findOne({
    userId: fromUserId,
    cardKey: requestedCardKey,
  })

  if (fromAlreadyOwnsRequested) {
    return {
      success: false,
      message: "❌ Le joueur qui propose possède déjà la carte qu'il veut recevoir.",
    }
  }

  const toAlreadyOwnsOffered = await cardsCollection.findOne({
    userId: toUserId,
    cardKey: offeredCardKey,
  })

  if (toAlreadyOwnsOffered) {
    return {
      success: false,
      message: "❌ Le joueur qui accepte possède déjà la carte qu'il doit recevoir.",
    }
  }

  await cardsCollection.deleteOne({
    _id: offeredDoc._id,
  })

  await cardsCollection.deleteOne({
    _id: requestedDoc._id,
  })

  await cardsCollection.insertOne(
    sanitizePlayerCardDoc(offeredDoc, toUserId)
  )

  await cardsCollection.insertOne(
    sanitizePlayerCardDoc(requestedDoc, fromUserId)
  )

  return {
    success: true,
  }
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

function buildCardForCardEmbed({
  interaction,
  targetUser,
  offeredCard,
  requestedCard,
  expiresAt,
}) {
  const embed = new EmbedBuilder()
    .setTitle("🤝 Proposition d'échange")
    .setColor(RARITY_COLORS[offeredCard.rarity] || 0x5865f2)
    .setDescription(
      `${interaction.user} propose un échange à ${targetUser}.\n\n` +
      `⏳ Expire : <t:${Math.floor(expiresAt.getTime() / 1000)}:R>`
    )
    .addFields(
      {
        name: "Carte offerte",
        value:
          `${getCardDisplayName(offeredCard)}\n` +
          `Rareté : **${offeredCard.rarityLabel || offeredCard.rarity}**\n` +
          `ID : \`${offeredCard.key}\``,
        inline: true,
      },
      {
        name: "Carte demandée",
        value:
          `${getCardDisplayName(requestedCard)}\n` +
          `Rareté : **${requestedCard.rarityLabel || requestedCard.rarity}**\n` +
          `ID : \`${requestedCard.key}\``,
        inline: true,
      },
      {
        name: "Validation",
        value: `${targetUser} doit accepter ou refuser avec les boutons ci-dessous.`,
        inline: false,
      }
    )
    .setTimestamp()

  if (offeredCard.image) {
    embed.setThumbnail(offeredCard.image)
  }

  return embed
}

function buildCardForFragmentsEmbed({
  interaction,
  buyerUser,
  card,
  price,
  expiresAt,
}) {
  const embed = new EmbedBuilder()
    .setTitle("💠 Vente de carte")
    .setColor(RARITY_COLORS[card.rarity] || 0x5865f2)
    .setDescription(
      `${interaction.user} propose de vendre une carte à ${buyerUser}.\n\n` +
      `Prix : 💠 **${price}** fragment${price > 1 ? "s" : ""}\n` +
      `⏳ Expire : <t:${Math.floor(expiresAt.getTime() / 1000)}:R>`
    )
    .addFields(
      {
        name: "Carte proposée",
        value:
          `${getCardDisplayName(card)}\n` +
          `Rareté : **${card.rarityLabel || card.rarity}**\n` +
          `ID : \`${card.key}\``,
        inline: false,
      },
      {
        name: "Validation",
        value: `${buyerUser} doit accepter ou refuser avec les boutons ci-dessous.`,
        inline: false,
      }
    )
    .setTimestamp()

  if (card.image) {
    embed.setThumbnail(card.image)
  }

  return embed
}

async function buildCardExchangeSuccessEmbed(client, guild, session) {
  const fromName = await getDisplayName(client, guild, session.fromUserId)
  const toName = await getDisplayName(client, guild, session.toUserId)

  const offeredCard = getCardFromCatalog(session.offeredCardKey)
  const requestedCard = getCardFromCatalog(session.requestedCardKey)

  return new EmbedBuilder()
    .setTitle("✅ Échange terminé")
    .setColor(0x2ecc71)
    .setDescription("Les cartes ont été échangées avec succès.")
    .addFields(
      {
        name: fromName,
        value:
          `Reçoit : ${getCardDisplayName(requestedCard)}\n` +
          `ID : \`${requestedCard?.key || session.requestedCardKey}\``,
        inline: true,
      },
      {
        name: toName,
        value:
          `Reçoit : ${getCardDisplayName(offeredCard)}\n` +
          `ID : \`${offeredCard?.key || session.offeredCardKey}\``,
        inline: true,
      }
    )
    .setTimestamp()
}

async function buildFragmentsExchangeSuccessEmbed(client, guild, session, payment) {
  const sellerName = await getDisplayName(client, guild, session.sellerId)
  const buyerName = await getDisplayName(client, guild, session.buyerId)
  const card = getCardFromCatalog(session.cardKey)

  return new EmbedBuilder()
    .setTitle("✅ Vente terminée")
    .setColor(0x2ecc71)
    .setDescription("La carte a été vendue avec succès.")
    .addFields(
      {
        name: "Vendeur",
        value:
          `**${sellerName}** reçoit 💠 **${session.price}** fragment${session.price > 1 ? "s" : ""}.`,
        inline: false,
      },
      {
        name: "Acheteur",
        value:
          `**${buyerName}** reçoit ${getCardDisplayName(card)}.\n` +
          `Fragments avant : **${payment.before}**\n` +
          `Fragments après : **${payment.after}**`,
        inline: false,
      }
    )
    .setTimestamp()
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("echange")
    .setDescription("Échanger des cartes ou vendre une carte contre des fragments")

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
            .setDescription("Nom ou ID de la carte que tu offres")
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
        .setDescription("Vendre une carte à un joueur contre des fragments")
        .addUserOption((option) =>
          option
            .setName("joueur")
            .setDescription("Joueur qui peut acheter ta carte")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("carte")
            .setDescription("Nom ou ID de la carte que tu vends")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("prix")
            .setDescription("Prix en fragments")
            .setRequired(true)
            .setMinValue(1)
        )
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand()
    const targetUser = interaction.options.getUser("joueur")

    if (targetUser.bot) {
      return interaction.reply({
        content: "❌ Tu ne peux pas échanger avec un bot.",
        ephemeral: true,
      })
    }

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({
        content: "❌ Tu ne peux pas faire un échange avec toi-même.",
        ephemeral: true,
      })
    }

    if (subcommand === "carte") {
      const myCardSearch = interaction.options.getString("ma-carte")
      const targetCardSearch = interaction.options.getString("sa-carte")

      const offeredCard = findCard(myCardSearch)
      const requestedCard = findCard(targetCardSearch)

      if (!offeredCard) {
        return interaction.reply({
          content: `❌ Aucune carte trouvée pour ta carte : **${myCardSearch}**.`,
          ephemeral: true,
        })
      }

      if (!requestedCard) {
        return interaction.reply({
          content: `❌ Aucune carte trouvée pour la carte demandée : **${targetCardSearch}**.`,
          ephemeral: true,
        })
      }

      if (offeredCard.key === requestedCard.key) {
        return interaction.reply({
          content: "❌ Tu ne peux pas échanger une carte contre elle-même.",
          ephemeral: true,
        })
      }

      const ownsOfferedCard = await userOwnsCard(
        client,
        interaction.user.id,
        offeredCard.key
      )

      if (!ownsOfferedCard) {
        return interaction.reply({
          content: `❌ Tu ne possèdes pas cette carte : **${offeredCard.name}**.`,
          ephemeral: true,
        })
      }

      const targetOwnsRequestedCard = await userOwnsCard(
        client,
        targetUser.id,
        requestedCard.key
      )

      if (!targetOwnsRequestedCard) {
        return interaction.reply({
          content: `❌ ${targetUser} ne possède pas cette carte : **${requestedCard.name}**.`,
          ephemeral: true,
        })
      }

      const fromAlreadyOwnsRequested = await userOwnsCard(
        client,
        interaction.user.id,
        requestedCard.key
      )

      if (fromAlreadyOwnsRequested) {
        return interaction.reply({
          content: `❌ Tu possèdes déjà la carte que tu demandes : **${requestedCard.name}**.`,
          ephemeral: true,
        })
      }

      const toAlreadyOwnsOffered = await userOwnsCard(
        client,
        targetUser.id,
        offeredCard.key
      )

      if (toAlreadyOwnsOffered) {
        return interaction.reply({
          content: `❌ ${targetUser} possède déjà la carte que tu offres : **${offeredCard.name}**.`,
          ephemeral: true,
        })
      }

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

      const session = {
        type: "card_for_card",
        fromUserId: interaction.user.id,
        toUserId: targetUser.id,
        offeredCardKey: offeredCard.key,
        requestedCardKey: requestedCard.key,
        status: "pending",
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        createdAt: new Date(),
        expiresAt,
      }

      const result = await client.db.collection("exchange_sessions").insertOne(session)

      const embed = buildCardForCardEmbed({
        interaction,
        targetUser,
        offeredCard,
        requestedCard,
        expiresAt,
      })

      const row = buildExchangeButtons(result.insertedId.toString())

      return interaction.reply({
        content: `${targetUser}, tu as reçu une proposition d'échange.`,
        embeds: [embed],
        components: [row],
      })
    }

    if (subcommand === "fragments") {
      const cardSearch = interaction.options.getString("carte")
      const price = interaction.options.getInteger("prix")

      const card = findCard(cardSearch)

      if (!card) {
        return interaction.reply({
          content: `❌ Aucune carte trouvée pour : **${cardSearch}**.`,
          ephemeral: true,
        })
      }

      const sellerOwnsCard = await userOwnsCard(
        client,
        interaction.user.id,
        card.key
      )

      if (!sellerOwnsCard) {
        return interaction.reply({
          content: `❌ Tu ne possèdes pas cette carte : **${card.name}**.`,
          ephemeral: true,
        })
      }

      const buyerAlreadyOwnsCard = await userOwnsCard(
        client,
        targetUser.id,
        card.key
      )

      if (buyerAlreadyOwnsCard) {
        return interaction.reply({
          content: `❌ ${targetUser} possède déjà cette carte : **${card.name}**.`,
          ephemeral: true,
        })
      }

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

      const session = {
        type: "card_for_fragments",
        sellerId: interaction.user.id,
        buyerId: targetUser.id,
        cardKey: card.key,
        price,
        status: "pending",
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        createdAt: new Date(),
        expiresAt,
      }

      const result = await client.db.collection("exchange_sessions").insertOne(session)

      const embed = buildCardForFragmentsEmbed({
        interaction,
        buyerUser: targetUser,
        card,
        price,
        expiresAt,
      })

      const row = buildExchangeButtons(result.insertedId.toString())

      return interaction.reply({
        content: `${targetUser}, tu as reçu une proposition d'achat.`,
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
        content: "❌ Session d'échange invalide.",
        ephemeral: true,
      })
    }

    const sessions = client.db.collection("exchange_sessions")

    const session = await sessions.findOne({
      _id: new ObjectId(sessionId),
    })

    if (!session) {
      return interaction.reply({
        content: "❌ Cet échange n'existe plus.",
        ephemeral: true,
      })
    }

    if (session.status !== "pending") {
      return interaction.reply({
        content: "❌ Cet échange a déjà été traité.",
        ephemeral: true,
      })
    }

    const targetUserId = session.type === "card_for_card"
      ? session.toUserId
      : session.buyerId

    if (interaction.user.id !== targetUserId) {
      return interaction.reply({
        content: "❌ Seul le joueur concerné peut répondre à cette proposition.",
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
        content: "❌ Proposition d'échange refusée.",
        embeds: [],
        components: [],
      })
    }

    if (action === "accept") {
      if (session.type === "card_for_card") {
        const swapResult = await swapCards(
          client,
          session.fromUserId,
          session.toUserId,
          session.offeredCardKey,
          session.requestedCardKey
        )

        if (!swapResult.success) {
          await sessions.updateOne(
            {
              _id: new ObjectId(sessionId),
            },
            {
              $set: {
                status: "cancelled",
                cancelReason: swapResult.message,
                updatedAt: new Date(),
              },
            }
          )

          return interaction.update({
            content: swapResult.message,
            embeds: [],
            components: [],
          })
        }

        await progressQuest(client, session.fromUserId, "exchange").catch(console.error)
        await progressQuest(client, session.toUserId, "exchange").catch(console.error)

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

        const embed = await buildCardExchangeSuccessEmbed(
          client,
          interaction.guild,
          session
        )

        return interaction.update({
          content: "✅ Échange accepté.",
          embeds: [embed],
          components: [],
        })
      }

      if (session.type === "card_for_fragments") {
        const sellerOwnsCard = await userOwnsCard(
          client,
          session.sellerId,
          session.cardKey
        )

        if (!sellerOwnsCard) {
          await sessions.updateOne(
            {
              _id: new ObjectId(sessionId),
            },
            {
              $set: {
                status: "cancelled",
                cancelReason: "seller_missing_card",
                updatedAt: new Date(),
              },
            }
          )

          return interaction.update({
            content: "❌ Le vendeur ne possède plus cette carte. Vente annulée.",
            embeds: [],
            components: [],
          })
        }

        const buyerAlreadyOwnsCard = await userOwnsCard(
          client,
          session.buyerId,
          session.cardKey
        )

        if (buyerAlreadyOwnsCard) {
          await sessions.updateOne(
            {
              _id: new ObjectId(sessionId),
            },
            {
              $set: {
                status: "cancelled",
                cancelReason: "buyer_already_owns_card",
                updatedAt: new Date(),
              },
            }
          )

          return interaction.update({
            content: "❌ L'acheteur possède déjà cette carte. Vente annulée.",
            embeds: [],
            components: [],
          })
        }

        const payment = await spendFragments(
          client,
          session.buyerId,
          session.price
        )

        if (!payment.success) {
          return interaction.reply({
            content:
              `❌ Tu n'as pas assez de fragments pour accepter cette vente.\n` +
              `Prix : **${session.price}**\n` +
              `Tes fragments : **${payment.before}**`,
            ephemeral: true,
          })
        }

        const moveResult = await moveCard(
          client,
          session.sellerId,
          session.buyerId,
          session.cardKey
        )

        if (!moveResult.success) {
          await addFragments(client, session.buyerId, session.price)

          await sessions.updateOne(
            {
              _id: new ObjectId(sessionId),
            },
            {
              $set: {
                status: "cancelled",
                cancelReason: moveResult.message,
                updatedAt: new Date(),
              },
            }
          )

          return interaction.update({
            content: `❌ ${moveResult.message} Les fragments ont été remboursés.`,
            embeds: [],
            components: [],
          })
        }

        await addFragments(client, session.sellerId, session.price)

        await progressQuest(client, session.sellerId, "exchange").catch(console.error)
        await progressQuest(client, session.buyerId, "exchange").catch(console.error)

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

        const embed = await buildFragmentsExchangeSuccessEmbed(
          client,
          interaction.guild,
          session,
          payment
        )

        return interaction.update({
          content: "✅ Vente acceptée.",
          embeds: [embed],
          components: [],
        })
      }
    }
  },
}