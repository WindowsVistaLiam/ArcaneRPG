const QUEST_TIMEZONE = "Europe/Paris"
const QUESTS_PER_DAY = 4

const ITEM_LABELS = {
  upgrade_fragment: "Fragment d'amélioration",
  hextech_crystal: "Cristal Hextech",
  shimmer_catalyst: "Catalyseur Shimmer",
  hextech_armor: "Armure Hextech",
  speed_core: "Noyau de vitesse",
}

const EFFECT_LABELS = {
  draw_boost_rare: "Boost Rare",
  draw_boost_epic: "Boost Épique",
  pve_reward_x2: "Boost Récompense PVE",
  pvp_protection: "Protection PVP",
  pve_insurance: "Assurance PVE",
  shop_discount_10: "Boost Boutique -10%",
}

const QUEST_POOL = [
  {
    key: "daily_draw",
    type: "tirage",
    label: "🎲 Tirage du jour",
    description: "Faire un tirage.",
    target: 1,
    reward: {
      fragments: 30,
    },
  },
  {
    key: "pve_play",
    type: "pve_play",
    label: "⚔️ Entraînement PVE",
    description: "Faire un combat PVE.",
    target: 1,
    reward: {
      fragments: 25,
    },
  },
  {
    key: "pve_win",
    type: "pve_win",
    label: "🏆 Victoire PVE",
    description: "Gagner un combat PVE.",
    target: 1,
    reward: {
      fragments: 45,
      items: [
        {
          itemKey: "upgrade_fragment",
          label: "Fragment d'amélioration",
          quantity: 1,
        },
      ],
    },
  },
  {
    key: "pvp_play",
    type: "pvp_play",
    label: "🥊 Duel PVP",
    description: "Participer à un combat PVP.",
    target: 1,
    reward: {
      fragments: 40,
    },
  },
  {
    key: "pvp_win",
    type: "pvp_win",
    label: "👑 Domination PVP",
    description: "Gagner un combat PVP.",
    target: 1,
    reward: {
      fragments: 70,
      items: [
        {
          itemKey: "upgrade_fragment",
          label: "Fragment d'amélioration",
          quantity: 1,
        },
      ],
    },
  },
  {
    key: "boutique_buy",
    type: "boutique_buy",
    label: "🛒 Passage à la boutique",
    description: "Acheter un objet dans la boutique.",
    target: 1,
    reward: {
      fragments: 25,
    },
  },
  {
    key: "improve_card",
    type: "improve_card",
    label: "⚙️ Amélioration Hextech",
    description: "Améliorer une carte.",
    target: 1,
    reward: {
      fragments: 50,
    },
  },
  {
    key: "exchange",
    type: "exchange",
    label: "🤝 Marchandage",
    description: "Terminer un échange avec un autre joueur.",
    target: 1,
    reward: {
      fragments: 35,
    },
  },
]

const FIXED_DAILY_QUEST_KEYS = ["daily_draw", "pve_play"]

function getTodayDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("fr-CA", {
    timeZone: QUEST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value

  return `${year}-${month}-${day}`
}

function hashString(text) {
  let hash = 2166136261

  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function createSeededRandom(seed) {
  let state = seed >>> 0

  return function random() {
    state += 0x6D2B79F5

    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function cloneQuest(template) {
  return {
    key: template.key,
    type: template.type,
    label: template.label,
    description: template.description,
    target: template.target,
    progress: 0,
    claimed: false,
    reward: template.reward || {},
  }
}

function pickDailyQuests(userId, dateKey) {
  const fixedQuests = FIXED_DAILY_QUEST_KEYS
    .map((key) => QUEST_POOL.find((quest) => quest.key === key))
    .filter(Boolean)

  const optionalQuests = QUEST_POOL.filter((quest) => {
    return !FIXED_DAILY_QUEST_KEYS.includes(quest.key)
  })

  const random = createSeededRandom(hashString(`${userId}:${dateKey}`))

  const shuffled = [...optionalQuests].sort(() => random() - 0.5)

  const selected = [
    ...fixedQuests,
    ...shuffled.slice(0, Math.max(0, QUESTS_PER_DAY - fixedQuests.length)),
  ]

  return selected.map(cloneQuest)
}

async function ensureDailyQuests(client, userId) {
  const dateKey = getTodayDateKey()
  const collection = client.db.collection("daily_quests")

  const existing = await collection.findOne({
    userId,
    dateKey,
  })

  if (existing) {
    return existing
  }

  const quests = pickDailyQuests(userId, dateKey)

  await collection.updateOne(
    {
      userId,
      dateKey,
    },
    {
      $setOnInsert: {
        userId,
        dateKey,
        timezone: QUEST_TIMEZONE,
        quests,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    {
      upsert: true,
    }
  )

  return collection.findOne({
    userId,
    dateKey,
  })
}

async function progressQuest(client, userId, questType, amount = 1) {
  const collection = client.db.collection("daily_quests")
  const doc = await ensureDailyQuests(client, userId)

  let changed = false

  const quests = doc.quests.map((quest) => {
    if (quest.type !== questType) return quest
    if (quest.claimed) return quest

    const currentProgress = quest.progress || 0
    const target = quest.target || 1

    if (currentProgress >= target) return quest

    changed = true

    return {
      ...quest,
      progress: Math.min(target, currentProgress + amount),
    }
  })

  if (!changed) {
    return {
      changed: false,
      quests,
    }
  }

  await collection.updateOne(
    {
      _id: doc._id,
    },
    {
      $set: {
        quests,
        updatedAt: new Date(),
      },
    }
  )

  return {
    changed: true,
    quests,
  }
}

function mergeRewards(rewards) {
  const merged = {
    fragments: 0,
    items: [],
    effects: [],
  }

  const itemMap = new Map()
  const effectMap = new Map()

  for (const reward of rewards) {
    merged.fragments += reward.fragments || 0

    for (const item of reward.items || []) {
      const current = itemMap.get(item.itemKey) || {
        itemKey: item.itemKey,
        label: item.label || ITEM_LABELS[item.itemKey] || item.itemKey,
        quantity: 0,
      }

      current.quantity += item.quantity || 1
      itemMap.set(item.itemKey, current)
    }

    for (const effect of reward.effects || []) {
      const current = effectMap.get(effect.effectKey) || {
        effectKey: effect.effectKey,
        label: effect.label || EFFECT_LABELS[effect.effectKey] || effect.effectKey,
        effectType: effect.effectType || "quest_reward",
        uses: 0,
      }

      current.uses += effect.uses || 1
      effectMap.set(effect.effectKey, current)
    }
  }

  merged.items = [...itemMap.values()]
  merged.effects = [...effectMap.values()]

  return merged
}

async function addRewardFragments(client, userId, amount) {
  if (!amount || amount <= 0) return

  await client.db.collection("player_wallets").updateOne(
    {
      userId,
    },
    {
      $inc: {
        fragments: amount,
      },
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

async function addRewardItem(client, userId, item) {
  await client.db.collection("player_items").updateOne(
    {
      userId,
      itemKey: item.itemKey,
    },
    {
      $inc: {
        quantity: item.quantity || 1,
      },
      $set: {
        userId,
        itemKey: item.itemKey,
        label: item.label || ITEM_LABELS[item.itemKey] || item.itemKey,
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

async function addRewardEffect(client, userId, effect) {
  await client.db.collection("player_effects").updateOne(
    {
      userId,
      effectKey: effect.effectKey,
    },
    {
      $inc: {
        uses: effect.uses || 1,
      },
      $set: {
        userId,
        effectKey: effect.effectKey,
        effectType: effect.effectType || "quest_reward",
        label: effect.label || EFFECT_LABELS[effect.effectKey] || effect.effectKey,
        description: "Récompense de quête quotidienne",
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

async function grantReward(client, userId, reward) {
  await addRewardFragments(client, userId, reward.fragments || 0)

  for (const item of reward.items || []) {
    await addRewardItem(client, userId, item)
  }

  for (const effect of reward.effects || []) {
    await addRewardEffect(client, userId, effect)
  }
}

function formatReward(reward) {
  const parts = []

  if (reward.fragments) {
    parts.push(`💠 ${reward.fragments} fragment${reward.fragments > 1 ? "s" : ""}`)
  }

  for (const item of reward.items || []) {
    parts.push(`⚙️ ${item.label || ITEM_LABELS[item.itemKey] || item.itemKey} x${item.quantity || 1}`)
  }

  for (const effect of reward.effects || []) {
    parts.push(`🍀 ${effect.label || EFFECT_LABELS[effect.effectKey] || effect.effectKey} x${effect.uses || 1}`)
  }

  return parts.length ? parts.join(" + ") : "Aucune récompense"
}

async function claimAllCompletedQuests(client, userId) {
  const collection = client.db.collection("daily_quests")
  const doc = await ensureDailyQuests(client, userId)

  const completedQuests = doc.quests.filter((quest) => {
    return !quest.claimed && (quest.progress || 0) >= (quest.target || 1)
  })

  if (!completedQuests.length) {
    return {
      success: false,
      message: "Aucune quête terminée à réclamer.",
      claimedQuests: [],
      reward: null,
    }
  }

  const reward = mergeRewards(completedQuests.map((quest) => quest.reward || {}))

  await grantReward(client, userId, reward)

  const completedKeys = new Set(completedQuests.map((quest) => quest.key))

  const quests = doc.quests.map((quest) => {
    if (!completedKeys.has(quest.key)) return quest

    return {
      ...quest,
      claimed: true,
      claimedAt: new Date(),
    }
  })

  await collection.updateOne(
    {
      _id: doc._id,
    },
    {
      $set: {
        quests,
        updatedAt: new Date(),
      },
    }
  )

  return {
    success: true,
    message: "Récompenses récupérées.",
    claimedQuests: completedQuests,
    reward,
  }
}

module.exports = {
  QUEST_TIMEZONE,
  QUESTS_PER_DAY,
  QUEST_POOL,

  getTodayDateKey,
  ensureDailyQuests,
  progressQuest,
  claimAllCompletedQuests,
  formatReward,
}