const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js")

const {
  QUEST_TIMEZONE,
  ensureDailyQuests,
  claimAllCompletedQuests,
  formatReward,
} = require("../../utils/quests")

function getProgressBar(progress, target) {
  const totalBlocks = 10
  const ratio = target > 0 ? Math.min(1, progress / target) : 0
  const filled = Math.round(ratio * totalBlocks)

  return "▰".repeat(filled) + "▱".repeat(totalBlocks - filled)
}

function getQuestStatusEmoji(quest) {
  if (quest.claimed) return "✅"
  if ((quest.progress || 0) >= (quest.target || 1)) return "🎁"
  return "⏳"
}

function getCompletedUnclaimedCount(quests) {
  return quests.filter((quest) => {
    return !quest.claimed && (quest.progress || 0) >= (quest.target || 1)
  }).length
}

function buildQuestsEmbed(user, dailyQuests, claimResult = null) {
  const quests = dailyQuests.quests || []

  const completed = quests.filter((quest) => {
    return (quest.progress || 0) >= (quest.target || 1)
  }).length

  const claimed = quests.filter((quest) => quest.claimed).length

  const embed = new EmbedBuilder()
    .setTitle(`📜 Quêtes quotidiennes — ${user.username}`)
    .setColor(0x5865f2)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .setDescription(
      `Date : **${dailyQuests.dateKey}**\n` +
      `Fuseau : **${QUEST_TIMEZONE}**\n\n` +
      `Progression : **${completed}/${quests.length}** terminée(s)\n` +
      `Réclamées : **${claimed}/${quests.length}**`
    )
    .setFooter({
      text: "Les quêtes changent chaque jour. Certaines progressent automatiquement.",
    })
    .setTimestamp()

  for (const quest of quests) {
    const progress = quest.progress || 0
    const target = quest.target || 1
    const statusEmoji = getQuestStatusEmoji(quest)

    embed.addFields({
      name: `${statusEmoji} ${quest.label}`,
      value:
        `${quest.description}\n` +
        `${getProgressBar(progress, target)} **${progress}/${target}**\n` +
        `Récompense : ${formatReward(quest.reward || {})}\n` +
        `Statut : **${quest.claimed ? "Réclamée" : progress >= target ? "À réclamer" : "En cours"}**`,
      inline: false,
    })
  }

  if (claimResult?.success) {
    embed.addFields({
      name: "🎁 Récompenses récupérées",
      value:
        `Quêtes réclamées : **${claimResult.claimedQuests.length}**\n` +
        `Gain : ${formatReward(claimResult.reward)}`,
      inline: false,
    })
  }

  if (claimResult && !claimResult.success) {
    embed.addFields({
      name: "ℹ️ Réclamation",
      value: claimResult.message,
      inline: false,
    })
  }

  return embed
}

function buildQuestButtons(userId, dailyQuests) {
  const completedUnclaimed = getCompletedUnclaimedCount(dailyQuests.quests || [])

  const claimButton = new ButtonBuilder()
    .setCustomId(`quetes:claimall:${userId}`)
    .setLabel("🎁 Réclamer")
    .setStyle(ButtonStyle.Success)
    .setDisabled(completedUnclaimed <= 0)

  const refreshButton = new ButtonBuilder()
    .setCustomId(`quetes:refresh:${userId}`)
    .setLabel("🔄 Actualiser")
    .setStyle(ButtonStyle.Secondary)

  return new ActionRowBuilder().addComponents(claimButton, refreshButton)
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("quetes")
    .setDescription("Voir et réclamer tes quêtes quotidiennes"),

  async execute(interaction, client) {
    const dailyQuests = await ensureDailyQuests(client, interaction.user.id)

    const embed = buildQuestsEmbed(interaction.user, dailyQuests)
    const row = buildQuestButtons(interaction.user.id, dailyQuests)

    return interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    })
  },

  async handleButton(interaction, client) {
    if (!interaction.customId.startsWith("quetes:")) return

    const parts = interaction.customId.split(":")
    const action = parts[1]
    const userId = parts[2]

    if (interaction.user.id !== userId) {
      return interaction.reply({
        content: "❌ Tu ne peux pas utiliser les quêtes d'un autre joueur.",
        ephemeral: true,
      })
    }

    if (action === "refresh") {
      const dailyQuests = await ensureDailyQuests(client, interaction.user.id)

      const embed = buildQuestsEmbed(interaction.user, dailyQuests)
      const row = buildQuestButtons(interaction.user.id, dailyQuests)

      return interaction.update({
        embeds: [embed],
        components: [row],
      })
    }

    if (action === "claimall") {
      const claimResult = await claimAllCompletedQuests(
        client,
        interaction.user.id
      )

      const dailyQuests = await ensureDailyQuests(client, interaction.user.id)

      const embed = buildQuestsEmbed(interaction.user, dailyQuests, claimResult)
      const row = buildQuestButtons(interaction.user.id, dailyQuests)

      return interaction.update({
        embeds: [embed],
        components: [row],
      })
    }
  },
}