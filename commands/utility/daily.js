const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js")

const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000

const DAILY_TYPES = {
  expedition: {
    label: "Expédition",
    emoji: "🧭",
  },
  enquete: {
    label: "Enquête",
    emoji: "🔎",
  },
  braquage: {
    label: "Braquage",
    emoji: "💰",
  },
}

const EXPEDITION_EVENTS = [
  {
    title: "Les bas-fonds de Zaun",
    description: "Tu explores une ruelle abandonnée et trouves une petite cache de fragments.",
    minReward: 25,
    maxReward: 55,
  },
  {
    title: "Patrouille près de Piltover",
    description: "Tu évites les Enforcers et récupères quelques ressources oubliées.",
    minReward: 20,
    maxReward: 50,
  },
  {
    title: "Territoire Firelight",
    description: "Tu aides un groupe local et reçois une récompense discrète.",
    minReward: 35,
    maxReward: 70,
  },
  {
    title: "Ancien laboratoire Hextech",
    description: "Tu fouilles un laboratoire en ruine et trouves un fragment instable.",
    minReward: 45,
    maxReward: 90,
  },
]

const ENQUETE_EVENTS = [
  {
    title: "Cristal disparu",
    description: "Un cristal Hextech a disparu. Ton enquête révèle une piste crédible.",
    minReward: 30,
    maxReward: 65,
  },
  {
    title: "Rumeur de Zaun",
    description: "Tu remontes une rumeur jusqu’à sa source et récupères des informations utiles.",
    minReward: 25,
    maxReward: 60,
  },
  {
    title: "Affaire classée",
    description: "Un vieux dossier refait surface. Tu découvres un détail oublié.",
    minReward: 35,
    maxReward: 75,
  },
  {
    title: "Trafic de Shimmer",
    description: "Tu suis une piste dangereuse liée au Shimmer et obtiens une belle récompense.",
    minReward: 45,
    maxReward: 95,
  },
]

const BRAQUAGE_EVENTS = [
  {
    title: "Convoi Hextech",
    description: "Tu attaques un petit convoi. L’opération est risquée, mais rentable.",
    minReward: 50,
    maxReward: 120,
    failChance: 35,
    failPenalty: 20,
  },
  {
    title: "Entrepôt de Zaun",
    description: "Tu t’introduis dans un entrepôt mal gardé.",
    minReward: 40,
    maxReward: 100,
    failChance: 30,
    failPenalty: 15,
  },
  {
    title: "Caisse des Chem-Barons",
    description: "Tu tentes de voler une caisse appartenant aux Chem-Barons.",
    minReward: 70,
    maxReward: 150,
    failChance: 45,
    failPenalty: 30,
  },
  {
    title: "Marchandise interdite",
    description: "Tu récupères une cargaison suspecte avant qu’elle ne disparaisse.",
    minReward: 60,
    maxReward: 130,
    failChance: 40,
    failPenalty: 25,
  },
]

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)]
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

async function getWallet(client, userId) {
  const wallet = await client.db.collection("player_wallets").findOne({
    userId,
  })

  return {
    fragments: wallet?.fragments || 0,
  }
}

