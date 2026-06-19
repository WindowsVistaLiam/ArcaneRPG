const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js")

const arcaneCards = require("../../data/arcaneCards")
const fusionCards = require("../../data/fusionCards")
const cardAlbums = require("../../data/cardAlbums")

const allCards = [...arcaneCards, ...fusionCards]

const ALBUM_NOTIFICATION_CHANNEL_ID = "1513427217143566386"

const LEVELS = {
  1: {
    label: "Niveau 1",
    description: "Cartes communes + rares",
    rarities: ["common", "rare"],
  },
  2: {
    label: "Niveau 2",
    description: "Cartes rares + épiques",
    rarities: ["rare", "epic"],
  },
  3: {
    label: "Niveau 3",
    description: "Cartes épiques + légendaires",
    rarities: ["epic", "legendary"],
  },
  4: {
    label: "Niveau 4",
    description: "Toutes les cartes non mythiques",
    rarities: ["common", "rare", "epic", "legendary"],
  },
  5: {
    label: "Niveau 5",
    description: "Cartes mythiques uniquement",
    rarities: ["mythic"],
  },
}

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

const RARITY_LABELS = {
  common: "Commune",
  rare: "Rare",
  epic: "Épique",
  legendary: "Légendaire",
  mythic: "Mythique",
}

const MAX_LIST_CHARS = 950

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function getCardTokens(card) {
  return [
    card.name,
    card.characterName,
    card.characterKey,
    card.faction,
    card.season,
    card.source,
    ...(card.tags || []),
  ]
    .filter(Boolean)
    .map(normalizeText)
}

function tokenMatches(cardTokens, values = []) {
  if (!values.length) return false

  return values.some((value) => {
    const normalizedValue = normalizeText(value)

    return cardTokens.some((token) => {
      return token === normalizedValue || token.includes(normalizedValue)
    })
  })
}

function isFusionCard(card) {
  return card.source === "fusion" || card.isPullable === false
}

function cardMatchesAlbum(card, album) {
  if (album.excludeFusion && isFusionCard(card)) {
    return false
  }

  if (album.source && card.source !== album.source) {
    return false
  }

  const cardTokens = getCardTokens(card)

  if (album.matchTags?.length && tokenMatches(cardTokens, album.matchTags)) {
    return true
  }

  if (album.matchFactions?.length && tokenMatches(cardTokens, album.matchFactions)) {
    return true
  }

  if (album.matchNames?.length && tokenMatches(cardTokens, album.matchNames)) {
    return true
  }

  return Boolean(album.source && card.source === album.source)
}

function sortCards(cards) {
  return [...cards].sort((a, b) => {
    const rarityDiff = (RARITY_ORDER[a.rarity] || 99) - (RARITY_ORDER[b.rarity] || 99)

    if (rarityDiff !== 0) return rarityDiff

    return a.name.localeCompare(b.name)
  })
}

function getAlbumCards(album) {
  const uniqueCards = new Map()

  for (const card of allCards) {
    if (!card?.key || !cardMatchesAlbum(card, album)) continue

    uniqueCards.set(card.key, card)
  }

  return sortCards(Array.from(uniqueCards.values()))
}

function getAlbumLevelCards(album, level) {
  const levelConfig = LEVELS[level]
  const allowedRarities = new Set(levelConfig?.rarities || [])

  return getAlbumCards(album).filter((card) => allowedRarities.has(card.rarity))
}

async function getOwnedCardKeys(client, userId) {
  const playerCards = await client.db.collection("player_cards")
    .find(
      { userId },
      { projection: { cardKey: 1 } }
    )
    .toArray()

  return new Set(playerCards.map((card) => card.cardKey))
}

async function getClaimedRewards(client, userId) {
  const rewards = await client.db.collection("player_album_rewards")
    .find(
      { userId },
      { projection: { albumKey: 1, level: 1 } }
    )
    .toArray()

  return new Set(rewards.map((reward) => `${reward.albumKey}:${reward.level}`))
}

