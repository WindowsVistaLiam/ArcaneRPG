const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js")

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

async function findOwnedCosmetic(client, userId, cosmeticType, search) {
  const cosmetics = await client.db.collection("player_cosmetics")
    .find({
      userId,
      cosmeticType,
    })
    .toArray()

  const query = normalizeText(search)

  const exact = cosmetics.find((cosmetic) => {
    return (
      normalizeText(cosmetic.cosmeticKey) === query ||
      normalizeText(cosmetic.label) === query
    )
  })

  if (exact) return exact

  return cosmetics.find((cosmetic) => {
    return (
      normalizeText(cosmetic.cosmeticKey).includes(query) ||
      normalizeText(cosmetic.label).includes(query)
    )
  })
}

async function getOwnedCosmetics(client, userId, cosmeticType) {
  return client.db.collection("player_cosmetics")
    .find({
      userId,
      cosmeticType,
    })
    .sort({
      boughtAt: -1,
    })
    .toArray()
}

async function setActiveCosmetic(client, userId, field, value) {
  await client.db.collection("player_profiles").updateOne(
    {
      userId,
    },
    {
      $set: {
        userId,
        [field]: value,
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

async function removeActiveCosmetic(client, userId, type) {
  const unset = {}

  if (type === "titre" || type === "tout") {
    unset.activeTitle = ""
  }

  if (type === "badge" || type === "tout") {
    unset.activeBadge = ""
  }

  await client.db.collection("player_profiles").updateOne(
    {
      userId,
    },
    {
      $unset: unset,
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

function buildCosmeticListEmbed(user, titles, badges) {
  const titleList = titles.length
    ? titles.map((cosmetic) => `🎖️ **${cosmetic.label}** — \`${cosmetic.cosmeticKey}\``).join("\n")
    : "Aucun titre possédé."

  const badgeList = badges.length
    ? badges.map((cosmetic) => `🏷️ **${cosmetic.label}** — \`${cosmetic.cosmeticKey}\``).join("\n")
    : "Aucun badge possédé."

  return new EmbedBuilder()
    .setTitle(`🎖️ Cosmétiques de ${user.username}`)
    .setColor(0xf1c40f)
    .setDescription("Voici les titres et badges que tu peux activer.")
    .addFields(
      {
        name: "🎖️ Titres",
        value: titleList.slice(0, 1024),
        inline: false,
      },
      {
        name: "🏷️ Badges",
        value: badgeList.slice(0, 1024),
        inline: false,
      }
    )
    .setFooter({
      text: "Utilise /cosmetique titre ou /cosmetique badge pour en activer un.",
    })
    .setTimestamp()
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cosmetique")
    .setDescription("Gérer tes titres et badges cosmétiques")

    .addSubcommand((subcommand) =>
      subcommand
        .setName("voir")
        .setDescription("Voir tes cosmétiques disponibles")
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName("titre")
        .setDescription("Choisir ton titre actif")
        .addStringOption((option) =>
          option
            .setName("choix")
            .setDescription("Nom ou ID du titre")
            .setRequired(true)
        )
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName("badge")
        .setDescription("Choisir ton badge actif")
        .addStringOption((option) =>
          option
            .setName("choix")
            .setDescription("Nom ou ID du badge")
            .setRequired(true)
        )
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName("retirer")
        .setDescription("Retirer ton titre, ton badge ou les deux")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("Cosmétique à retirer")
            .setRequired(true)
            .addChoices(
              {
                name: "Titre",
                value: "titre",
              },
              {
                name: "Badge",
                value: "badge",
              },
              {
                name: "Tout",
                value: "tout",
              }
            )
        )
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand()

    if (subcommand === "voir") {
      const titles = await getOwnedCosmetics(client, interaction.user.id, "title")
      const badges = await getOwnedCosmetics(client, interaction.user.id, "badge")

      const embed = buildCosmeticListEmbed(interaction.user, titles, badges)

      return interaction.reply({
        embeds: [embed],
        ephemeral: true,
      })
    }

    if (subcommand === "titre") {
      const search = interaction.options.getString("choix")
      const cosmetic = await findOwnedCosmetic(client, interaction.user.id, "title", search)

      if (!cosmetic) {
        return interaction.reply({
          content:
            `❌ Tu ne possèdes aucun titre correspondant à : **${search}**.\n` +
            "Utilise `/cosmetique voir` pour voir tes titres disponibles.",
          ephemeral: true,
        })
      }

      await setActiveCosmetic(client, interaction.user.id, "activeTitle", cosmetic.label)

      const embed = new EmbedBuilder()
        .setTitle("✅ Titre actif modifié")
        .setColor(0x2ecc71)
        .setDescription(`Ton titre actif est maintenant : 🎖️ **${cosmetic.label}**`)
        .setTimestamp()

      return interaction.reply({
        embeds: [embed],
        ephemeral: true,
      })
    }

    if (subcommand === "badge") {
      const search = interaction.options.getString("choix")
      const cosmetic = await findOwnedCosmetic(client, interaction.user.id, "badge", search)

      if (!cosmetic) {
        return interaction.reply({
          content:
            `❌ Tu ne possèdes aucun badge correspondant à : **${search}**.\n` +
            "Utilise `/cosmetique voir` pour voir tes badges disponibles.",
          ephemeral: true,
        })
      }

      await setActiveCosmetic(client, interaction.user.id, "activeBadge", cosmetic.label)

      const embed = new EmbedBuilder()
        .setTitle("✅ Badge actif modifié")
        .setColor(0x2ecc71)
        .setDescription(`Ton badge actif est maintenant : 🏷️ **${cosmetic.label}**`)
        .setTimestamp()

      return interaction.reply({
        embeds: [embed],
        ephemeral: true,
      })
    }

    if (subcommand === "retirer") {
      const type = interaction.options.getString("type")

      await removeActiveCosmetic(client, interaction.user.id, type)

      return interaction.reply({
        content: "✅ Cosmétique actif retiré.",
        ephemeral: true,
      })
    }
  },
}