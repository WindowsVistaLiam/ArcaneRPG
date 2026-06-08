const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js")

const arcaneCards = require("../data/arcaneCards")

const PAGE_SIZE = 10

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

function normalizeText(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function findCard(search) {
  const query = normalizeText(search)

  return arcaneCards.find((card) => {
    return (
      normalizeText(card.key).includes(query) ||
      normalizeText(card.name).includes(query) ||
      normalizeText(card.characterName || "").includes(query) ||
      normalizeText(card.characterKey || "").includes(query)
    )
  })
}

function sortCards(cards) {
  return [...cards].sort((a, b) => {
    const rarityDiff = (RARITY_ORDER[a.rarity] || 99) - (RARITY_ORDER[b.rarity] || 99)

    if (rarityDiff !== 0) {
      return rarityDiff
    }

    return a.name.localeCompare(b.name)
  })
}

async function addPoints(client, userId, amount) {
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

async function removePoints(client, userId, amount) {
  const wallet = await client.db.collection("player_wallets").findOne({
    userId,
  })

  const currentFragments = wallet?.fragments || 0
  const newFragments = Math.max(0, currentFragments - amount)

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
    removed: currentFragments - newFragments,
  }
}

function buildAdminCatalogueEmbed(page = 0) {
  const cards = sortCards(arcaneCards)
  const totalPages = Math.max(1, Math.ceil(cards.length / PAGE_SIZE))
  const safePage = Math.min(Math.max(page, 0), totalPages - 1)

  const start = safePage * PAGE_SIZE
  const pageCards = cards.slice(start, start + PAGE_SIZE)

  const description = pageCards
    .map((card, index) => {
      const number = start + index + 1
      const emoji = RARITY_EMOJIS[card.rarity] || "⚪"

      return [
        `**${number}. ${emoji} ${card.name}**`,
        `ID : \`${card.key}\``,
        `Rareté : **${card.rarityLabel || card.rarity}** — Valeur : **${card.value || 0} pts**`,
      ].join("\n")
    })
    .join("\n\n")

  const embed = new EmbedBuilder()
    .setTitle("🛠️ Catalogue complet des cartes")
    .setColor(0x5865f2)
    .setDescription(description || "Aucune carte dans le catalogue.")
    .addFields(
      {
        name: "Total cartes",
        value: `${cards.length}`,
        inline: true,
      },
      {
        name: "Page",
        value: `${safePage + 1}/${totalPages}`,
        inline: true,
      }
    )
    .setFooter({
      text: "Utilise l'ID exact pour ajouter ou supprimer une carte.",
    })
    .setTimestamp()

  return {
    embed,
    page: safePage,
    totalPages,
  }
}

async function buildAdminPlayerCollectionEmbed(client, user, page = 0) {
  const playerCards = await client.db.collection("player_cards")
    .find({
      userId: user.id,
    })
    .toArray()

  const wallet = await client.db.collection("player_wallets").findOne({
    userId: user.id,
  })

  const fragments = wallet?.fragments || 0

  if (!playerCards.length) {
    const embed = new EmbedBuilder()
      .setTitle(`🛠️ Collection admin de ${user.username}`)
      .setColor(0xe67e22)
      .setDescription("Ce joueur ne possède aucune carte.")
      .addFields({
        name: "Points / fragments",
        value: `💠 ${fragments}`,
        inline: true,
      })
      .setTimestamp()

    return {
      embed,
      page: 0,
      totalPages: 1,
    }
  }

  const grouped = new Map()

  for (const playerCard of playerCards) {
    const catalogCard = arcaneCards.find((card) => card.key === playerCard.cardKey)

    const cardData = catalogCard || {
      key: playerCard.cardKey,
      name: playerCard.cardName || playerCard.cardKey,
      rarity: playerCard.rarity || "common",
      rarityLabel: playerCard.rarityLabel || "Commun",
      value: playerCard.value || 0,
    }

    if (!grouped.has(cardData.key)) {
      grouped.set(cardData.key, {
        card: cardData,
        count: 0,
      })
    }

    grouped.get(cardData.key).count += 1
  }

  const groupedCards = Array.from(grouped.values()).sort((a, b) => {
    const rarityDiff =
      (RARITY_ORDER[a.card.rarity] || 99) - (RARITY_ORDER[b.card.rarity] || 99)

    if (rarityDiff !== 0) {
      return rarityDiff
    }

    return a.card.name.localeCompare(b.card.name)
  })

  const totalPages = Math.max(1, Math.ceil(groupedCards.length / PAGE_SIZE))
  const safePage = Math.min(Math.max(page, 0), totalPages - 1)

  const start = safePage * PAGE_SIZE
  const pageCards = groupedCards.slice(start, start + PAGE_SIZE)

  const totalCards = playerCards.length
  const uniqueCards = groupedCards.length
  const totalValue = playerCards.reduce((sum, card) => sum + (card.value || 0), 0)

  const description = pageCards
    .map((entry, index) => {
      const number = start + index + 1
      const card = entry.card
      const emoji = RARITY_EMOJIS[card.rarity] || "⚪"
      const countText = entry.count > 1 ? ` x${entry.count}` : ""

      return [
        `**${number}. ${emoji} ${card.name}${countText}**`,
        `ID : \`${card.key}\``,
        `Rareté : **${card.rarityLabel || card.rarity}** — Valeur : **${card.value || 0} pts**`,
      ].join("\n")
    })
    .join("\n\n")

  const embed = new EmbedBuilder()
    .setTitle(`🛠️ Collection admin de ${user.username}`)
    .setColor(0xe67e22)
    .setDescription(description || "Aucune carte à afficher.")
    .addFields(
      {
        name: "Total cartes",
        value: `🎴 ${totalCards}`,
        inline: true,
      },
      {
        name: "Cartes uniques",
        value: `📘 ${uniqueCards}`,
        inline: true,
      },
      {
        name: "Valeur totale",
        value: `⭐ ${totalValue} pts`,
        inline: true,
      },
      {
        name: "Points / fragments",
        value: `💠 ${fragments}`,
        inline: true,
      },
      {
        name: "Page",
        value: `${safePage + 1}/${totalPages}`,
        inline: true,
      }
    )
    .setFooter({
      text: "Utilise l'ID exact pour supprimer une carte.",
    })
    .setTimestamp()

  return {
    embed,
    page: safePage,
    totalPages,
  }
}

function buildAdminButtons(type, page, totalPages, userId = "none") {
  const previous = new ButtonBuilder()
    .setCustomId(`admincollection:${type}:prev:${page}:${userId}`)
    .setLabel("⬅️")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page <= 0)

  const next = new ButtonBuilder()
    .setCustomId(`admincollection:${type}:next:${page}:${userId}`)
    .setLabel("➡️")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(page >= totalPages - 1)

  return new ActionRowBuilder().addComponents(previous, next)
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("admincollection")
    .setDescription("Gérer les cartes et points d'un joueur")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    .addSubcommand((subcommand) =>
      subcommand
        .setName("voir-cartes")
        .setDescription("Voir toutes les cartes disponibles dans le bot")
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName("voir-joueur")
        .setDescription("Voir les cartes et points d'un joueur")
        .addUserOption((option) =>
          option
            .setName("utilisateur")
            .setDescription("Joueur à inspecter")
            .setRequired(true)
        )
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName("ajouter-carte")
        .setDescription("Ajouter une carte à l'inventaire d'un joueur")
        .addUserOption((option) =>
          option
            .setName("utilisateur")
            .setDescription("Joueur concerné")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("carte")
            .setDescription("Nom ou ID de la carte")
            .setRequired(true)
        )
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName("supprimer-carte")
        .setDescription("Supprimer une carte de l'inventaire d'un joueur")
        .addUserOption((option) =>
          option
            .setName("utilisateur")
            .setDescription("Joueur concerné")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("carte")
            .setDescription("Nom ou ID de la carte")
            .setRequired(true)
        )
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName("ajouter-points")
        .setDescription("Ajouter des points/fragments à un joueur")
        .addUserOption((option) =>
          option
            .setName("utilisateur")
            .setDescription("Joueur concerné")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("montant")
            .setDescription("Nombre de points à ajouter")
            .setRequired(true)
            .setMinValue(1)
        )
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName("retirer-points")
        .setDescription("Retirer des points/fragments à un joueur")
        .addUserOption((option) =>
          option
            .setName("utilisateur")
            .setDescription("Joueur concerné")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("montant")
            .setDescription("Nombre de points à retirer")
            .setRequired(true)
            .setMinValue(1)
        )
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand()

    if (subcommand === "voir-cartes") {
      const result = buildAdminCatalogueEmbed(0)
      const row = buildAdminButtons("catalogue", result.page, result.totalPages)

      return interaction.reply({
        embeds: [result.embed],
        components: [row],
        ephemeral: true,
      })
    }

    if (subcommand === "voir-joueur") {
      const user = interaction.options.getUser("utilisateur")

      const result = await buildAdminPlayerCollectionEmbed(client, user, 0)
      const row = buildAdminButtons("joueur", result.page, result.totalPages, user.id)

      return interaction.reply({
        embeds: [result.embed],
        components: [row],
        ephemeral: true,
      })
    }

    if (subcommand === "ajouter-carte") {
      const user = interaction.options.getUser("utilisateur")
      const search = interaction.options.getString("carte")
      const card = findCard(search)

      if (!card) {
        return interaction.reply({
          content: `❌ Aucune carte trouvée pour : **${search}**.`,
          ephemeral: true,
        })
      }

      const existingCard = await client.db.collection("player_cards").findOne({
        userId: user.id,
        cardKey: card.key,
      })

      if (existingCard) {
        return interaction.reply({
          content: `❌ ${user} possède déjà **${card.name}**. Si tu veux compenser, utilise plutôt \`/admincollection ajouter-points\`.`,
          ephemeral: true,
        })
      }

      await client.db.collection("player_cards").insertOne({
        userId: user.id,
        cardKey: card.key,
        cardName: card.name,
        rarity: card.rarity,
        rarityLabel: card.rarityLabel,
        value: card.value,
        image: card.image,
        description: card.description || "",
        source: "admin",
        addedBy: interaction.user.id,
        claimedAt: new Date(),
        favorite: false,
        locked: false,
      })

      const embed = new EmbedBuilder()
        .setTitle("✅ Carte ajoutée")
        .setColor(0x2ecc71)
        .setDescription(`La carte **${card.name}** a été ajoutée à l'inventaire de ${user}.`)
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
            name: "Valeur",
            value: `${card.value || 0} pts`,
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

    if (subcommand === "supprimer-carte") {
      const user = interaction.options.getUser("utilisateur")
      const search = interaction.options.getString("carte")
      const card = findCard(search)

      if (!card) {
        return interaction.reply({
          content: `❌ Aucune carte trouvée pour : **${search}**.`,
          ephemeral: true,
        })
      }

      const result = await client.db.collection("player_cards").deleteOne({
        userId: user.id,
        cardKey: card.key,
      })

      if (result.deletedCount === 0) {
        return interaction.reply({
          content: `❌ ${user} ne possède pas **${card.name}**.`,
          ephemeral: true,
        })
      }

      return interaction.reply({
        content: `✅ Carte supprimée de l'inventaire de ${user} : **${card.name}**.\nID : \`${card.key}\``,
        ephemeral: true,
      })
    }

    if (subcommand === "ajouter-points") {
      const user = interaction.options.getUser("utilisateur")
      const amount = interaction.options.getInteger("montant")

      await addPoints(client, user.id, amount)

      return interaction.reply({
        content: `✅ **${amount}** point${amount > 1 ? "s" : ""}/fragment${amount > 1 ? "s" : ""} ajouté${amount > 1 ? "s" : ""} à ${user}.`,
        ephemeral: true,
      })
    }

    if (subcommand === "retirer-points") {
      const user = interaction.options.getUser("utilisateur")
      const amount = interaction.options.getInteger("montant")

      const result = await removePoints(client, user.id, amount)

      return interaction.reply({
        content:
          `✅ Points/fragments retirés à ${user}.\n` +
          `Avant : **${result.before}**\n` +
          `Retiré : **${result.removed}**\n` +
          `Maintenant : **${result.after}**`,
        ephemeral: true,
      })
    }
  },

  async handleButton(interaction, client) {
    if (!interaction.customId.startsWith("admincollection:")) return

    const parts = interaction.customId.split(":")
    const type = parts[1]
    const action = parts[2]
    const currentPage = Number(parts[3]) || 0
    const userId = parts[4]

    let newPage = currentPage

    if (action === "prev") {
      newPage = currentPage - 1
    }

    if (action === "next") {
      newPage = currentPage + 1
    }

    if (type === "catalogue") {
      const result = buildAdminCatalogueEmbed(newPage)
      const row = buildAdminButtons("catalogue", result.page, result.totalPages)

      return interaction.update({
        embeds: [result.embed],
        components: [row],
      })
    }

    if (type === "joueur") {
      const user = await client.users.fetch(userId).catch(() => null)

      if (!user) {
        return interaction.reply({
          content: "❌ Utilisateur introuvable.",
          ephemeral: true,
        })
      }

      const result = await buildAdminPlayerCollectionEmbed(client, user, newPage)
      const row = buildAdminButtons("joueur", result.page, result.totalPages, user.id)

      return interaction.update({
        embeds: [result.embed],
        components: [row],
      })
    }
  },
}