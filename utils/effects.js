const EFFECT_DURATION_MS = 24 * 60 * 60 * 1000

const NON_CONSUMABLE_EFFECTS = new Set([
  "draw_boost_rare",
  "draw_boost_epic",
  "pve_reward_x2",
  "shop_discount_10",
])

function getDurationMs(item = {}) {
  return item.durationMs || EFFECT_DURATION_MS
}

function isNonConsumableEffect(effectOrKey) {
  const effectKey = typeof effectOrKey === "string" ? effectOrKey : effectOrKey?.effectKey

  return NON_CONSUMABLE_EFFECTS.has(effectKey)
}

function getEffectBaseDate(existingEffect) {
  const now = new Date()
  const currentExpiresAt = existingEffect?.expiresAt ? new Date(existingEffect.expiresAt) : null

  if (currentExpiresAt && currentExpiresAt.getTime() > now.getTime()) {
    return currentExpiresAt
  }

  return now
}

function getNewExpiresAt(existingEffect, durationMs = EFFECT_DURATION_MS) {
  const baseDate = getEffectBaseDate(existingEffect)

  return new Date(baseDate.getTime() + durationMs)
}

function isEffectActive(effect) {
  if (!effect) return false

  const now = Date.now()

  if (effect.expiresAt && new Date(effect.expiresAt).getTime() <= now) {
    return false
  }

  if (isNonConsumableEffect(effect)) {
    return true
  }

  return (effect.uses || 0) > 0
}

async function getActiveEffect(client, userId, effectKey) {
  const now = new Date()

  const effects = await client.db.collection("player_effects")
    .find({
      userId,
      effectKey,
      $or: [
        { expiresAt: { $gt: now } },
        { expiresAt: { $exists: false } },
        { expiresAt: null },
      ],
    })
    .sort({ expiresAt: -1, updatedAt: -1 })
    .toArray()

  return effects.find(isEffectActive) || null
}

async function addTimedEffect(client, userId, item) {
  const now = new Date()
  const existingEffect = await client.db.collection("player_effects").findOne({
    userId,
    effectKey: item.effectKey,
  })

  const expiresAt = getNewExpiresAt(existingEffect, getDurationMs(item))
  const nonConsumable = item.consumable === false || isNonConsumableEffect(item.effectKey)
  const usesToAdd = item.uses || 1

  const update = {
    $set: {
      userId,
      effectKey: item.effectKey,
      effectType: item.effectType,
      label: item.label,
      description: item.description,
      active: true,
      durationMs: getDurationMs(item),
      expiresAt,
      updatedAt: now,
    },
    $setOnInsert: {
      createdAt: now,
    },
  }

  if (nonConsumable) {
    update.$set.uses = null
    update.$set.consumable = false
  } else {
    update.$inc = {
      uses: usesToAdd,
    }
    update.$set.consumable = true
  }

  await client.db.collection("player_effects").updateOne(
    {
      userId,
      effectKey: item.effectKey,
    },
    update,
    { upsert: true }
  )

  return client.db.collection("player_effects").findOne({
    userId,
    effectKey: item.effectKey,
  })
}

async function consumeEffect(client, userId, effectKey) {
  const effect = await getActiveEffect(client, userId, effectKey)

  if (!effect) return false

  if (isNonConsumableEffect(effect) || effect.consumable === false || effect.uses === null) {
    return false
  }

  if ((effect.uses || 0) <= 1) {
    await client.db.collection("player_effects").deleteOne({ _id: effect._id })
    return true
  }

  await client.db.collection("player_effects").updateOne(
    { _id: effect._id },
    {
      $inc: { uses: -1 },
      $set: { updatedAt: new Date() },
    }
  )

  return true
}

async function consumeFirstAvailableEffect(client, userId, effectKeys, labels = {}) {
  for (const effectKey of effectKeys) {
    const effect = await getActiveEffect(client, userId, effectKey)

    if (effect) {
      await consumeEffect(client, userId, effectKey)

      return {
        protected: true,
        effectKey,
        label: labels[effectKey] || effect.label || effectKey,
      }
    }
  }

  return {
    protected: false,
    effectKey: null,
    label: null,
  }
}

function formatRemainingTime(ms) {
  const safeMs = Math.max(0, ms)
  const totalMinutes = Math.ceil(safeMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}min`
  if (hours > 0) return `${hours}h`

  return `${minutes}min`
}

function formatEffectRemaining(effect) {
  if (!effect?.expiresAt) return "Durée inconnue"

  const remainingMs = new Date(effect.expiresAt).getTime() - Date.now()

  if (remainingMs <= 0) return "Expiré"

  return formatRemainingTime(remainingMs)
}

module.exports = {
  EFFECT_DURATION_MS,
  NON_CONSUMABLE_EFFECTS,
  getActiveEffect,
  addTimedEffect,
  consumeEffect,
  consumeFirstAvailableEffect,
  formatRemainingTime,
  formatEffectRemaining,
  isNonConsumableEffect,
}