async function getSentNotifications(client, userId) {
  const notifications = await client.db.collection("player_album_notifications")
    .find(
      { userId },
      { projection: { albumKey: 1, level: 1 } }
    )
    .toArray()

  return new Set(notifications.map((notification) => `${notification.albumKey}:${notification.level}`))
}

function getLevelProgress(requiredCards, ownedKeys) {
  const ownedCards = requiredCards.filter((card) => ownedKeys.has(card.key))
  const missingCards = requiredCards.filter((card) => !ownedKeys.has(card.key))

  return {
    owned: ownedCards.length,
    total: requiredCards.length,
    completed: requiredCards.length > 0 && missingCards.length === 0,
    ownedCards,
    missingCards,
  }
}

function getReward(album, level) {
  return album.rewards?.[level] || {}
}

function formatReward(reward) {
  const parts = []

  if (reward.fragments) {
    parts.push(`💠 ${reward.fragments} fragments`)
  }

  if (reward.title) {
    parts.push(`🏷️ Titre : **${reward.title}**`)
  }

  return parts.length ? parts.join("\n") : "Aucune récompense."
}

function getClaimKey(albumKey, level) {
  return `${albumKey}:${level}`
}

function getAlbumOverview(album, ownedKeys, claimedRewards) {
  const albumCards = getAlbumCards(album)
  const albumOwnedCount = albumCards.filter((card) => ownedKeys.has(card.key)).length

  let completedLevels = 0
  let claimedLevels = 0

  const levels = Object.keys(LEVELS).map((levelKey) => {
    const level = Number(levelKey)
    const requiredCards = getAlbumLevelCards(album, level)
    const progress = getLevelProgress(requiredCards, ownedKeys)
    const claimed = claimedRewards.has(getClaimKey(album.key, level))

    if (progress.completed) completedLevels += 1
    if (claimed) claimedLevels += 1

    return {
      level,
      requiredCards,
      progress,
      claimed,
    }
  })

  return {
    albumCards,
    albumOwnedCount,
    completedLevels,
    claimedLevels,
    levels,
  }
}

function truncateLines(lines, maxChars = MAX_LIST_CHARS) {
  if (!lines.length) return "Aucune."

  const kept = []
  let length = 0

  for (const line of lines) {
    const nextLength = length + line.length + 1

    if (nextLength > maxChars) {
      const remaining = lines.length - kept.length
      kept.push(`...et ${remaining} autre${remaining > 1 ? "s" : ""}.`)
      break
    }

    kept.push(line)
    length = nextLength
  }

  return kept.join("\n")
}

function formatCardLine(card, owned = false) {
  const status = owned ? "✅" : "❌"
  const rarityEmoji = RARITY_EMOJIS[card.rarity] || "🎴"

  return `${status} ${rarityEmoji} **${card.name}** — ${RARITY_LABELS[card.rarity] || card.rarity}`
}

function buildHomeEmbed({ user, ownedKeys, claimedRewards }) {
  const embed = new EmbedBuilder()
    .setTitle("📚 Albums de cartes")
    .setColor(0x5865f2)
    .setDescription(
      "Choisis une collection dans le menu ci-dessous.\n\n" +
      "Chaque collection contient 5 niveaux de rareté. Les cartes ne sont **jamais consommées** : il suffit de les posséder pour compléter un niveau."
    )
    .setFooter({
      text: `Albums de ${user.username}`,
    })
    .setTimestamp()

  for (const album of cardAlbums) {
    const overview = getAlbumOverview(album, ownedKeys, claimedRewards)

    embed.addFields({
      name: `${album.emoji || "📘"} ${album.name}`,
      value:
        `${album.description}\n` +
        `Progression globale : **${overview.albumOwnedCount}/${overview.albumCards.length}** cartes\n` +
        `Niveaux complétés : **${overview.completedLevels}/5**\n` +
        `Récompenses récupérées : **${overview.claimedLevels}/5**`,
      inline: false,
    })
  }

  return embed
}

function buildAlbumSelectRow(userId) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`album:select:${userId}`)
    .setPlaceholder("Choisis une collection")
    .addOptions(
      cardAlbums.map((album) => {
        return {
          label: album.name.slice(0, 100),
          description: (album.description || "Collection de cartes").slice(0, 100),
          value: album.key,
          emoji: album.emoji || "📘",
        }
      })
    )

  return new ActionRowBuilder().addComponents(select)
}

