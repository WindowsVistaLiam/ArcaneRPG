const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js")
const { ObjectId } = require("mongodb")

const arcaneCards = require("../../data/arcaneCards")
const fusionCards = require("../../data/fusionCards")
const {
  getCardStatsWithUpgrade,
  addFragments,
} = require("../../utils/cardBattle")

const allCards = [...arcaneCards, ...fusionCards]

const MIN_PLAYERS = 2
const MAX_PLAYERS = 5
const DEFAULT_JOIN_SECONDS = 120
const MAX_ROUNDS = 12

const RARITY_CONFIG = {
  common: {
    label: "Commun",
    emoji: "⚪",
    color: 0x95a5a6,
    bossName: "Renata Glasc",
    specialty: "Vitesse",
    description: "Renata Glasc enchaîne rapidement les attaques et met la pression sur toute l'équipe.",
    image: "https://raw.githubusercontent.com/WindowsVistaLiam/ArcaneRPG/main/images/bosses/renata_glasc.png",
    hpFactor: 0.95,
    attackFactor: 0.8,
    defenseFactor: 0.7,
    speedFactor: 1.35,
    minReward: 80,
    maxReward: 130,
  },

  rare: {
    label: "Rare",
    emoji: "🔵",
    color: 0x3498db,
    bossName: "Zac",
    specialty: "Tank",
    description: "Zac absorbe énormément de dégâts et reste difficile à faire tomber.",
    image: "https://raw.githubusercontent.com/WindowsVistaLiam/ArcaneRPG/main/images/bosses/zac.png",
    hpFactor: 1.45,
    attackFactor: 0.8,
    defenseFactor: 1.25,
    speedFactor: 0.75,
    minReward: 160,
    maxReward: 260,
  },

  epic: {
    label: "Épique",
    emoji: "🟣",
    color: 0x9b59b6,
    bossName: "Twitch",
    specialty: "Dégâts",
    description: "Twitch frappe fort et peut punir très vite une équipe mal préparée.",
    image: "https://raw.githubusercontent.com/WindowsVistaLiam/ArcaneRPG/main/images/bosses/twitch.png",
    hpFactor: 1.1,
    attackFactor: 1.4,
    defenseFactor: 0.8,
    speedFactor: 1.0,
    minReward: 320,
    maxReward: 500,
  },

  legendary: {
    label: "Légendaire",
    emoji: "🟡",
    color: 0xf1c40f,
    bossName: "Urgot",
    specialty: "Dégâts et vitesse",
    description: "Urgot combine une puissance brutale avec une cadence très dangereuse.",
    image: "https://raw.githubusercontent.com/WindowsVistaLiam/ArcaneRPG/main/images/bosses/urgot.png",
    hpFactor: 1.35,
    attackFactor: 1.45,
    defenseFactor: 1.0,
    speedFactor: 1.2,
    minReward: 650,
    maxReward: 950,
  },

  mythic: {
    label: "Mythique",
    emoji: "🔴",
    color: 0xe74c3c,
    bossName: "Janna",
    specialty: "Polyvalente",
    description: "Janna excelle partout : survie, pression, vitesse et contrôle du combat.",
    image: "https://raw.githubusercontent.com/WindowsVistaLiam/ArcaneRPG/main/images/bosses/janna.png",
    hpFactor: 1.65,
    attackFactor: 1.35,
    defenseFactor: 1.25,
    speedFactor: 1.25,
    minReward: 1200,
    maxReward: 1800,
  },
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function formatRemainingTime(ms) {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes > 0 && seconds > 0) return `${minutes}min ${seconds}s`
  if (minutes > 0) return `${minutes}min`

  return `${seconds}s`
}

function getCardFromCatalog(cardKey) {
  return allCards.find((card) => card.key === cardKey)
}

function buildCardFromPlayerCard(playerCard) {
  const catalogCard = getCardFromCatalog(playerCard.cardKey)

  if (catalogCard) return catalogCard

  return {
    key: playerCard.cardKey,
    name: playerCard.cardName || playerCard.name || playerCard.characterName || playerCard.cardKey,
    characterName: playerCard.characterName || playerCard.cardName || playerCard.cardKey,
    rarity: playerCard.rarity || "common",
    rarityLabel: playerCard.rarityLabel || "Commun",
    value: playerCard.value || 0,
    image: playerCard.image || "",
    description: playerCard.description || "",
    faction: playerCard.faction || "Inconnue",
    season: playerCard.season || "Inconnue",
    tags: playerCard.tags || [],
    source: playerCard.source || "player_cards",
    isPullable: playerCard.isPullable,
    fusionBonusPercent: playerCard.fusionBonusPercent || 0,
    ingredients: playerCard.ingredients || [],
    battleStats: playerCard.battleStats || null,
  }
}