async function addFragments(client, userId, amount) {
  const beforeWallet = await getWallet(client, userId)
  const now = new Date()

  const result = await client.db.collection("player_wallets").findOneAndUpdate(
    {
      userId,
    },
    {
      $setOnInsert: {
        userId,
        createdAt: now,
      },
      $inc: {
        fragments: amount,
      },
      $set: {
        updatedAt: now,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  )

  const after = result?.fragments ?? result?.value?.fragments ?? beforeWallet.fragments + amount

  return {
    before: beforeWallet.fragments,
    added: amount,
    after,
  }
}

async function removeFragments(client, userId, amount) {
  const beforeWallet = await getWallet(client, userId)
  const removable = Math.min(beforeWallet.fragments, amount)
  const now = new Date()

  if (removable <= 0) {
    return {
      before: beforeWallet.fragments,
      removed: 0,
      after: beforeWallet.fragments,
    }
  }

  const result = await client.db.collection("player_wallets").findOneAndUpdate(
    {
      userId,
    },
    {
      $setOnInsert: {
        userId,
        createdAt: now,
      },
      $inc: {
        fragments: -removable,
      },
      $set: {
        updatedAt: now,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  )

  const after = result?.fragments ?? result?.value?.fragments ?? beforeWallet.fragments - removable

  return {
    before: beforeWallet.fragments,
    removed: removable,
    after,
  }
}

async function checkDailyCooldown(client, userId) {
  const cooldown = await client.db.collection("daily_cooldowns").findOne({
    userId,
  })

  if (!cooldown?.lastDailyAt) {
    return {
      allowed: true,
      remainingMs: 0,
    }
  }

  const lastDailyAt = new Date(cooldown.lastDailyAt).getTime()
  const elapsed = Date.now() - lastDailyAt
  const remainingMs = DAILY_COOLDOWN_MS - elapsed

  return {
    allowed: remainingMs <= 0,
    remainingMs: Math.max(0, remainingMs),
    lastDailyType: cooldown.dailyType || null,
  }
}

async function setDailyCooldown(client, userId, dailyType) {
  const now = new Date()

  await client.db.collection("daily_cooldowns").updateOne(
    {
      userId,
    },
    {
      $set: {
        userId,
        dailyType,
        lastDailyAt: now,
        nextAvailableAt: new Date(now.getTime() + DAILY_COOLDOWN_MS),
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    {
      upsert: true,
    }
  )
}

function buildSuccessEmbed({
  interaction,
  type,
  event,
  economyResult,
}) {
  const dailyInfo = DAILY_TYPES[type]

  return new EmbedBuilder()
    .setTitle(`${dailyInfo.emoji} Daily — ${dailyInfo.label}`)
    .setColor(0x2ecc71)
    .setDescription(
      `**${event.title}**\n\n` +
      `${event.description}\n\n` +
      `✅ Tu gagnes 💠 **${economyResult.added}** fragment${economyResult.added > 1 ? "s" : ""}.`
    )
    .addFields(
      {
        name: "Fragments",
        value:
          `Avant : **${economyResult.before}**\n` +
          `Gagné : **${economyResult.added}**\n` +
          `Maintenant : **${economyResult.after}**`,
        inline: false,
      },
      {
        name: "Cooldown",
        value: "Tu pourras refaire un daily dans **24h**.",
        inline: false,
      }
    )
    .setFooter({
      text: `Daily de ${interaction.user.username}`,
    })
    .setTimestamp()
}

function buildFailureEmbed({
  interaction,
  type,
  event,
  economyResult,
}) {
  const dailyInfo = DAILY_TYPES[type]

  return new EmbedBuilder()
    .setTitle(`${dailyInfo.emoji} Daily — ${dailyInfo.label}`)
    .setColor(0xe74c3c)
    .setDescription(
      `**${event.title}**\n\n` +
      `${event.description}\n\n` +
      `❌ Le braquage échoue. Tu perds 💠 **${economyResult.removed}** fragment${economyResult.removed > 1 ? "s" : ""}.`
    )
    .addFields(
      {
        name: "Fragments",
        value:
          `Avant : **${economyResult.before}**\n` +
          `Perdu : **${economyResult.removed}**\n` +
          `Maintenant : **${economyResult.after}**`,
        inline: false,
      },
      {
        name: "Cooldown",
        value: "Tu pourras refaire un daily dans **24h**.",
        inline: false,
      }
    )
    .setFooter({
      text: `Daily de ${interaction.user.username}`,
    })
    .setTimestamp()
}

async function runExpedition(interaction, client) {
  const event = pickRandom(EXPEDITION_EVENTS)
  const reward = randomInt(event.minReward, event.maxReward)
  const economyResult = await addFragments(client, interaction.user.id, reward)

  return buildSuccessEmbed({
    interaction,
    type: "expedition",
    event,
    economyResult,
  })
}

async function runEnquete(interaction, client) {
  const event = pickRandom(ENQUETE_EVENTS)
  const reward = randomInt(event.minReward, event.maxReward)
  const economyResult = await addFragments(client, interaction.user.id, reward)

  return buildSuccessEmbed({
    interaction,
    type: "enquete",
    event,
    economyResult,
  })
}

async function runBraquage(interaction, client) {
  const event = pickRandom(BRAQUAGE_EVENTS)
  const failed = randomInt(1, 100) <= event.failChance

  if (failed) {
    const economyResult = await removeFragments(
      client,
      interaction.user.id,
      event.failPenalty
    )

    return buildFailureEmbed({
      interaction,
      type: "braquage",
      event,
      economyResult,
    })
  }

  const reward = randomInt(event.minReward, event.maxReward)
  const economyResult = await addFragments(client, interaction.user.id, reward)

  return buildSuccessEmbed({
    interaction,
    type: "braquage",
    event,
    economyResult,
  })
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Faire une activité quotidienne avec un cooldown de 24h")

    .addSubcommand((subcommand) =>
      subcommand
        .setName("expedition")
        .setDescription("Partir en expédition pour gagner des fragments")
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName("enquete")
        .setDescription("Mener une enquête pour gagner des fragments")
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName("braquage")
        .setDescription("Tenter un braquage risqué pour gagner plus de fragments")
    ),

  async execute(interaction, client) {
    await interaction.deferReply()

    const dailyType = interaction.options.getSubcommand()

    const cooldown = await checkDailyCooldown(client, interaction.user.id)

    if (!cooldown.allowed) {
      const lastDailyLabel = cooldown.lastDailyType
        ? DAILY_TYPES[cooldown.lastDailyType]?.label || cooldown.lastDailyType
        : "daily"

      return interaction.editReply({
        content:
          `⏳ Tu as déjà fait ton daily aujourd'hui.\n` +
          `Dernier daily utilisé : **${lastDailyLabel}**.\n` +
          `Tu pourras recommencer dans **${formatRemainingTime(cooldown.remainingMs)}**.`,
      })
    }

    let embed = null

    if (dailyType === "expedition") {
      embed = await runExpedition(interaction, client)
    }

    if (dailyType === "enquete") {
      embed = await runEnquete(interaction, client)
    }

    if (dailyType === "braquage") {
      embed = await runBraquage(interaction, client)
    }

    if (!embed) {
      return interaction.editReply({
        content: "❌ Type de daily invalide.",
      })
    }

    await setDailyCooldown(client, interaction.user.id, dailyType)

    return interaction.editReply({
      embeds: [embed],
    })
  },
}