function buildAlbumOverviewEmbed({ user, album, ownedKeys, claimedRewards }) {
  const overview = getAlbumOverview(album, ownedKeys, claimedRewards)

  const embed = new EmbedBuilder()
    .setTitle(`${album.emoji || "📘"} Collection ${album.name}`)
    .setColor(0x5865f2)
    .setDescription(
      `${album.description}\n\n` +
      `Progression globale : **${overview.albumOwnedCount}/${overview.albumCards.length}** cartes\n` +
      `Niveaux complétés : **${overview.completedLevels}/5**\n` +
      `Récompenses récupérées : **${overview.claimedLevels}/5**`
    )
    .setFooter({
      text: `Albums de ${user.username}`,
    })
    .setTimestamp()

  for (const levelInfo of overview.levels) {
    const levelConfig = LEVELS[levelInfo.level]
    const reward = getReward(album, levelInfo.level)
    const status = levelInfo.claimed
      ? "🎁 Récompense récupérée"
      : levelInfo.progress.completed
        ? "✅ Complété — récompense disponible"
        : "⏳ En cours"

    embed.addFields({
      name: `${levelConfig.label} — ${levelConfig.description}`,
      value:
        `Progression : **${levelInfo.progress.owned}/${levelInfo.progress.total}**\n` +
        `Récompense : ${formatReward(reward)}\n` +
        `État : ${status}`,
      inline: false,
    })
  }

  return embed
}

function buildLevelButtonsRow(userId, albumKey) {
  const buttons = Object.keys(LEVELS).map((level) => {
    return new ButtonBuilder()
      .setCustomId(`album:level:${userId}:${albumKey}:${level}`)
      .setLabel(`Niveau ${level}`)
      .setStyle(ButtonStyle.Secondary)
  })

  return new ActionRowBuilder().addComponents(...buttons)
}

function buildBackRow(userId) {
  const homeButton = new ButtonBuilder()
    .setCustomId(`album:home:${userId}`)
    .setLabel("Accueil")
    .setStyle(ButtonStyle.Primary)

  return new ActionRowBuilder().addComponents(homeButton)
}

function buildLevelDetailEmbed({
  user,
  album,
  level,
  requiredCards,
  progress,
  reward,
  claimed,
}) {
  const levelConfig = LEVELS[level]

  const ownedLines = progress.ownedCards.map((card) => formatCardLine(card, true))
  const missingLines = progress.missingCards.map((card) => formatCardLine(card, false))

  const status = claimed
    ? "🎁 Tu as déjà récupéré la récompense de ce niveau."
    : progress.completed
      ? "✅ Niveau complété. Tu peux récupérer ta récompense."
      : "⏳ Niveau pas encore complété."

  return new EmbedBuilder()
    .setTitle(`${album.emoji || "📘"} ${album.name} — ${levelConfig.label}`)
    .setColor(progress.completed ? 0x2ecc71 : 0xe67e22)
    .setDescription(
      `${levelConfig.description}\n\n` +
      `Progression : **${progress.owned}/${progress.total}**\n` +
      `Récompense :\n${formatReward(reward)}\n\n` +
      `${status}`
    )
    .addFields(
      {
        name: "Cartes possédées",
        value: truncateLines(ownedLines),
        inline: false,
      },
      {
        name: "Cartes manquantes",
        value: truncateLines(missingLines),
        inline: false,
      }
    )
    .setFooter({
      text: `Albums de ${user.username}`,
    })
    .setTimestamp()
}

function buildLevelActionRows({
  userId,
  albumKey,
  level,
  canClaim,
}) {
  const rows = []
  const buttons = []

  if (canClaim) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`album:claim:${userId}:${albumKey}:${level}`)
        .setLabel("🎁 Récupérer la récompense")
        .setStyle(ButtonStyle.Success)
    )
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId(`album:overview:${userId}:${albumKey}`)
      .setLabel("Retour collection")
      .setStyle(ButtonStyle.Secondary)
  )

  buttons.push(
    new ButtonBuilder()
      .setCustomId(`album:home:${userId}`)
      .setLabel("Accueil")
      .setStyle(ButtonStyle.Primary)
  )

  rows.push(new ActionRowBuilder().addComponents(...buttons))
  return rows
}