async function getDisplayName(client, guild, userId) {
  if (guild) {
    const member = await guild.members.fetch(userId).catch(() => null)

    if (member) return member.displayName
  }

  const user = await client.users.fetch(userId).catch(() => null)

  return user ? user.username : `Utilisateur ${userId}`
}

async function getFavoriteCardKey(client, userId) {
  const profile = await client.db.collection("player_profiles").findOne({ userId })

  return profile?.favoriteCardKey || null
}

async function getOwnedPlayerCard(client, userId, cardKey) {
  return client.db.collection("player_cards").findOne({
    userId,
    cardKey,
  })
}

async function getFavoriteCombatCard(client, userId) {
  const favoriteCardKey = await getFavoriteCardKey(client, userId)

  if (!favoriteCardKey) {
    return {
      success: false,
      message: "❌ Tu n'as pas encore de carte favorite. Utilise `/favori` avant de rejoindre un boss.",
    }
  }

  const ownedCard = await getOwnedPlayerCard(client, userId, favoriteCardKey)

  if (!ownedCard) {
    return {
      success: false,
      message: "❌ Ta carte favorite n'est plus dans ta collection. Utilise `/favori` pour en choisir une autre.",
    }
  }

  return {
    success: true,
    card: buildCardFromPlayerCard(ownedCard),
  }
}

function isAdminForSession(interaction, session) {
  if (interaction.user.id === session.createdBy) return true

  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))
}

function getSessionObjectId(sessionId) {
  if (!ObjectId.isValid(sessionId)) return null

  return new ObjectId(sessionId)
}

function getAlivePlayers(session) {
  return (session.players || []).filter((player) => (player.currentHp || 0) > 0)
}

function getPlayer(session, userId) {
  return (session.players || []).find((player) => player.userId === userId)
}

function getActionLabel(action) {
  const labels = {
    attack: "⚔️ Attaque",
    defend: "🛡️ Défense",
    dodge: "💨 Esquive",
  }

  return labels[action] || action
}

function getBossConfig(rarity) {
  return RARITY_CONFIG[rarity] || RARITY_CONFIG.common
}

function createBossStats(config, playerStatsList, playerCount) {
  const totalHp = playerStatsList.reduce((sum, stats) => sum + stats.hp, 0)
  const averageAttack = playerStatsList.reduce((sum, stats) => sum + stats.attack, 0) / playerCount
  const averageDefense = playerStatsList.reduce((sum, stats) => sum + stats.defense, 0) / playerCount
  const averageSpeed = playerStatsList.reduce((sum, stats) => sum + stats.speed, 0) / playerCount

  const maxHp = Math.round(totalHp * config.hpFactor + playerCount * 120)

  return {
    name: config.bossName,
    rarity: config.label,
    maxHp,
    currentHp: maxHp,
    attack: Math.round(averageAttack * config.attackFactor + 15),
    defense: Math.round(averageDefense * config.defenseFactor + 8),
    speed: Math.round(averageSpeed * config.speedFactor + 5),
  }
}

function getHpBar(current, max, size = 12) {
  const safeMax = Math.max(1, max || 1)
  const ratio = clamp((current || 0) / safeMax, 0, 1)
  const filled = Math.round(ratio * size)
  const empty = size - filled

  return "█".repeat(filled) + "░".repeat(empty)
}

function buildLobbyEmbed({ session, clientUser }) {
  const config = getBossConfig(session.rarity)
  const players = session.players || []
  const remainingMs = new Date(session.joinEndsAt).getTime() - Date.now()
  const playerLines = players.length
    ? players.map((player, index) => {
        return `**${index + 1}.** <@${player.userId}> — ⭐ **${player.cardName}**`
      }).join("\n")
    : "Aucun joueur inscrit pour le moment."

  return new EmbedBuilder()
    .setTitle(`${config.emoji} Boss ${config.label} — ${config.bossName}`)
    .setColor(config.color)
    .setDescription(
      `${config.description}\n\n` +
      `Les joueurs utilisent leur **carte favorite**.\n` +
      `Minimum : **${MIN_PLAYERS}** joueurs — Maximum : **${MAX_PLAYERS}** joueurs.\n` +
      `Temps restant pour rejoindre : **${formatRemainingTime(remainingMs)}**.`
    )
    .addFields(
      {
        name: `Participants ${players.length}/${MAX_PLAYERS}`,
        value: playerLines,
        inline: false,
      },
      {
        name: "Actions en combat",
        value:
          "⚔️ **Attaquer** : inflige des dégâts au boss.\n" +
          "🛡️ **Défendre** : réduit fortement les dégâts reçus.\n" +
          "💨 **Esquiver** : tente d'éviter complètement l'attaque du boss.",
        inline: false,
      }
    )
    .setFooter({
      text: clientUser ? `Boss lancé par ${clientUser.username}` : "Événement boss",
    })
    .setTimestamp()
}

