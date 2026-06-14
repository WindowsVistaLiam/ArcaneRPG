const BASE_STATS_BY_RARITY = {
  common: {
    hp: 100,
    attack: 18,
    defense: 8,
    speed: 10,
  },
  rare: {
    hp: 140,
    attack: 28,
    defense: 14,
    speed: 16,
  },
  epic: {
    hp: 190,
    attack: 42,
    defense: 22,
    speed: 24,
  },
  legendary: {
    hp: 260,
    attack: 62,
    defense: 34,
    speed: 34,
  },
  mythic: {
    hp: 360,
    attack: 90,
    defense: 50,
    speed: 48,
  },
}

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

const PVE_ENEMY_MULTIPLIER_BY_RARITY = {
  common: 0.82,
  rare: 0.85,
  epic: 0.88,
  legendary: 0.92,
  mythic: 0.95,
}

function getBaseStatsByRarity(rarity) {
  return BASE_STATS_BY_RARITY[rarity] || BASE_STATS_BY_RARITY.common
}

function calculatePower(stats) {
  return (
    stats.hp +
    stats.attack * 3 +
    stats.defense * 2 +
    stats.speed * 2
  )
}

function getCardStats(card) {
  const baseStats = getBaseStatsByRarity(card.rarity)

  return {
    hp: baseStats.hp,
    attack: baseStats.attack,
    defense: baseStats.defense,
    speed: baseStats.speed,
    power: calculatePower(baseStats),
  }
}

function getStatsForBattle(card) {
  if (card.customStats) {
    const stats = {
      hp: card.customStats.hp,
      attack: card.customStats.attack,
      defense: card.customStats.defense,
      speed: card.customStats.speed,
    }

    return {
      ...stats,
      power: calculatePower(stats),
    }
  }

  return getCardStats(card)
}

function getRandomVariation(min = 0.9, max = 1.1) {
  return Math.random() * (max - min) + min
}

function calculateDamage(attackerStats, defenderStats) {
  const rawDamage = attackerStats.attack - defenderStats.defense / 2
  const variedDamage = rawDamage * getRandomVariation(0.9, 1.1)

  return Math.max(1, Math.round(variedDamage))
}

function simulateBattle(cardA, cardB) {
  return simulateBattleWithCustomStats(cardA, cardB)
}

function simulateBattleWithCustomStats(cardA, cardB) {
  const statsA = getStatsForBattle(cardA)
  const statsB = getStatsForBattle(cardB)

  const fighterA = {
    side: "A",
    card: cardA,
    stats: statsA,
    currentHp: statsA.hp,
  }

  const fighterB = {
    side: "B",
    card: cardB,
    stats: statsB,
    currentHp: statsB.hp,
  }

  const logs = []

  let attacker = statsA.speed >= statsB.speed ? fighterA : fighterB
  let defender = attacker === fighterA ? fighterB : fighterA

  let turn = 1
  const maxTurns = 20

  while (fighterA.currentHp > 0 && fighterB.currentHp > 0 && turn <= maxTurns) {
    const damage = calculateDamage(attacker.stats, defender.stats)

    defender.currentHp = Math.max(0, defender.currentHp - damage)

    logs.push({
      turn,
      attackerSide: attacker.side,
      defenderSide: defender.side,
      attackerName: attacker.card.name,
      defenderName: defender.card.name,
      damage,
      defenderRemainingHp: defender.currentHp,
    })

    if (defender.currentHp <= 0) {
      break
    }

    const temp = attacker
    attacker = defender
    defender = temp

    turn += 1
  }

  let winner = null
  let loser = null

  if (fighterA.currentHp > fighterB.currentHp) {
    winner = fighterA
    loser = fighterB
  } else if (fighterB.currentHp > fighterA.currentHp) {
    winner = fighterB
    loser = fighterA
  } else {
    if (statsA.power >= statsB.power) {
      winner = fighterA
      loser = fighterB
    } else {
      winner = fighterB
      loser = fighterA
    }
  }

  return {
    cardA,
    cardB,
    statsA,
    statsB,
    winner: winner.card,
    loser: loser.card,
    winnerSide: winner.side,
    loserSide: loser.side,
    winnerRemainingHp: winner.currentHp,
    loserRemainingHp: loser.currentHp,
    turns: logs.length,
    logs,
  }
}