async function addFragments(client, userId, amount) {
  if (!amount || amount <= 0) {
    const wallet = await client.db.collection("player_wallets").findOne({ userId })

    return {
      before: wallet?.fragments || 0,
      added: 0,
      after: wallet?.fragments || 0,
    }
  }

  const beforeWallet = await client.db.collection("player_wallets").findOne({ userId })
  const before = beforeWallet?.fragments || 0
  const now = new Date()

  await client.db.collection("player_wallets").updateOne(
    { userId },
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
    { upsert: true }
  )

  const afterWallet = await client.db.collection("player_wallets").findOne({ userId })

  return {
    before,
    added: amount,
    after: afterWallet?.fragments || before + amount,
  }
}

async function unlockTitle(client, userId, title) {
  if (!title) return false

  const titleKey = normalizeText(title)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")

  await client.db.collection("player_titles").updateOne(
    {
      userId,
      titleKey,
    },
    {
      $setOnInsert: {
        userId,
        titleKey,
        title,
        source: "album",
        unlockedAt: new Date(),
        createdAt: new Date(),
      },
      $set: {
        updatedAt: new Date(),
      },
    },
    {
      upsert: true,
    }
  )

  return true
}

async function getCompletedAlbumLevels(client, userId) {
  const ownedKeys = await getOwnedCardKeys(client, userId)
  const claimedRewards = await getClaimedRewards(client, userId)
  const sentNotifications = await getSentNotifications(client, userId)
  const completedLevels = []

  for (const album of cardAlbums) {
    for (const levelKey of Object.keys(LEVELS)) {
      const level = Number(levelKey)
      const requiredCards = getAlbumLevelCards(album, level)
      const progress = getLevelProgress(requiredCards, ownedKeys)
      const key = getClaimKey(album.key, level)

      if (!requiredCards.length) continue
      if (!progress.completed) continue
      if (claimedRewards.has(key)) continue
      if (sentNotifications.has(key)) continue

      completedLevels.push({
        album,
        level,
        requiredCards,
        reward: getReward(album, level),
      })
    }
  }

  return completedLevels
}

async function markAlbumNotificationSent(client, userId, completion) {
  try {
    await client.db.collection("player_album_notifications").insertOne({
      userId,
      albumKey: completion.album.key,
      albumName: completion.album.name,
      level: completion.level,
      channelId: ALBUM_NOTIFICATION_CHANNEL_ID,
      notifiedAt: new Date(),
      createdAt: new Date(),
    })

    return true
  } catch (error) {
    if (error.code === 11000) return false
    throw error
  }
}

async function checkAlbumCompletions(client, userId) {
  const completedLevels = await getCompletedAlbumLevels(client, userId)

  if (!completedLevels.length) return []

  const newlyNotified = []

  for (const completion of completedLevels) {
    const inserted = await markAlbumNotificationSent(client, userId, completion)
    if (inserted) newlyNotified.push(completion)
  }

  if (!newlyNotified.length) return []

  const channel = await client.channels.fetch(ALBUM_NOTIFICATION_CHANNEL_ID).catch(() => null)

  if (!channel || !channel.isTextBased?.()) {
    console.warn(`Salon de notification album introuvable : ${ALBUM_NOTIFICATION_CHANNEL_ID}`)
    return newlyNotified
  }

  const user = await client.users.fetch(userId).catch(() => null)
  const userName = user?.username || "Un joueur"

  const lines = newlyNotified.map((completion) => {
    const reward = formatReward(completion.reward).replace(/\n/g, " + ")

    return `${completion.album.emoji || "📘"} **${completion.album.name} — Niveau ${completion.level}** : ${reward}`
  })

  const embed = new EmbedBuilder()
    .setTitle("📚 Niveau de collection complété !")
    .setColor(0x2ecc71)
    .setDescription(
      `<@${userId}> vient de compléter ${newlyNotified.length > 1 ? "plusieurs niveaux de collection" : "un niveau de collection"}.\n\n` +
      `${lines.join("\n")}\n\n` +
      `Utilise **/album** dans ce salon pour récupérer ${newlyNotified.length > 1 ? "tes récompenses" : "ta récompense"}.`
    )
    .setFooter({
      text: `Albums de ${userName}`,
    })
    .setTimestamp()

  await channel.send({
    content: `<@${userId}>`,
    embeds: [embed],
  }).catch((error) => {
    console.error("Erreur envoi notification album :", error)
  })

  return newlyNotified
}