function buildLobbyRows(sessionId, disabled = false) {
  const joinButton = new ButtonBuilder()
    .setCustomId(`boss:join:${sessionId}`)
    .setLabel("Rejoindre")
    .setStyle(ButtonStyle.Success)
    .setDisabled(disabled)

  const leaveButton = new ButtonBuilder()
    .setCustomId(`boss:leave:${sessionId}`)
    .setLabel("Quitter")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled)

  const startButton = new ButtonBuilder()
    .setCustomId(`boss:start:${sessionId}`)
    .setLabel("Démarrer")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(disabled)

  const cancelButton = new ButtonBuilder()
    .setCustomId(`boss:cancel:${sessionId}`)
    .setLabel("Annuler")
    .setStyle(ButtonStyle.Danger)
    .setDisabled(disabled)

  return [new ActionRowBuilder().addComponents(joinButton, leaveButton, startButton, cancelButton)]
}

function buildBattleEmbed(session, extraLogs = []) {
  const config = getBossConfig(session.rarity)
  const boss = session.boss
  const alivePlayers = getAlivePlayers(session)
  const actions = session.actions || {}

  const playerLines = (session.players || []).map((player) => {
    const hp = Math.max(0, player.currentHp || 0)
    const maxHp = player.maxHp || 1
    const deadText = hp <= 0 ? " — 💀 K.O." : ""
    const action = actions[player.userId]?.action
    const actionText = hp > 0 ? ` — ${action ? getActionLabel(action) : "⏳ En attente"}` : ""

    return `<@${player.userId}> — **${player.cardName}**\n❤️ ${hp}/${maxHp} ${getHpBar(hp, maxHp, 10)}${actionText}${deadText}`
  }).join("\n\n")

  const logText = extraLogs.length
    ? extraLogs.slice(-8).join("\n")
    : (session.logs || []).slice(-8).join("\n") || "Le combat vient de commencer."

  const embed = new EmbedBuilder()
    .setTitle(`${config.emoji} Boss ${config.label} — ${boss.name}`)
    .setColor(config.color)
    .setDescription(
      `**Tour ${session.round || 1}/${MAX_ROUNDS}**\n\n` +
      `**Spécialité :** ${config.specialty}\n` +
      `Boss : ❤️ **${Math.max(0, boss.currentHp)}/${boss.maxHp}** ${getHpBar(boss.currentHp, boss.maxHp)}\n` +
      `⚔️ ATK : **${boss.attack}** — 🛡️ DEF : **${boss.defense}** — 💨 VIT : **${boss.speed}**\n\n` +
      `Joueurs vivants : **${alivePlayers.length}/${session.players.length}**`
    )
    .addFields(
      {
        name: "Équipe",
        value: playerLines || "Aucun joueur.",
        inline: false,
      },
      {
        name: "Derniers événements",
        value: logText,
        inline: false,
      }
    )
    .setFooter({
      text: "Chaque joueur vivant choisit une action. Le tour se résout quand tout le monde a joué.",
    })
    .setTimestamp()

  if (config.image) {
    embed.setThumbnail(config.image)
  }

  return embed
}

function buildBattleRows(sessionId, disabled = false) {
  const attackButton = new ButtonBuilder()
    .setCustomId(`boss:action:${sessionId}:attack`)
    .setLabel("⚔️ Attaquer")
    .setStyle(ButtonStyle.Danger)
    .setDisabled(disabled)

  const defendButton = new ButtonBuilder()
    .setCustomId(`boss:action:${sessionId}:defend`)
    .setLabel("🛡️ Défendre")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(disabled)

  const dodgeButton = new ButtonBuilder()
    .setCustomId(`boss:action:${sessionId}:dodge`)
    .setLabel("💨 Esquiver")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled)

  return [new ActionRowBuilder().addComponents(attackButton, defendButton, dodgeButton)]
}

