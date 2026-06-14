const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js")

const { ObjectId } = require("mongodb")
const arcaneCards = require("../../data/arcaneCards")

const {
  getCardStats,
  getStatsForBattle,
  simulateBattleWithCustomStats,
  generatePveEnemy,
  getPveWinReward,
  getPveLossPenalty,
  getPvpTransferAmount,
  addFragments,
  removeFragments,
  transferFragments,
  updateCombatStats,
} = require("../../utils/cardBattle")

const PVE_COOLDOWN_MS = 30 * 60 * 1000

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

function getCardFromCatalog(cardKey) {
  return arcaneCards.find((card) => card.key === cardKey)
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

async function checkPveCooldown(client, userId) {
  const cooldown = await client.db.collection("combat_cooldowns").findOne({
    userId,
    type: "pve",
  })

  if (!cooldown || !cooldown.lastCombatAt) {
    return {
      allowed: true,
      remainingMs: 0,
    }
  }

  const lastCombatAt = new Date(cooldown.lastCombatAt).getTime()
  const now = Date.now()
  const elapsed = now - lastCombatAt
  const remainingMs = PVE_COOLDOWN_MS - elapsed

  return {
    allowed: remainingMs <= 0,
    remainingMs: Math.max(0, remainingMs),
  }
}

async function setPveCooldown(client, userId) {
  await client.db.collection("combat_cooldowns").updateOne(
    {
      userId,
      type: "pve",
    },
    {
      $set: {
        userId,
        type: "pve",
        lastCombatAt: new Date(),
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

function buildShortLogs(logs) {
  return logs
    .slice(0, 8)
    .map((log) => {
      return `**Tour ${log.turn}** — ${log.attackerName} inflige **${log.damage}** dégâts à ${log.defenderName}. PV restants : **${log.defenderRemainingHp}**`
    })
    .join("\n")
}

async function getBestPlayerCard(client, userId) {
  const playerCards = await client.db.collection("player_cards")
    .find({
      userId,
    })
    .toArray()

  if (!playerCards.length) {
    return null
  }

  let bestCard = null
  let bestPower = -1

  for (const playerCard of playerCards) {
    const catalogCard = getCardFromCatalog(playerCard.cardKey)

    const card = catalogCard || {
      key: playerCard.cardKey,
      name: playerCard.cardName || playerCard.cardKey,
      characterName: playerCard.cardName || playerCard.cardKey,
      rarity: playerCard.rarity || "common",
      rarityLabel: playerCard.rarityLabel || "Commun",
      value: playerCard.value || 0,
      image: playerCard.image || "",
      description: playerCard.description || "",
    }

    const stats = getCardStats(card)

    if (stats.power > bestPower) {
      bestPower = stats.power
      bestCard = card
    }
  }

  return bestCard
}

function buildPveEmbed({
  interaction,
  playerCard,
  enemy,
  battle,
  hasWon,
  reward,
  penalty,
  economyResult,
}) {
  const playerStats = getCardStats(playerCard)
  const enemyStats = getStatsForBattle(enemy)

  const emoji = RARITY_EMOJIS[playerCard.rarity] || "🎴"

  const resultText = hasWon
    ? `✅ **Victoire !** Tu gagnes 💠 **${reward}** fragment${reward > 1 ? "s" : ""}.`
    : `❌ **Défaite.** Tu perds 💠 **${economyResult.removed}** fragment${economyResult.removed > 1 ? "s" : ""} sur ${penalty} possible${penalty > 1 ? "s" : ""}.`

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ Combat PVE — ${interaction.user.username}`)
    .setColor(hasWon ? 0x2ecc71 : 0xe74c3c)
    .setDescription(
      `${emoji} **${playerCard.name}** affronte **${enemy.name}**.\n\n${resultText}`
    )
    .addFields(
      {
        name: `🎴 ${playerCard.name}`,
        value:
          `Rareté : **${playerCard.rarityLabel || playerCard.rarity}**\n` +
          `❤️ PV : **${playerStats.hp}**\n` +
          `⚔️ ATK : **${playerStats.attack}**\n` +
          `🛡️ DEF : **${playerStats.defense}**\n` +
          `💨 VIT : **${playerStats.speed}**\n` +
          `⚡ Puissance : **${playerStats.power}**`,
        inline: true,
      },
      {
        name: `👾 ${enemy.name}`,
        value:
          `Niveau : **${enemy.rarityLabel || enemy.rarity}**\n` +
          `❤️ PV : **${enemyStats.hp}**\n` +
          `⚔️ ATK : **${enemyStats.attack}**\n` +
          `🛡️ DEF : **${enemyStats.defense}**\n` +
          `💨 VIT : **${enemyStats.speed}**\n` +
          `⚡ Puissance : **${enemyStats.power}**`,
        inline: true,
      },
      {
        name: "📜 Déroulé du combat",
        value: buildShortLogs(battle.logs) || "Aucun log disponible.",
        inline: false,
      },
      {
        name: "🏁 Résultat",
        value:
          `Vainqueur : **${battle.winner.name}**\n` +
          `Tours : **${battle.turns}**\n` +
          `PV restants du vainqueur : **${battle.winnerRemainingHp}**`,
        inline: false,
      },
      {
        name: "💠 Fragments",
        value: hasWon
          ? `Avant : **${economyResult.before}**\nGagné : **${economyResult.added}**\nMaintenant : **${economyResult.after}**`
          : `Avant : **${economyResult.before}**\nPerdu : **${economyResult.removed}**\nMaintenant : **${economyResult.after}**`,
        inline: false,
      }
    )
    .setFooter({
      text: "Cooldown PVE : 30 minutes",
    })
    .setTimestamp()

  if (playerCard.image) {
    embed.setThumbnail(playerCard.image)
  }

  return embed
}

function buildPvpChallengeEmbed({
  challenger,
  opponent,
  challengerCard,
  challengerName,
  opponentName,
}) {
  const stats = getCardStats(challengerCard)
  const emoji = RARITY_EMOJIS[challengerCard.rarity] || "🎴"

  const embed = new EmbedBuilder()
    .setTitle("⚔️ Défi PVP")
    .setColor(RARITY_COLORS[challengerCard.rarity] || 0x5865f2)
    .setDescription(
      `${challenger} défie ${opponent} en combat de cartes !\n\n` +
      `**${opponentName}**, accepte ou refuse le combat.`
    )
    .addFields(
      {
        name: "Challenger",
        value: challengerName,
        inline: true,
      },
      {
        name: "Adversaire",
        value: opponentName,
        inline: true,
      },
      {
        name: `${emoji} Carte utilisée`,
        value:
          `**${challengerCard.name}**\n` +
          `Rareté : **${challengerCard.rarityLabel || challengerCard.rarity}**\n` +
          `❤️ PV : **${stats.hp}**\n` +
          `⚔️ ATK : **${stats.attack}**\n` +
          `🛡️ DEF : **${stats.defense}**\n` +
          `💨 VIT : **${stats.speed}**\n` +
          `⚡ Puissance : **${stats.power}**`,
        inline: false,
      }
    )
    .setFooter({
      text: "Le joueur défié combattra avec sa meilleure carte.",
    })
    .setTimestamp()

  if (challengerCard.image) {
    embed.setThumbnail(challengerCard.image)
  }

  return embed
}

function buildPvpButtons(sessionId) {
  const acceptButton = new ButtonBuilder()
    .setCustomId(`combat:pvp_accept:${sessionId}`)
    .setLabel("✅ Accepter")
    .setStyle(ButtonStyle.Success)

  const refuseButton = new ButtonBuilder()
    .setCustomId(`combat:pvp_refuse:${sessionId}`)
    .setLabel("❌ Refuser")
    .setStyle(ButtonStyle.Danger)

  return new ActionRowBuilder().addComponents(acceptButton, refuseButton)
}

async function buildPvpResultEmbed({
  client,
  guild,
  challengerId,
  opponentId,
  challengerCard,
  opponentCard,
  battle,
  transferResult,
}) {
  const challengerName = await getDisplayName(client, guild, challengerId)
  const opponentName = await getDisplayName(client, guild, opponentId)

  const challengerStats = getCardStats(challengerCard)
  const opponentStats = getCardStats(opponentCard)

  const challengerWon = battle.winnerSide === "A"

  const winnerName = challengerWon ? challengerName : opponentName
  const loserName = challengerWon ? opponentName : challengerName

  const embed = new EmbedBuilder()
    .setTitle("🏆 Résultat du combat PVP")
    .setColor(challengerWon ? 0x2ecc71 : 0xe67e22)
    .setDescription(
      `**${winnerName}** remporte le combat contre **${loserName}** !\n\n` +
      `💠 **${transferResult.transferred}** fragment${transferResult.transferred > 1 ? "s" : ""} transféré${transferResult.transferred > 1 ? "s" : ""} du perdant vers le gagnant.`
    )
    .addFields(
      {
        name: `⚔️ ${challengerName}`,
        value:
          `Carte : **${challengerCard.name}**\n` +
          `Rareté : **${challengerCard.rarityLabel || challengerCard.rarity}**\n` +
          `❤️ PV : **${challengerStats.hp}**\n` +
          `⚔️ ATK : **${challengerStats.attack}**\n` +
          `🛡️ DEF : **${challengerStats.defense}**\n` +
          `💨 VIT : **${challengerStats.speed}**\n` +
          `⚡ Puissance : **${challengerStats.power}**`,
        inline: true,
      },
      {
        name: `🛡️ ${opponentName}`,
        value:
          `Carte : **${opponentCard.name}**\n` +
          `Rareté : **${opponentCard.rarityLabel || opponentCard.rarity}**\n` +
          `❤️ PV : **${opponentStats.hp}**\n` +
          `⚔️ ATK : **${opponentStats.attack}**\n` +
          `🛡️ DEF : **${opponentStats.defense}**\n` +
          `💨 VIT : **${opponentStats.speed}**\n` +
          `⚡ Puissance : **${opponentStats.power}**`,
        inline: true,
      },
      {
        name: "📜 Déroulé du combat",
        value: buildShortLogs(battle.logs) || "Aucun log disponible.",
        inline: false,
      },
      {
        name: "🏁 Résultat",
        value:
          `Vainqueur : **${battle.winner.name}**\n` +
          `Tours : **${battle.turns}**\n` +
          `PV restants du vainqueur : **${battle.winnerRemainingHp}**`,
        inline: false,
      },
      {
        name: "💠 Fragments transférés",
        value:
          `Montant prévu : **${transferResult.requested}**\n` +
          `Montant transféré : **${transferResult.transferred}**\n` +
          `Le perdant ne peut pas descendre sous **0** fragment.`,
        inline: false,
      }
    )
    .setTimestamp()

  if (battle.winner.image) {
    embed.setThumbnail(battle.winner.image)
  }

  return embed
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("combat")
    .setDescription("Combattre avec tes cartes Arcane")

    .addSubcommand((subcommand) =>
      subcommand
        .setName("pve")
        .setDescription("Combattre un ennemi généré par le bot")
        .addStringOption((option) =>
          option
            .setName("carte")
            .setDescription("Nom ou ID de la carte que tu veux utiliser")
            .setRequired(true)
        )
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName("pvp")
        .setDescription("Défier un joueur en combat de cartes")
        .addUserOption((option) =>
          option
            .setName("adversaire")
            .setDescription("Joueur à défier")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("carte")
            .setDescription("Nom ou ID de la carte que tu veux utiliser")
            .setRequired(true)
        )
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand()

    if (subcommand === "pve") {
      const cooldown = await checkPveCooldown(client, interaction.user.id)

      if (!cooldown.allowed) {
        return interaction.reply({
          content: `⏳ Tu dois attendre encore **${formatRemainingTime(cooldown.remainingMs)}** avant de refaire un combat PVE.`,
          ephemeral: true,
        })
      }

      const search = interaction.options.getString("carte")
      const playerCard = findCard(search)

      if (!playerCard) {
        return interaction.reply({
          content: `❌ Aucune carte trouvée pour : **${search}**.`,
          ephemeral: true,
        })
      }

      const ownedCard = await client.db.collection("player_cards").findOne({
        userId: interaction.user.id,
        cardKey: playerCard.key,
      })

      if (!ownedCard) {
        return interaction.reply({
          content: `❌ Tu ne possèdes pas cette carte : **${playerCard.name}**.`,
          ephemeral: true,
        })
      }

      const enemy = generatePveEnemy(playerCard)
      const battle = simulateBattleWithCustomStats(playerCard, enemy)

      const hasWon = battle.winnerSide === "A"

      let reward = 0
      let penalty = 0
      let economyResult = null

      if (hasWon) {
        reward = getPveWinReward(playerCard)
        economyResult = await addFragments(client, interaction.user.id, reward)

        await updateCombatStats(client, interaction.user.id, {
          mode: "pve",
          result: "win",
          fragmentsWon: economyResult.added,
        })
      } else {
        penalty = getPveLossPenalty(playerCard)
        economyResult = await removeFragments(client, interaction.user.id, penalty)

        await updateCombatStats(client, interaction.user.id, {
          mode: "pve",
          result: "loss",
          fragmentsLost: economyResult.removed,
        })
      }

      await setPveCooldown(client, interaction.user.id)

      const embed = buildPveEmbed({
        interaction,
        playerCard,
        enemy,
        battle,
        hasWon,
        reward,
        penalty,
        economyResult,
      })

      return interaction.reply({
        embeds: [embed],
      })
    }

    if (subcommand === "pvp") {
      const opponent = interaction.options.getUser("adversaire")
      const search = interaction.options.getString("carte")

      if (opponent.bot) {
        return interaction.reply({
          content: "❌ Tu ne peux pas défier un bot.",
          ephemeral: true,
        })
      }

      if (opponent.id === interaction.user.id) {
        return interaction.reply({
          content: "❌ Tu ne peux pas te défier toi-même.",
          ephemeral: true,
        })
      }

      const challengerCard = findCard(search)

      if (!challengerCard) {
        return interaction.reply({
          content: `❌ Aucune carte trouvée pour : **${search}**.`,
          ephemeral: true,
        })
      }

      const ownedCard = await client.db.collection("player_cards").findOne({
        userId: interaction.user.id,
        cardKey: challengerCard.key,
      })

      if (!ownedCard) {
        return interaction.reply({
          content: `❌ Tu ne possèdes pas cette carte : **${challengerCard.name}**.`,
          ephemeral: true,
        })
      }

      const opponentBestCard = await getBestPlayerCard(client, opponent.id)

      if (!opponentBestCard) {
        return interaction.reply({
          content: `❌ ${opponent} ne possède aucune carte et ne peut donc pas combattre.`,
          ephemeral: true,
        })
      }

      const session = {
        type: "pvp",
        challengerId: interaction.user.id,
        opponentId: opponent.id,
        challengerCardKey: challengerCard.key,
        status: "pending",
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      }

      const result = await client.db.collection("combat_sessions").insertOne(session)

      const challengerName = await getDisplayName(client, interaction.guild, interaction.user.id)
      const opponentName = await getDisplayName(client, interaction.guild, opponent.id)

      const embed = buildPvpChallengeEmbed({
        challenger: interaction.user,
        opponent,
        challengerCard,
        challengerName,
        opponentName,
      })

      const row = buildPvpButtons(result.insertedId.toString())

      return interaction.reply({
        content: `${opponent}, tu as reçu un défi PVP !`,
        embeds: [embed],
        components: [row],
      })
    }
  },

  async handleButton(interaction, client) {
    if (!interaction.customId.startsWith("combat:")) return

    const parts = interaction.customId.split(":")
    const action = parts[1]
    const sessionId = parts[2]

    if (!ObjectId.isValid(sessionId)) {
      return interaction.reply({
        content: "❌ Session de combat invalide.",
        ephemeral: true,
      })
    }

    const sessions = client.db.collection("combat_sessions")

    const session = await sessions.findOne({
      _id: new ObjectId(sessionId),
    })

    if (!session) {
      return interaction.reply({
        content: "❌ Ce combat n'existe plus.",
        ephemeral: true,
      })
    }

    if (session.status !== "pending") {
      return interaction.reply({
        content: "❌ Ce combat a déjà été traité.",
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
        content: "⏳ Ce défi PVP a expiré.",
        embeds: [],
        components: [],
      })
    }

    if (interaction.user.id !== session.opponentId) {
      return interaction.reply({
        content: "❌ Seul le joueur défié peut répondre à ce combat.",
        ephemeral: true,
      })
    }

    if (action === "pvp_refuse") {
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
        content: "❌ Le défi PVP a été refusé.",
        embeds: [],
        components: [],
      })
    }

    if (action === "pvp_accept") {
      const challengerCard = getCardFromCatalog(session.challengerCardKey)

      if (!challengerCard) {
        await sessions.updateOne(
          {
            _id: new ObjectId(sessionId),
          },
          {
            $set: {
              status: "error",
              updatedAt: new Date(),
            },
          }
        )

        return interaction.update({
          content: "❌ La carte du challenger est introuvable dans le catalogue.",
          embeds: [],
          components: [],
        })
      }

      const stillOwnsCard = await client.db.collection("player_cards").findOne({
        userId: session.challengerId,
        cardKey: challengerCard.key,
      })

      if (!stillOwnsCard) {
        await sessions.updateOne(
          {
            _id: new ObjectId(sessionId),
          },
          {
            $set: {
              status: "cancelled",
              updatedAt: new Date(),
            },
          }
        )

        return interaction.update({
          content: "❌ Le challenger ne possède plus cette carte. Combat annulé.",
          embeds: [],
          components: [],
        })
      }

      const opponentCard = await getBestPlayerCard(client, session.opponentId)

      if (!opponentCard) {
        await sessions.updateOne(
          {
            _id: new ObjectId(sessionId),
          },
          {
            $set: {
              status: "cancelled",
              updatedAt: new Date(),
            },
          }
        )

        return interaction.update({
          content: "❌ Le joueur défié ne possède aucune carte. Combat annulé.",
          embeds: [],
          components: [],
        })
      }

      const battle = simulateBattleWithCustomStats(challengerCard, opponentCard)

      const challengerWon = battle.winnerSide === "A"

      const winnerId = challengerWon ? session.challengerId : session.opponentId
      const loserId = challengerWon ? session.opponentId : session.challengerId
      const winnerCard = challengerWon ? challengerCard : opponentCard

      const transferAmount = getPvpTransferAmount(winnerCard)
      const transferResult = await transferFragments(
        client,
        loserId,
        winnerId,
        transferAmount
      )

      await updateCombatStats(client, winnerId, {
        mode: "pvp",
        result: "win",
        fragmentsWon: transferResult.transferred,
      })

      await updateCombatStats(client, loserId, {
        mode: "pvp",
        result: "loss",
        fragmentsLost: transferResult.transferred,
      })

      await sessions.updateOne(
        {
          _id: new ObjectId(sessionId),
        },
        {
          $set: {
            status: "completed",
            opponentCardKey: opponentCard.key,
            winnerUserId: winnerId,
            loserUserId: loserId,
            winnerCardKey: battle.winner.key,
            loserCardKey: battle.loser.key,
            fragmentsTransferred: transferResult.transferred,
            turns: battle.turns,
            updatedAt: new Date(),
          },
        }
      )

      const embed = await buildPvpResultEmbed({
        client,
        guild: interaction.guild,
        challengerId: session.challengerId,
        opponentId: session.opponentId,
        challengerCard,
        opponentCard,
        battle,
        transferResult,
      })

      return interaction.update({
        content: "⚔️ Le combat PVP est terminé !",
        embeds: [embed],
        components: [],
      })
    }
  },
}