async function claimAlbumReward(client, userId, album, level) {
  const ownedKeys = await getOwnedCardKeys(client, userId)
  const claimedRewards = await getClaimedRewards(client, userId)

  const requiredCards = getAlbumLevelCards(album, level)
  const progress = getLevelProgress(requiredCards, ownedKeys)
  const claimed = claimedRewards.has(getClaimKey(album.key, level))

  if (!requiredCards.length) {
    return {
      success: false,
      message: "❌ Ce niveau ne contient aucune carte pour cette collection.",
    }
  }

  if (!progress.completed) {
    return {
      success: false,
      message: "❌ Tu n'as pas encore toutes les cartes nécessaires pour ce niveau.",
    }
  }

  if (claimed) {
    return {
      success: false,
      message: "❌ Tu as déjà récupéré la récompense de ce niveau.",
    }
  }

  const reward = getReward(album, level)
  const now = new Date()

  try {
    await client.db.collection("player_album_rewards").insertOne({
      userId,
      albumKey: album.key,
      albumName: album.name,
      level,
      rewards: reward,
      claimedAt: now,
      createdAt: now,
    })
  } catch (error) {
    if (error.code === 11000) {
      return {
        success: false,
        message: "❌ Tu as déjà récupéré la récompense de ce niveau.",
      }
    }

    throw error
  }

  const economyResult = await addFragments(client, userId, reward.fragments || 0)

  if (reward.title) {
    await unlockTitle(client, userId, reward.title)
  }

  return {
    success: true,
    reward,
    economyResult,
  }
}

function findAlbum(albumKey) {
  return cardAlbums.find((album) => album.key === albumKey)
}

async function showHome(interaction, client, userId, shouldUpdate = true) {
  const user = await client.users.fetch(userId).catch(() => null)

  if (!user) {
    const payload = {
      content: "❌ Utilisateur introuvable.",
      embeds: [],
      components: [],
    }

    return shouldUpdate ? interaction.update(payload) : interaction.editReply(payload)
  }

  const ownedKeys = await getOwnedCardKeys(client, userId)
  const claimedRewards = await getClaimedRewards(client, userId)

  const embed = buildHomeEmbed({
    user,
    ownedKeys,
    claimedRewards,
  })

  const payload = {
    content: "",
    embeds: [embed],
    components: [buildAlbumSelectRow(userId)],
  }

  return shouldUpdate ? interaction.update(payload) : interaction.editReply(payload)
}

async function showAlbumOverview(interaction, client, userId, albumKey, shouldUpdate = true) {
  const user = await client.users.fetch(userId).catch(() => null)
  const album = findAlbum(albumKey)

  if (!user || !album) {
    const payload = {
      content: "❌ Collection introuvable.",
      embeds: [],
      components: [],
    }

    return shouldUpdate ? interaction.update(payload) : interaction.editReply(payload)
  }

  const ownedKeys = await getOwnedCardKeys(client, userId)
  const claimedRewards = await getClaimedRewards(client, userId)

  const embed = buildAlbumOverviewEmbed({
    user,
    album,
    ownedKeys,
    claimedRewards,
  })

  const payload = {
    content: "",
    embeds: [embed],
    components: [
      buildLevelButtonsRow(userId, albumKey),
      buildBackRow(userId),
    ],
  }

  return shouldUpdate ? interaction.update(payload) : interaction.editReply(payload)
}