async function buildFinalEmbed(client, session, victory, rewardResults = []) {
  const config = getBossConfig(session.rarity)
  const boss = session.boss

  const damageRanking = [...(session.players || [])]
    .sort((a, b) => (b.damageDealt || 0) - (a.damageDealt || 0))
    .map((player, index) => {
      return `**${index + 1}.** <@${player.userId}> — **${player.damageDealt || 0}** dégâts`
    })
    .join("\n")

  const rewardText = rewardResults.length
    ? rewardResults.map((reward) => {
        return `<@${reward.userId}> — 💠 **${reward.amount}** fragments`
      }).join("\n")
    : victory
      ? "Aucune récompense distribuée."
      : "Aucune récompense : le boss n'a pas été vaincu."

  const embed = new EmbedBuilder()
    .setTitle(victory ? "🏆 Boss vaincu !" : "💀 Échec du combat de boss")
    .setColor(victory ? 0x2ecc71 : 0xe74c3c)
    .setDescription(
      victory
        ? `L'équipe a vaincu **${boss.name}** !`
        : `**${boss.name}** a résisté à l'équipe.`
    )
    .addFields(
      {
        name: "Boss",
        value:
          `${config.emoji} Rareté : **${config.label}**\n` +
          `🧠 Spécialité : **${config.specialty}**\n` +
          `❤️ PV restants : **${Math.max(0, boss.currentHp)}/${boss.maxHp}**\n` +
          `Tours joués : **${session.round || 1}/${MAX_ROUNDS}**`,
        inline: false,
      },
      {
        name: "Dégâts infligés",
        value: damageRanking || "Aucun dégât.",
        inline: false,
      },
      {
        name: "Récompenses",
        value: rewardText,
        inline: false,
      }
    )
    .setTimestamp()

  if (config.image) {
    embed.setThumbnail(config.image)
  }

  return embed
}

async function updateBossMessage(client, session, payload) {
  if (!session.channelId || !session.messageId) return false

  const channel = await client.channels.fetch(session.channelId).catch(() => null)
  if (!channel) return false

  const message = await channel.messages.fetch(session.messageId).catch(() => null)
  if (!message) return false

  await message.edit(payload).catch(() => null)

  return true
}

async function getSession(client, sessionId) {
  const objectId = getSessionObjectId(sessionId)
  if (!objectId) return null

  return client.db.collection("boss_sessions").findOne({ _id: objectId })
}

async function startBossSession(client, sessionId, options = {}) {
  const { interaction = null, automatic = false } = options
  const objectId = getSessionObjectId(sessionId)

  if (!objectId) {
    if (interaction) {
      await interaction.editReply({
        content: "❌ Session de boss invalide.",
        embeds: [],
        components: [],
      })
    }

    return false
  }

  const sessions = client.db.collection("boss_sessions")
  const session = await sessions.findOne({ _id: objectId })

  if (!session || session.status !== "recruiting") {
    return false
  }

  const players = session.players || []

  if (players.length < MIN_PLAYERS) {
    const payload = {
      content: automatic
        ? `❌ Boss annulé : il faut au moins **${MIN_PLAYERS}** joueurs.`
        : `❌ Il faut au moins **${MIN_PLAYERS}** joueurs pour démarrer le boss.`,
      embeds: automatic ? [] : [buildLobbyEmbed({ session })],
      components: automatic ? [] : buildLobbyRows(sessionId),
    }

    if (automatic) {
      await sessions.updateOne(
        { _id: objectId },
        {
          $set: {
            status: "cancelled",
            cancelReason: "not_enough_players",
            updatedAt: new Date(),
          },
        }
      )
      await updateBossMessage(client, session, payload)
    } else if (interaction) {
      await interaction.editReply(payload)
    }

    return false
  }

  if (players.length > MAX_PLAYERS) {
    if (interaction) {
      await interaction.editReply({
        content: `❌ Il ne peut pas y avoir plus de **${MAX_PLAYERS}** joueurs.`,
        embeds: [buildLobbyEmbed({ session })],
        components: buildLobbyRows(sessionId),
      })
    }

    return false
  }

  const locked = await sessions.updateOne(
    {
      _id: objectId,
      status: "recruiting",
      starting: { $ne: true },
    },
    {
      $set: {
        starting: true,
        updatedAt: new Date(),
      },
    }
  )

  if (locked.modifiedCount !== 1) return false

  const preparedPlayers = []
  const playerStatsList = []

  for (const player of players) {
    const ownedCard = await getOwnedPlayerCard(client, player.userId, player.cardKey)

    if (!ownedCard) continue

    const card = buildCardFromPlayerCard(ownedCard)
    const stats = await getCardStatsWithUpgrade(client, player.userId, card)

    preparedPlayers.push({
      userId: player.userId,
      cardKey: card.key,
      cardName: card.name,
      stats,
      maxHp: stats.hp,
      currentHp: stats.hp,
      damageDealt: 0,
      joinedAt: player.joinedAt || new Date(),
    })

    playerStatsList.push(stats)
  }

  if (preparedPlayers.length < MIN_PLAYERS) {
    await sessions.updateOne(
      { _id: objectId },
      {
        $set: {
          status: "cancelled",
          cancelReason: "not_enough_valid_cards",
          updatedAt: new Date(),
        },
        $unset: {
          starting: "",
        },
      }
    )

    const payload = {
      content: "❌ Boss annulé : pas assez de joueurs avec une carte favorite valide.",
      embeds: [],
      components: [],
    }

    if (interaction) await interaction.editReply(payload)
    else await updateBossMessage(client, session, payload)

    return false
  }

  const config = getBossConfig(session.rarity)
  const boss = createBossStats(config, playerStatsList, preparedPlayers.length)

  const updatedSession = {
    ...session,
    status: "active",
    players: preparedPlayers,
    boss,
    round: 1,
    actions: {},
    logs: [`⚔️ Le combat commence contre **${boss.name}** !`],
    startedAt: new Date(),
    updatedAt: new Date(),
  }

  await sessions.updateOne(
    { _id: objectId },
    {
      $set: {
        status: "active",
        players: preparedPlayers,
        boss,
        round: 1,
        actions: {},
        logs: updatedSession.logs,
        startedAt: updatedSession.startedAt,
        updatedAt: updatedSession.updatedAt,
      },
      $unset: {
        starting: "",
      },
    }
  )

  const payload = {
    content: "⚔️ Le combat de boss commence !",
    embeds: [buildBattleEmbed(updatedSession)],
    components: buildBattleRows(sessionId),
  }

  if (interaction) {
    await interaction.editReply(payload)
  } else {
    await updateBossMessage(client, session, payload)
  }

  return true
}

