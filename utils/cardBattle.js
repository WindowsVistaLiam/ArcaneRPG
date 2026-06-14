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

const RARITY_MULTIPLIER = {
  common: 1,
  rare: 1.15,
  epic: 1.35,
  legendary: 1.65,
  mythic: 2,
}

function getBaseStatsByRarity(rarity) {
  return BASE_STATS_BY_RARITY[rarity] || BASE_STATS_BY_RARITY.common
}

function getCardStats(card) {
  const baseStats = getBaseStatsByRarity(card.rarity)

  return {
    hp: baseStats.hp,
    attack: baseStats.attack,
    defense: baseStats.defense,
    speed: baseStats.speed,
    power:
      baseStats.hp +
      baseStats.attack * 3 +
      baseStats.defense * 2 +
      baseStats.speed * 2,
  }
}

function getRarityMultiplier(rarity) {
  return RARITY_MULTIPLIER[rarity] || 1
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
  const statsA = getCardStats(cardA)
  const statsB = getCardStats(cardB)

  let fighterA = {
    card: cardA,
    stats: statsA,
    currentHp: statsA.hp,
  }

  let fighterB = {
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
    const powerA = statsA.power
    const powerB = statsB.power

    if (powerA >= powerB) {
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
    winnerRemainingHp: winner.currentHp,
    loserRemainingHp: loser.currentHp,
    turns: logs.length,
    logs,
  }
}

function generatePveEnemy(card) {
  const stats = getCardStats(card)
  const multiplier = getRarityMultiplier(card.rarity)

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
      hp: Math.round(stats.hp * 0.85 * multiplier),
      attack: Math.round(stats.attack * 0.85),
      defense: Math.round(stats.defense * 0.85),
      speed: Math.round(stats.speed * 0.85),
    },
  }
}

function getStatsForBattle(card) {
  if (card.customStats) {
    const stats = card.customStats

    return {
      hp: stats.hp,
      attack: stats.attack,
      defense: stats.defense,
      speed: stats.speed,
      power:
        stats.hp +
        stats.attack * 3 +
        stats.defense * 2 +
        stats.speed * 2,
    }
  }

  return getCardStats(card)
}

function simulateBattleWithCustomStats(cardA, cardB) {
  const statsA = getStatsForBattle(cardA)
  const statsB = getStatsForBattle(cardB)

  let fighterA = {
    card: cardA,
    stats: statsA,
    currentHp: statsA.hp,
  }

  let fighterB = {
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
    const powerA = statsA.power
    const powerB = statsB.power

    if (powerA >= powerB) {
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
    winnerRemainingHp: winner.currentHp,
    loserRemainingHp: loser.currentHp,
    turns: logs.length,
    logs,
  }
}

const PVE_REWARDS_BY_RARITY = {
  common: 3,
  rare: 7,
  epic: 14,
  legendary: 28,
  mythic: 55,
}

function getPveReward(card, hasWon) {
  if (!hasWon) return 0

  return PVE_REWARDS_BY_RARITY[card.rarity] || PVE_REWARDS_BY_RARITY.common
}

module.exports = {
  BASE_STATS_BY_RARITY,
  getCardStats,
  getStatsForBattle,
  calculateDamage,
  simulateBattle,
  simulateBattleWithCustomStats,
  generatePveEnemy,
  getPveReward,
}