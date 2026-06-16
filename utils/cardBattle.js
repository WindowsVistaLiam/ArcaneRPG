const BASE_STATS_BY_RARITY = {
  common: { hp: 100, attack: 18, defense: 8, speed: 10 },
  rare: { hp: 140, attack: 28, defense: 14, speed: 16 },
  epic: { hp: 190, attack: 42, defense: 22, speed: 24 },
  legendary: { hp: 260, attack: 62, defense: 34, speed: 34 },
  mythic: { hp: 360, attack: 90, defense: 50, speed: 48 },
}

const LEVEL_MULTIPLIERS = {
  1: 0,
  2: 0.05,
  3: 0.10,
  4: 0.15,
  5: 0.25,
}

const MAX_LEVEL = 5

const PVE_WIN_REWARDS_BY_RARITY = {
  common: 3,
  rare: 7,
  epic: 14,
  legendary: 28,
  mythic: 55,
}

const PVE_LOSS_PENALTIES_BY_RARITY = {
  common: 1,
  rare: 2,
  epic: 4,
  legendary: 8,
  mythic: 15,
}

const PVP_TRANSFER_BY_RARITY = {
  common: 3,
  rare: 7,
  epic: 14,
  legendary: 28,
  mythic: 55,
}

function calculatePower(stats) {
  return stats.hp + stats.attack * 3 + stats.defense * 2 + stats.speed * 2
}

function normalizeStats(stats) {
  const normalized = {
    hp: Math.max(1, Math.round(stats.hp || 1)),
    attack: Math.max(1, Math.round(stats.attack || 1)),
    defense: Math.max(0, Math.round(stats.defense || 0)),
    speed: Math.max(1, Math.round(stats.speed || 1)),
  }

  return {
    ...normalized,
    power: calculatePower(normalized),
  }
}

function getCardStats(card) {
  if (card?.battleStats) {
    return normalizeStats(card.battleStats)
  }

  if (
    card?.hp !== undefined &&
    card?.attack !== undefined &&
    card?.defense !== undefined &&
    card?.speed !== undefined
  ) {
    return normalizeStats({
      hp: card.hp,
      attack: card.attack,
      defense: card.defense,
      speed: card.speed,
    })
  }

  const baseStats = BASE_STATS_BY_RARITY[card?.rarity] || BASE_STATS_BY_RARITY.common
  const fusionBonusPercent = Number(card?.fusionBonusPercent || 0)
  const fusionMultiplier = 1 + fusionBonusPercent / 100

  return normalizeStats({
    hp: Math.round(baseStats.hp * fusionMultiplier),
    attack: Math.round(baseStats.attack * fusionMultiplier),
    defense: Math.round(baseStats.defense * fusionMultiplier),
    speed: Math.round(baseStats.speed * fusionMultiplier),
  })
}

function getStatsForBattle(card) {
  if (card.battleStats) {
    return normalizeStats(card.battleStats)
  }

  if (
    card.hp !== undefined ||
    card.attack !== undefined ||
    card.defense !== undefined ||
    card.speed !== undefined
  ) {
    return normalizeStats({
      hp: card.hp,
      attack: card.attack,
      defense: card.defense,
      speed: card.speed,
    })
  }

  return getCardStats(card)
}

async function getCardUpgrade(client, userId, cardKey) {
  if (!client?.db || !userId || !cardKey) {
    return {
      level: 1,
      hpBonus: 0,
      attackBonus: 0,
      defenseBonus: 0,
      speedBonus: 0,
    }
  }

  const upgrade = await client.db.collection("player_card_upgrades").findOne({
    userId,
    cardKey,
  })

  return {
    level: upgrade?.level || 1,
    hpBonus: upgrade?.hpBonus || 0,
    attackBonus: upgrade?.attackBonus || 0,
    defenseBonus: upgrade?.defenseBonus || 0,
    speedBonus: upgrade?.speedBonus || 0,
  }
}

function applyUpgradeToStats(baseStats, upgrade = {}) {
  const level = Math.min(Math.max(upgrade.level || 1, 1), MAX_LEVEL)
  const multiplier = LEVEL_MULTIPLIERS[level] || 0

  const stats = {
    hp: Math.round(baseStats.hp * (1 + multiplier)) + (upgrade.hpBonus || 0),
    attack: Math.round(baseStats.attack * (1 + multiplier)) + (upgrade.attackBonus || 0),
    defense: Math.round(baseStats.defense * (1 + multiplier)) + (upgrade.defenseBonus || 0),
    speed: Math.round(baseStats.speed * (1 + multiplier)) + (upgrade.speedBonus || 0),
  }

  return normalizeStats(stats)
}