function scheduleBossAutoStart(client, sessionId, delayMs) {
  setTimeout(() => {
    startBossSession(client, sessionId, { automatic: true }).catch((error) => {
      console.error("❌ Erreur démarrage automatique boss :", error)
    })
  }, Math.max(1000, delayMs))
}

function calculatePlayerDamage(player, boss) {
  const stats = player.stats
  const baseDamage = stats.attack * 0.9 + stats.power * 0.04 + randomInt(0, Math.max(3, Math.round(stats.speed / 2)))
  const reducedDamage = baseDamage - boss.defense * 0.35
  const critical = Math.random() < 0.08
  const damage = Math.max(8, Math.round(reducedDamage * (critical ? 1.5 : 1)))

  return {
    damage,
    critical,
  }
}

function calculateBossDamage(player, boss, action) {
  const stats = player.stats
  let damage = Math.max(5, Math.round(boss.attack - stats.defense * 0.45 + randomInt(-5, 10)))
  let avoided = false
  let defended = false
  let dodgeFailed = false

  if (action === "defend") {
    damage = Math.max(1, Math.round(damage * 0.45))
    defended = true
  }

  if (action === "dodge") {
    const dodgeChance = clamp(35 + stats.speed * 1.3 - boss.speed * 0.8, 25, 75)

    if (Math.random() * 100 <= dodgeChance) {
      damage = 0
      avoided = true
    } else {
      damage = Math.round(damage * 1.15)
      dodgeFailed = true
    }
  }

  return {
    damage,
    avoided,
    defended,
    dodgeFailed,
  }
}

async function distributeRewards(client, session) {
  const config = getBossConfig(session.rarity)
  const totalDamage = Math.max(
    1,
    (session.players || []).reduce((sum, player) => sum + (player.damageDealt || 0), 0)
  )

  const rewards = []

  for (const player of session.players || []) {
    const baseReward = randomInt(config.minReward, config.maxReward)
    const contribution = (player.damageDealt || 0) / totalDamage
    const contributionBonus = Math.round(config.maxReward * contribution * 0.35)
    const survivalBonus = (player.currentHp || 0) > 0 ? Math.round(baseReward * 0.15) : 0
    const amount = baseReward + contributionBonus + survivalBonus

    await addFragments(client, player.userId, amount)

    rewards.push({
      userId: player.userId,
      amount,
    })
  }

  return rewards
}

