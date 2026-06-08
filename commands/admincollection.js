const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js")

const arcaneCards = require("../data/arcaneCards")

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

module.exports = {
  data: new SlashCommandBuilder()
    .setName("admincollection")
    .setDescription("Gérer les cartes et points d'un joueur")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

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
    const user = interaction.options.getUser("utilisateur")

    if (subcommand === "ajouter-carte") {
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
        content: `✅ Carte supprimée de l'inventaire de ${user} : **${card.name}**.`,
        ephemeral: true,
      })
    }

    if (subcommand === "ajouter-points") {
      const amount = interaction.options.getInteger("montant")

      await addPoints(client, user.id, amount)

      return interaction.reply({
        content: `✅ **${amount}** point${amount > 1 ? "s" : ""}/fragment${amount > 1 ? "s" : ""} ajouté${amount > 1 ? "s" : ""} à ${user}.`,
        ephemeral: true,
      })
    }

    if (subcommand === "retirer-points") {
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
}