async function getCardStatsWithUpgrade(client, userId, card) {
  const baseStats = getCardStats(card)
  const upgrade = await getCardUpgrade(client, userId, card.key)

  return applyUpgradeToStats(baseStats, upgrade)
}

async function getStatsForBattleWithUpgrade(client, userId, card) {
  if (card.battleStats) {
    return getStatsForBattle(card)
  }

  return getCardStatsWithUpgrade(client, userId, card)
}

function calculateDamage(attackerStats, defenderStats) {
  const randomMultiplier = 0.85 + Math.random() * 0.3
  const rawDamage = attackerStats.attack * randomMultiplier - defenderStats.defense * 0.45
  const minimumDamage = Math.max(1, Math.round(attackerStats.attack * 0.2))

  return Math.max(minimumDamage, Math.round(rawDamage))
}

function getBattleName(card) {
  return card.name || card.cardName || card.characterName || card.key || "Carte inconnue"
}

function simulateBattleWithResolvedStats(cardA, statsA, cardB, statsB) {
  let hpA = statsA.hp
  let hpB = statsB.hp

  const logs = []
  let turn = 1

  let attackerSide = statsA.speed >= statsB.speed ? "A" : "B"

  while (hpA > 0 && hpB > 0 && turn <= 40) {
    const attackerCard = attackerSide === "A" ? cardA : cardB
    const defenderCard = attackerSide === "A" ? cardB : cardA

    const attackerStats = attackerSide === "A" ? statsA : statsB
    const defenderStats = attackerSide === "A" ? statsB : statsA

    const damage = calculateDamage(attackerStats, defenderStats)

    if (attackerSide === "A") {
      hpB = Math.max(0, hpB - damage)

      logs.push({
        turn,
        attackerSide: "A",
        defenderSide: "B",
        attackerName: getBattleName(attackerCard),
        defenderName: getBattleName(defenderCard),
        damage,
        defenderRemainingHp: hpB,
      })
    } else {
      hpA = Math.max(0, hpA - damage)

      logs.push({
        turn,
        attackerSide: "B",
        defenderSide: "A",
        attackerName: getBattleName(attackerCard),
        defenderName: getBattleName(defenderCard),
        damage,
        defenderRemainingHp: hpA,
      })
    }

    if (hpA <= 0 || hpB <= 0) break

    attackerSide = attackerSide === "A" ? "B" : "A"
    turn += 1
  }

  let winnerSide = null

  if (hpA > hpB) {
    winnerSide = "A"
  } else if (hpB > hpA) {
    winnerSide = "B"
  } else {
    winnerSide = statsA.power >= statsB.power ? "A" : "B"
  }

  const loserSide = winnerSide === "A" ? "B" : "A"

  return {
    winnerSide,
    loserSide,
    winner: winnerSide === "A" ? cardA : cardB,
    loser: winnerSide === "A" ? cardB : cardA,
    winnerStats: winnerSide === "A" ? statsA : statsB,
    loserStats: winnerSide === "A" ? statsB : statsA,
    winnerRemainingHp: winnerSide === "A" ? hpA : hpB,
    loserRemainingHp: winnerSide === "A" ? hpB : hpA,
    turns: logs.length,
    logs,
  }
}

function simulateBattle(cardA, cardB) {
  return simulateBattleWithResolvedStats(
    cardA,
    getCardStats(cardA),
    cardB,
    getCardStats(cardB)
  )
}

function simulateBattleWithCustomStats(cardA, cardB) {
  return simulateBattleWithResolvedStats(
    cardA,
    getStatsForBattle(cardA),
    cardB,
    getStatsForBattle(cardB)
  )
}

async function simulateBattleWithUpgrades(client, userAId, cardA, userBId, cardB) {
  const statsA = await getStatsForBattleWithUpgrade(client, userAId, cardA)
  const statsB = await getStatsForBattleWithUpgrade(client, userBId, cardB)

  return simulateBattleWithResolvedStats(cardA, statsA, cardB, statsB)
}