async function resolveRoundIfReady(client, sessionId, interaction = null) {
  const objectId = getSessionObjectId(sessionId)
  if (!objectId) return false

  const sessions = client.db.collection("boss_sessions")
  const session = await sessions.findOne({ _id: objectId })

  if (!session || session.status !== "active") return false

  const alivePlayers = getAlivePlayers(session)
  const actions = session.actions || {}
  const ready = alivePlayers.length > 0 && alivePlayers.every((player) => actions[player.userId]?.action)

  if (!ready) {
    const payload = {
      content: "✅ Action enregistrée. En attente des autres joueurs.",
      embeds: [buildBattleEmbed(session)],
      components: buildBattleRows(sessionId),
    }

    if (interaction) await interaction.editReply(payload)

    return false
  }

  const lock = await sessions.updateOne(
    {
      _id: objectId,
      status: "active",
      round: session.round,
      resolving: { $ne: true },
    },
    {
      $set: {
        resolving: true,
        updatedAt: new Date(),
      },
    }
  )

  if (lock.modifiedCount !== 1) return false

  const lockedSession = await sessions.findOne({ _id: objectId })
  const boss = { ...lockedSession.boss }
  const players = (lockedSession.players || []).map((player) => ({ ...player }))
  const roundLogs = [`**Tour ${lockedSession.round}**`]

  for (const player of players) {
    if ((player.currentHp || 0) <= 0) continue

    const action = lockedSession.actions?.[player.userId]?.action

    if (action === "attack") {
      const result = calculatePlayerDamage(player, boss)
      boss.currentHp = Math.max(0, boss.currentHp - result.damage)
      player.damageDealt = (player.damageDealt || 0) + result.damage

      roundLogs.push(
        `${result.critical ? "💥" : "⚔️"} <@${player.userId}> inflige **${result.damage}** dégâts au boss${result.critical ? " (**critique**)" : ""}.`
      )
    } else if (action === "defend") {
      roundLogs.push(`🛡️ <@${player.userId}> se met en défense.`)
    } else if (action === "dodge") {
      roundLogs.push(`💨 <@${player.userId}> prépare une esquive.`)
    }
  }

  if (boss.currentHp <= 0) {
    const victorySession = {
      ...lockedSession,
      boss,
      players,
      logs: [...(lockedSession.logs || []), ...roundLogs],
    }
    const rewards = await distributeRewards(client, victorySession)

    await sessions.updateOne(
      { _id: objectId },
      {
        $set: {
          status: "completed",
          result: "victory",
          boss,
          players,
          rewards,
          logs: victorySession.logs,
          endedAt: new Date(),
          updatedAt: new Date(),
        },
        $unset: {
          actions: "",
          resolving: "",
        },
      }
    )

    const finalEmbed = await buildFinalEmbed(client, victorySession, true, rewards)

    const payload = {
      content: "🏆 Le boss est vaincu !",
      embeds: [finalEmbed],
      components: [],
    }

    if (interaction) await interaction.editReply(payload)
    else await updateBossMessage(client, lockedSession, payload)

    return true
  }

  for (const player of players) {
    if ((player.currentHp || 0) <= 0) continue

    const action = lockedSession.actions?.[player.userId]?.action
    const result = calculateBossDamage(player, boss, action)

    player.currentHp = Math.max(0, (player.currentHp || 0) - result.damage)

    if (result.avoided) {
      roundLogs.push(`💨 <@${player.userId}> esquive l'attaque du boss.`)
    } else if (result.defended) {
      roundLogs.push(`🛡️ <@${player.userId}> bloque une partie de l'attaque et subit **${result.damage}** dégâts.`)
    } else if (result.dodgeFailed) {
      roundLogs.push(`❌ <@${player.userId}> rate son esquive et subit **${result.damage}** dégâts.`)
    } else {
      roundLogs.push(`💢 Le boss frappe <@${player.userId}> pour **${result.damage}** dégâts.`)
    }

    if (player.currentHp <= 0) {
      roundLogs.push(`💀 <@${player.userId}> est K.O.`)
    }
  }

  const remainingAlivePlayers = players.filter((player) => (player.currentHp || 0) > 0)
  const updatedLogs = [...(lockedSession.logs || []), ...roundLogs].slice(-30)

  if (!remainingAlivePlayers.length || (lockedSession.round || 1) >= MAX_ROUNDS) {
    const defeatSession = {
      ...lockedSession,
      boss,
      players,
      logs: updatedLogs,
    }

    await sessions.updateOne(
      { _id: objectId },
      {
        $set: {
          status: "completed",
          result: "defeat",
          boss,
          players,
          logs: updatedLogs,
          endedAt: new Date(),
          updatedAt: new Date(),
        },
        $unset: {
          actions: "",
          resolving: "",
        },
      }
    )

    const finalEmbed = await buildFinalEmbed(client, defeatSession, false, [])

    const payload = {
      content: "💀 Le boss a remporté le combat.",
      embeds: [finalEmbed],
      components: [],
    }

    if (interaction) await interaction.editReply(payload)
    else await updateBossMessage(client, lockedSession, payload)

    return true
  }

  const nextSession = {
    ...lockedSession,
    boss,
    players,
    logs: updatedLogs,
    round: (lockedSession.round || 1) + 1,
    actions: {},
  }

  await sessions.updateOne(
    { _id: objectId },
    {
      $set: {
        boss,
        players,
        logs: updatedLogs,
        round: nextSession.round,
        actions: {},
        updatedAt: new Date(),
      },
      $unset: {
        resolving: "",
      },
    }
  )

  const payload = {
    content: `✅ Tour ${lockedSession.round} résolu. Choisissez votre prochaine action.`,
    embeds: [buildBattleEmbed(nextSession, roundLogs)],
    components: buildBattleRows(sessionId),
  }

  if (interaction) await interaction.editReply(payload)
  else await updateBossMessage(client, lockedSession, payload)

  return true
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("boss")
    .setDescription("Lancer un combat de boss pour les joueurs")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName("rarete")
        .setDescription("Rareté du boss")
        .setRequired(true)
        .addChoices(
          { name: "Commun", value: "common" },
          { name: "Rare", value: "rare" },
          { name: "Épique", value: "epic" },
          { name: "Légendaire", value: "legendary" },
          { name: "Mythique", value: "mythic" }
        )
    )
    .addIntegerOption((option) =>
      option
        .setName("duree")
        .setDescription("Temps pour rejoindre l'événement")
        .setRequired(false)
        .addChoices(
          { name: "1 minute", value: 60 },
          { name: "2 minutes", value: 120 },
          { name: "3 minutes", value: 180 },
          { name: "5 minutes", value: 300 }
        )
    ),

  async execute(interaction, client) {
    await interaction.deferReply()

    const rarity = interaction.options.getString("rarete")
    const durationSeconds = interaction.options.getInteger("duree") || DEFAULT_JOIN_SECONDS
    const now = new Date()
    const joinEndsAt = new Date(now.getTime() + durationSeconds * 1000)
    const config = getBossConfig(rarity)

    const session = {
      type: "boss",
      status: "recruiting",
      rarity,
      bossName: config.bossName,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      messageId: null,
      createdBy: interaction.user.id,
      players: [],
      createdAt: now,
      joinEndsAt,
      updatedAt: now,
    }

    const result = await client.db.collection("boss_sessions").insertOne(session)
    const sessionId = result.insertedId.toString()
    const savedSession = {
      ...session,
      _id: result.insertedId,
    }

    function buildLobbyEmbed({ session, clientUser }) {
  const config = getBossConfig(session.rarity)
  const players = session.players || []
  const remainingMs = new Date(session.joinEndsAt).getTime() - Date.now()

  const playerLines = players.length
    ? players.map((player, index) => {
        return `**${index + 1}.** <@${player.userId}> — ⭐ **${player.cardName}**`
      }).join("\n")
    : "Aucun joueur inscrit pour le moment."

  const embed = new EmbedBuilder()
    .setTitle(`${config.emoji} Boss ${config.label} — ${config.bossName}`)
    .setColor(config.color)
    .setDescription(
      `${config.description}\n\n` +
      `**Spécialité :** ${config.specialty}\n` +
      `Les joueurs utilisent leur **carte favorite**.\n` +
      `Minimum : **${MIN_PLAYERS}** joueurs — Maximum : **${MAX_PLAYERS}** joueurs.\n` +
      `Temps restant pour rejoindre : **${formatRemainingTime(remainingMs)}**.`
    )
    .addFields(
      {
        name: `Participants ${players.length}/${MAX_PLAYERS}`,
        value: playerLines,
        inline: false,
      },
      {
        name: "Actions en combat",
        value:
          "⚔️ **Attaquer** : inflige des dégâts au boss.\n" +
          "🛡️ **Défendre** : réduit fortement les dégâts reçus.\n" +
          "💨 **Esquiver** : tente d'éviter complètement l'attaque du boss.",
        inline: false,
      }
    )
    .setFooter({
      text: clientUser ? `Boss lancé par ${clientUser.username}` : "Événement boss",
    })
    .setTimestamp()

  if (config.image) {
    embed.setThumbnail(config.image)
  }

  return embed
}

    const message = await interaction.editReply({
      content: "📣 Un combat de boss est ouvert ! Cliquez sur **Rejoindre** pour participer.",
      embeds: [embed],
      components: buildLobbyRows(sessionId),
    })

    await client.db.collection("boss_sessions").updateOne(
      { _id: result.insertedId },
      {
        $set: {
          messageId: message.id,
        },
      }
    )

    scheduleBossAutoStart(client, sessionId, durationSeconds * 1000)
  },

  async handleButton(interaction, client) {
    if (!interaction.customId.startsWith("boss:")) return

    const parts = interaction.customId.split(":")
    const action = parts[1]
    const sessionId = parts[2]
    const objectId = getSessionObjectId(sessionId)

    if (!objectId) {
      return interaction.reply({
        content: "❌ Session de boss invalide.",
        ephemeral: true,
      })
    }

    const sessions = client.db.collection("boss_sessions")
    const session = await sessions.findOne({ _id: objectId })

    if (!session) {
      return interaction.reply({
        content: "❌ Ce boss n'existe plus.",
        ephemeral: true,
      })
    }

    if (action === "join") {
      if (session.status !== "recruiting") {
        return interaction.reply({
          content: "❌ Les inscriptions sont fermées.",
          ephemeral: true,
        })
      }

      if (new Date(session.joinEndsAt).getTime() < Date.now()) {
        return interaction.reply({
          content: "⏳ Le temps pour rejoindre ce boss est terminé.",
          ephemeral: true,
        })
      }

      if ((session.players || []).some((player) => player.userId === interaction.user.id)) {
        return interaction.reply({
          content: "❌ Tu as déjà rejoint ce boss.",
          ephemeral: true,
        })
      }

      if ((session.players || []).length >= MAX_PLAYERS) {
        return interaction.reply({
          content: `❌ Ce boss a déjà **${MAX_PLAYERS}** joueurs.`,
          ephemeral: true,
        })
      }

      const favorite = await getFavoriteCombatCard(client, interaction.user.id)

      if (!favorite.success) {
        return interaction.reply({
          content: favorite.message,
          ephemeral: true,
        })
      }

      await interaction.deferUpdate()

      await sessions.updateOne(
        {
          _id: objectId,
          status: "recruiting",
          "players.userId": { $ne: interaction.user.id },
        },
        {
          $push: {
            players: {
              userId: interaction.user.id,
              cardKey: favorite.card.key,
              cardName: favorite.card.name,
              joinedAt: new Date(),
            },
          },
          $set: {
            updatedAt: new Date(),
          },
        }
      )

      const updatedSession = await sessions.findOne({ _id: objectId })

      if ((updatedSession.players || []).length >= MAX_PLAYERS) {
        return startBossSession(client, sessionId, { interaction })
      }

      return interaction.editReply({
        content: "📣 Un combat de boss est ouvert ! Cliquez sur **Rejoindre** pour participer.",
        embeds: [buildLobbyEmbed({ session: updatedSession })],
        components: buildLobbyRows(sessionId),
      })
    }

    if (action === "leave") {
      if (session.status !== "recruiting") {
        return interaction.reply({
          content: "❌ Tu ne peux plus quitter : le combat a déjà commencé.",
          ephemeral: true,
        })
      }

      if (!(session.players || []).some((player) => player.userId === interaction.user.id)) {
        return interaction.reply({
          content: "❌ Tu n'es pas inscrit à ce boss.",
          ephemeral: true,
        })
      }

      await interaction.deferUpdate()

      await sessions.updateOne(
        { _id: objectId },
        {
          $pull: {
            players: {
              userId: interaction.user.id,
            },
          },
          $set: {
            updatedAt: new Date(),
          },
        }
      )

      const updatedSession = await sessions.findOne({ _id: objectId })

      return interaction.editReply({
        content: "📣 Un combat de boss est ouvert ! Cliquez sur **Rejoindre** pour participer.",
        embeds: [buildLobbyEmbed({ session: updatedSession })],
        components: buildLobbyRows(sessionId),
      })
    }

    if (action === "start") {
      if (!isAdminForSession(interaction, session)) {
        return interaction.reply({
          content: "❌ Seul l'admin qui a lancé le boss ou un administrateur peut démarrer le combat.",
          ephemeral: true,
        })
      }

      if (session.status !== "recruiting") {
        return interaction.reply({
          content: "❌ Ce boss n'est plus en phase d'inscription.",
          ephemeral: true,
        })
      }

      await interaction.deferUpdate()

      return startBossSession(client, sessionId, { interaction })
    }

    if (action === "cancel") {
      if (!isAdminForSession(interaction, session)) {
        return interaction.reply({
          content: "❌ Seul l'admin qui a lancé le boss ou un administrateur peut annuler le combat.",
          ephemeral: true,
        })
      }

      if (session.status !== "recruiting") {
        return interaction.reply({
          content: "❌ Ce boss ne peut plus être annulé.",
          ephemeral: true,
        })
      }

      await interaction.deferUpdate()

      await sessions.updateOne(
        { _id: objectId },
        {
          $set: {
            status: "cancelled",
            cancelReason: "admin_cancelled",
            updatedAt: new Date(),
          },
        }
      )

      return interaction.editReply({
        content: "❌ Le combat de boss a été annulé.",
        embeds: [],
        components: [],
      })
    }

    if (action === "action") {
      const battleAction = parts[3]

      if (session.status !== "active") {
        return interaction.reply({
          content: "❌ Ce combat de boss n'est pas actif.",
          ephemeral: true,
        })
      }

      const player = getPlayer(session, interaction.user.id)

      if (!player) {
        return interaction.reply({
          content: "❌ Tu ne participes pas à ce boss.",
          ephemeral: true,
        })
      }

      if ((player.currentHp || 0) <= 0) {
        return interaction.reply({
          content: "💀 Tu es K.O. et tu ne peux plus choisir d'action.",
          ephemeral: true,
        })
      }

      if (!["attack", "defend", "dodge"].includes(battleAction)) {
        return interaction.reply({
          content: "❌ Action invalide.",
          ephemeral: true,
        })
      }

      await interaction.deferUpdate()

      await sessions.updateOne(
        {
          _id: objectId,
          status: "active",
        },
        {
          $set: {
            [`actions.${interaction.user.id}`]: {
              action: battleAction,
              selectedAt: new Date(),
            },
            updatedAt: new Date(),
          },
        }
      )

      return resolveRoundIfReady(client, sessionId, interaction)
    }
  },
}