async function showLevelDetail(interaction, client, userId, albumKey, level) {
  const user = await client.users.fetch(userId).catch(() => null)
  const album = findAlbum(albumKey)

  if (!user || !album || !LEVELS[level]) {
    return interaction.update({
      content: "❌ Niveau ou collection introuvable.",
      embeds: [],
      components: [],
    })
  }

  const ownedKeys = await getOwnedCardKeys(client, userId)
  const claimedRewards = await getClaimedRewards(client, userId)

  const requiredCards = getAlbumLevelCards(album, level)
  const progress = getLevelProgress(requiredCards, ownedKeys)
  const reward = getReward(album, level)
  const claimed = claimedRewards.has(getClaimKey(album.key, level))
  const canClaim = requiredCards.length > 0 && progress.completed && !claimed

  const embed = buildLevelDetailEmbed({
    user,
    album,
    level,
    requiredCards,
    progress,
    reward,
    claimed,
  })

  return interaction.update({
    content: "",
    embeds: [embed],
    components: buildLevelActionRows({
      userId,
      albumKey,
      level,
      canClaim,
    }),
  })
}

function ensureOwner(interaction, userId) {
  if (interaction.user.id === userId) return true

  interaction.reply({
    content: "❌ Seul le joueur qui a ouvert cet album peut utiliser ces boutons.",
    ephemeral: true,
  })

  return false
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("album")
    .setDescription("Voir tes albums de cartes et récupérer les récompenses"),

  checkAlbumCompletions,

  async execute(interaction, client) {
    await interaction.deferReply()

    await checkAlbumCompletions(client, interaction.user.id).catch(console.error)
    await showHome(interaction, client, interaction.user.id, false)
  },

  async handleSelect(interaction, client) {
    if (!interaction.customId.startsWith("album:select:")) return

    const parts = interaction.customId.split(":")
    const userId = parts[2]

    if (!ensureOwner(interaction, userId)) return

    const albumKey = interaction.values[0]

    return showAlbumOverview(interaction, client, userId, albumKey, true)
  },

  async handleButton(interaction, client) {
    if (!interaction.customId.startsWith("album:")) return

    const parts = interaction.customId.split(":")
    const action = parts[1]
    const userId = parts[2]

    if (!ensureOwner(interaction, userId)) return

    if (action === "home") {
      return showHome(interaction, client, userId, true)
    }

    if (action === "overview") {
      const albumKey = parts[3]
      return showAlbumOverview(interaction, client, userId, albumKey, true)
    }

    if (action === "level") {
      const albumKey = parts[3]
      const level = Number(parts[4])
      return showLevelDetail(interaction, client, userId, albumKey, level)
    }

    if (action === "claim") {
      await interaction.deferUpdate()

      const albumKey = parts[3]
      const level = Number(parts[4])
      const album = findAlbum(albumKey)

      if (!album || !LEVELS[level]) {
        return interaction.editReply({
          content: "❌ Niveau ou collection introuvable.",
          embeds: [],
          components: [],
        })
      }

      const result = await claimAlbumReward(client, userId, album, level)

      if (!result.success) {
        return interaction.editReply({
          content: result.message,
          embeds: [],
          components: [],
        })
      }

      const rewardText = formatReward(result.reward)
      const economy = result.economyResult

      const embed = new EmbedBuilder()
        .setTitle("🎁 Récompense récupérée")
        .setColor(0x2ecc71)
        .setDescription(
          `Tu as récupéré la récompense de **${album.name} — Niveau ${level}**.\n\n` +
          `${rewardText}`
        )
        .addFields({
          name: "Fragments",
          value:
            `Avant : **${economy.before}**\n` +
            `Gagné : **${economy.added}**\n` +
            `Maintenant : **${economy.after}**`,
          inline: false,
        })
        .setTimestamp()

      return interaction.editReply({
        content: "",
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`album:overview:${userId}:${albumKey}`)
              .setLabel("Retour collection")
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId(`album:home:${userId}`)
              .setLabel("Accueil")
              .setStyle(ButtonStyle.Primary)
          ),
        ],
      })
    }
  },
}