function generatePveEnemy(playerCard) {
  const baseStats = getCardStats(playerCard)

  const difficulty = 0.85 + Math.random() * 0.25

  const enemyStats = normalizeStats({
    hp: baseStats.hp * difficulty,
    attack: baseStats.attack * difficulty,
    defense: baseStats.defense * difficulty,
    speed: baseStats.speed * difficulty,
  })

  const enemyNames = [
    "Garde corrompu",
    "Mercenaire de Zaun",
    "Sentinelle Hextech",
    "Ombre des bas-fonds",
    "Combattant shimmer",
  ]

  const enemyName = enemyNames[Math.floor(Math.random() * enemyNames.length)]

  return {
    key: `pve_enemy_${Date.now()}`,
    name: enemyName,
    characterName: enemyName,
    rarity: playerCard.rarity || "common",
    rarityLabel: "Ennemi PVE",
    image: "",
    battleStats: enemyStats,
  }
}

function getPveWinReward(card) {
  return PVE_WIN_REWARDS_BY_RARITY[card.rarity] || PVE_WIN_REWARDS_BY_RARITY.common
}

function getPveLossPenalty(card) {
  return PVE_LOSS_PENALTIES_BY_RARITY[card.rarity] || PVE_LOSS_PENALTIES_BY_RARITY.common
}

function getPveReward(card, hasWon) {
  return hasWon ? getPveWinReward(card) : -getPveLossPenalty(card)
}

function getPvpTransferAmount(winnerCard) {
  return PVP_TRANSFER_BY_RARITY[winnerCard.rarity] || PVP_TRANSFER_BY_RARITY.common
}

async function getWalletFragments(client, userId) {
  const wallet = await client.db.collection("player_wallets").findOne({
    userId,
  })

  return wallet?.fragments || 0
}

async function addFragments(client, userId, amount) {
  const before = await getWalletFragments(client, userId)
  const added = Math.max(0, amount)
  const after = before + added

  await client.db.collection("player_wallets").updateOne(
    {
      userId,
    },
    {
      $set: {
        userId,
        fragments: after,
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
    before,
    after,
    added,
  }
}

async function removeFragments(client, userId, amount) {
  const before = await getWalletFragments(client, userId)
  const requested = Math.max(0, amount)
  const removed = Math.min(before, requested)
  const after = before - removed

  await client.db.collection("player_wallets").updateOne(
    {
      userId,
    },
    {
      $set: {
        userId,
        fragments: after,
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
    before,
    after,
    requested,
    removed,
  }
}

async function transferFragments(client, fromUserId, toUserId, amount) {
  const fromBefore = await getWalletFragments(client, fromUserId)
  const toBefore = await getWalletFragments(client, toUserId)

  const requested = Math.max(0, amount)
  const transferred = Math.min(fromBefore, requested)

  const fromAfter = fromBefore - transferred
  const toAfter = toBefore + transferred

  await client.db.collection("player_wallets").updateOne(
    {
      userId: fromUserId,
    },
    {
      $set: {
        userId: fromUserId,
        fragments: fromAfter,
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

  await client.db.collection("player_wallets").updateOne(
    {
      userId: toUserId,
    },
    {
      $set: {
        userId: toUserId,
        fragments: toAfter,
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
    requested,
    transferred,
    fromBefore,
    fromAfter,
    toBefore,
    toAfter,
  }
}

async function updateCombatStats(client, userId, options = {}) {
  const mode = options.mode
  const result = options.result

  const inc = {
    fragmentsWon: options.fragmentsWon || 0,
    fragmentsLost: options.fragmentsLost || 0,
  }

  if (mode === "pve" && result === "win") inc.pveWins = 1
  if (mode === "pve" && result === "loss") inc.pveLosses = 1
  if (mode === "pvp" && result === "win") inc.pvpWins = 1
  if (mode === "pvp" && result === "loss") inc.pvpLosses = 1

  await client.db.collection("combat_stats").updateOne(
    {
      userId,
    },
    {
      $inc: inc,
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

module.exports = {
  BASE_STATS_BY_RARITY,
  LEVEL_MULTIPLIERS,
  MAX_LEVEL,

  getCardStats,
  getStatsForBattle,
  getCardUpgrade,
  applyUpgradeToStats,
  getCardStatsWithUpgrade,
  getStatsForBattleWithUpgrade,

  calculateDamage,
  simulateBattle,
  simulateBattleWithCustomStats,
  simulateBattleWithResolvedStats,
  simulateBattleWithUpgrades,

  generatePveEnemy,

  getPveWinReward,
  getPveLossPenalty,
  getPveReward,
  getPvpTransferAmount,

  getWalletFragments,
  addFragments,
  removeFragments,
  transferFragments,
  updateCombatStats,
}