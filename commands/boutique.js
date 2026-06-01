const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js")

const arcaneCards = require("../data/arcaneCards")

const RARITY_COLORS = {
  common: 0x95a5a6,
  rare: 0x3498db,
  epic: 0x9b59b6,
  legendary: 0xf1c40f,
  mythic: 0xe74c3c,
}

const SHOP_ITEMS = {
  common_pack: {
    label: "Pack Commun+",
    price: 25,
    description: "Une carte aléatoire de n'importe quelle rareté.",
    allowedRarities: ["common", "rare", "epic", "legendary", "mythic"],
  },
  rare_pack: {
    label: "Pack Rare+",
    price: 100,
    description: "Une carte rare ou mieux.",
    allowedRarities: ["rare", "epic", "legendary", "mythic"],
  },
  epic_pack: {
    label: "Pack Épique+",
    price: 300,
    description: "Une carte épique ou mieux.",
    allowedRarities: ["epic", "legendary", "mythic"],
  },
  legendary_pack: {
    label: "Pack Légendaire+",
    price: 900,
    description: "Une carte légendaire ou mythique.",
    allowedRarities: ["legendary", "mythic"],
  },
  mythic_pack: {
    label: "Pack Mythique",
    price: 2500,
    description: "Une carte mythique garantie.",
    allowedRarities: ["mythic"],
  },
}

const RARITY_WEIGHTS = {
  common: 55,
  rare: 25,
  epic: 12,
  legendary: 6,
  mythic: 2,
}

async function getWallet(client, userId) {
  const wallet = await client.db.collection("player_wallets").findOne({ userId })

  return {
    fragments: wallet?.fragments || 0,
  }
}

function pickCardByRarities(allowedRarities) {
  const possibleCards = arcaneCards.filter((card) =>
    allowedRarities.includes(card.rarity)
  )

  const weightedCards = []

  for (const card of possibleCards) {
    const weight = RARITY_WEIGHTS[card.rarity] || 1

    for (let i = 0; i < weight; i++) {
      weightedCards.push(card)
    }
  }

  return weightedCards[Math.floor(Math.random() * weightedCards.length)]
}

function buildShopEmbed(wallet) {
  const embed = new EmbedBuilder()
    .setTitle("🛒 Boutique Arcane")
    .setColor(0x2ecc71)
    .setDescription("Dépense tes fragments pour obtenir des cartes supplémentaires.")
    .addFields({
      name: "Tes fragments",
      value: `💠 ${wallet.fragments}`,
      inline: false,
    })
    .setFooter({
      text: "Les fragments s'obtiennent en recyclant des doublons.",
    })
    .setTimestamp()

  for (const item of Object.values(SHOP_ITEMS)) {
    embed.addFields({
      name: `${item.label} — 💠 ${item.price}`,
      value: item.description,
      inline: false,
    })
  }

  return embed
}

function buildShopButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("boutique:buy:common_pack")
        .setLabel("Commun+")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("boutique:buy:rare_pack")
        .setLabel("Rare+")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("boutique:buy:epic_pack")
        .setLabel("Épique+")
        .setStyle(ButtonStyle.Primary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("boutique:buy:legendary_pack")
        .setLabel("Légendaire+")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("boutique:buy:mythic_pack")
        .setLabel("Mythique")
        .setStyle(ButtonStyle.Danger)
    ),
  ]
}

function buildCardEmbed(card, item) {
  const embed = new EmbedBuilder()
    .setTitle(`🎁 ${item.label}`)
    .setColor(RARITY_COLORS[card.rarity] || 0x5865f2)
    .setDescription(`Tu as obtenu : **${card.name}**`)
    .addFields(
      {
        name: "Rareté",
        value: card.rarityLabel || card.rarity,
        inline: true,
      },
      {
        name: "Valeur",
        value: `⭐ ${card.value || 0} pts`,
        inline: true,
      },
      {
        name: "Faction",
        value: card.faction || "Inconnue",
        inline: true,
      }
    )
    .setFooter({
      text: "Carte ajoutée à ta collection.",
    })
    .setTimestamp()

  if (card.description) {
    embed.addFields({
      name: "Description",
      value: card.description.slice(0, 1024),
      inline: false,
    })
  }

  if (card.image) {
    embed.setImage(card.image)
  }

  return embed
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("boutique")
    .setDescription("Ouvrir la boutique Arcane"),

  async execute(interaction, client) {
    const wallet = await getWallet(client, interaction.user.id)

    return interaction.reply({
      embeds: [buildShopEmbed(wallet)],
      components: buildShopButtons(),
      ephemeral: true,
    })
  },

  async handleButton(interaction, client) {
    if (!interaction.customId.startsWith("boutique:buy:")) return

    const itemKey = interaction.customId.replace("boutique:buy:", "")
    const item = SHOP_ITEMS[itemKey]

    if (!item) {
      return interaction.reply({
        content: "❌ Article introuvable.",
        ephemeral: true,
      })
    }

    const wallet = await getWallet(client, interaction.user.id)

    if (wallet.fragments < item.price) {
      return interaction.reply({
        content: `❌ Tu n'as pas assez de fragments. Il te faut 💠 ${item.price}, tu as 💠 ${wallet.fragments}.`,
        ephemeral: true,
      })
    }

    const card = pickCardByRarities(item.allowedRarities)

    if (!card) {
      return interaction.reply({
        content: "❌ Aucune carte disponible pour ce pack.",
        ephemeral: true,
      })
    }

    await client.db.collection("player_wallets").updateOne(
      {
        userId: interaction.user.id,
      },
      {
        $inc: {
          fragments: -item.price,
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

    await client.db.collection("player_cards").insertOne({
      userId: interaction.user.id,
      cardKey: card.key,
      cardName: card.name,
      rarity: card.rarity,
      rarityLabel: card.rarityLabel,
      value: card.value,
      image: card.image,
      description: card.description || "",
      source: "boutique",
      shopItem: itemKey,
      claimedAt: new Date(),
      favorite: false,
      locked: false,
    })

    const newWallet = await getWallet(client, interaction.user.id)

    return interaction.update({
      embeds: [
        buildCardEmbed(card, item),
        buildShopEmbed(newWallet),
      ],
      components: buildShopButtons(),
    })
  },
}