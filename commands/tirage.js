const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js")

const arcaneCards = require("../data/arcaneCards")

const RARITY_WEIGHTS = {
  common: 55,
  rare: 25,
  epic: 12,
  legendary: 6,
  mythic: 2
}

const RARITY_COLORS = {
  common: 0x95a5a6,
  rare: 0x3498db,
  epic: 0x9b59b6,
  legendary: 0xf1c40f,
  mythic: 0xe74c3c
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

function buildCardEmbed(card) {
  const embed = new EmbedBuilder()
    .setTitle(`🎴 ${card.name}`)
    .setDescription(card.description || "Carte Arcane")
    .setColor(RARITY_COLORS[card.rarity] || 0x5865f2)
    .addFields(
      {
        name: "Rareté",
        value: card.rarityLabel || card.rarity,
        inline: true
      },
      {
        name: "Valeur",
        value: `${card.value} pts`,
        inline: true
      }
    )
    .setFooter({ text: "Mini-jeu de collection Arcane" })
    .setTimestamp()

  if (card.image) {
    embed.setImage(card.image)
  }

  return embed
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("tirage")
    .setDescription("Faire un tirage de carte Arcane"),

  async execute(interaction, client) {
    const card = pickRandomCard()

    const alreadyOwned = await client.db.collection("player_cards").findOne({
      userId: interaction.user.id,
      cardKey: card.key
    })

    const embed = buildCardEmbed(card)

    const claimButton = new ButtonBuilder()
      .setCustomId(`tirage:claim:${card.key}`)
      .setLabel(alreadyOwned ? "Déjà possédée" : "Claim")
      .setStyle(alreadyOwned ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(Boolean(alreadyOwned))

    const row = new ActionRowBuilder().addComponents(claimButton)

    return interaction.reply({
      embeds: [embed],
      components: [row]
    })
  },

  async handleButton(interaction, client) {
    if (!interaction.customId.startsWith("tirage:claim:")) return

    const cardKey = interaction.customId.replace("tirage:claim:", "")
    const card = arcaneCards.find((c) => c.key === cardKey)

    if (!card) {
      return interaction.reply({
        content: "❌ Carte introuvable dans le catalogue.",
        ephemeral: true
      })
    }

    const existingCard = await client.db.collection("player_cards").findOne({
      userId: interaction.user.id,
      cardKey: card.key
    })

    if (existingCard) {
      return interaction.reply({
        content: "❌ Tu possèdes déjà cette carte.",
        ephemeral: true
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
      claimedAt: new Date(),
      favorite: false,
      locked: false
    })

    const disabledButton = new ButtonBuilder()
      .setCustomId(`tirage:claimed:${card.key}`)
      .setLabel("Claimed")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)

    const row = new ActionRowBuilder().addComponents(disabledButton)

    await interaction.update({
      components: [row]
    })

    return interaction.followUp({
      content: `✅ Tu as ajouté **${card.name}** à ta collection !`,
      ephemeral: true
    })
  }
}