function generatePveEnemy(card) {
  const playerStats = getCardStats(card)
  const multiplier = PVE_ENEMY_MULTIPLIER_BY_RARITY[card.rarity] || 0.85

  const enemies = {
    common: [
      "Voleur des bas-fonds",
      "Petit trafiquant de Zaun",
      "Recrue Enforcer",
    ],
    rare: [
      "Enforcer armé",
      "Sbire de chem-baron",
      "Combattant de rue",
    ],
    epic: [
      "Mutant shimmer",
      "Garde d'élite de Piltover",
      "Agent de Zaun renforcé",
    ],
    legendary: [
      "Champion des bas-fonds",
      "Exécuteur de chem-baron",
      "Prototype Hextech instable",
    ],
    mythic: [
      "Créature Hextech majeure",
      "Abomination au Shimmer",
      "Boss de Zaun",
    ],
  }

  const enemyPool = enemies[card.rarity] || enemies.common
  const enemyName = enemyPool[Math.floor(Math.random() * enemyPool.length)]

  return {
    key: `pve_enemy_${Date.now()}`,
    name: enemyName,
    characterName: enemyName,
    rarity: card.rarity,
    rarityLabel: card.rarityLabel || card.rarity,
    value: 0,
    description: "Un adversaire généré pour le combat PVE.",
    image: "",
    isPveEnemy: true,
    customStats: {
      hp: Math.round(playerStats.hp * multiplier),
      attack: Math.round(playerStats.attack * multiplier),
      defense: Math.round(playerStats.defense * multiplier),
      speed: Math.round(playerStats.speed * multiplier),
    },
  }
}

function getPveWinReward(card) {
  return PVE_WIN_REWARDS_BY_RARITY[card.rarity] || PVE_WIN_REWARDS_BY_RARITY.common
}

function getPveLossPenalty(card) {
  return PVE_LOSS_PENALTIES_BY_RARITY[card.rarity] || PVE_LOSS_PENALTIES_BY_RARITY.common
}

function getPveReward(card, hasWon) {
  if (!hasWon) return 0
  return getPveWinReward(card)
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
  if (amount <= 0) {
    return {
      before: await getWalletFragments(client, userId),
      after: await getWalletFragments(client, userId),
      added: 0,
    }
  }

  const before = await getWalletFragments(client, userId)

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

  return {
    before,
    after: before + amount,
    added: amount,
  }
}

async function removeFragments(client, userId, amount) {
  if (amount <= 0) {
    const current = await getWalletFragments(client, userId)

    return {
      before: current,
      after: current,
      removed: 0,
    }
  }

  const before = await getWalletFragments(client, userId)
  const removed = Math.min(before, amount)
  const after = Math.max(0, before - removed)

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
    removed,
  }
}

async function transferFragments(client, fromUserId, toUserId, amount) {
  const loss = await removeFragments(client, fromUserId, amount)

  if (loss.removed > 0) {
    await addFragments(client, toUserId, loss.removed)
  }

  return {
    requested: amount,
    transferred: loss.removed,
    fromBefore: loss.before,
    fromAfter: loss.after,
  }
}

async function updateCombatStats(client, userId, options = {}) {
  const inc = {}

  if (options.mode === "pve" && options.result === "win") {
    inc.pveWins = 1
  }

  if (options.mode === "pve" && options.result === "loss") {
    inc.pveLosses = 1
  }

  if (options.mode === "pvp" && options.result === "win") {
    inc.pvpWins = 1
  }

  if (options.mode === "pvp" && options.result === "loss") {
    inc.pvpLosses = 1
  }

  if (options.pveWin) inc.pveWins = 1
  if (options.pveLoss) inc.pveLosses = 1
  if (options.pvpWin) inc.pvpWins = 1
  if (options.pvpLoss) inc.pvpLosses = 1

  if (options.fragmentsWon && options.fragmentsWon > 0) {
    inc.fragmentsWon = options.fragmentsWon
  }

  if (options.fragmentsLost && options.fragmentsLost > 0) {
    inc.fragmentsLost = options.fragmentsLost
  }

  const update = {
    $set: {
      userId,
      updatedAt: new Date(),
    },
    $setOnInsert: {
      createdAt: new Date(),
    },
  }

  if (Object.keys(inc).length > 0) {
    update.$inc = inc
  }

  await client.db.collection("combat_stats").updateOne(
    {
      userId,
    },
    update,
    {
      upsert: true,
    }
  )
}

module.exports = {
  BASE_STATS_BY_RARITY,
  PVE_WIN_REWARDS_BY_RARITY,
  PVE_LOSS_PENALTIES_BY_RARITY,
  PVP_TRANSFER_BY_RARITY,

  getCardStats,
  getStatsForBattle,
  calculateDamage,
  simulateBattle,
  simulateBattleWithCustomStats,
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