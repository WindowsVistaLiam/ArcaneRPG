const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js")

const arcaneCards = require("../../data/arcaneCards")

const RARITY_WEIGHTS = {
  common: 800,
  rare: 150,
  epic: 30,
  legendary: 18,
  mythic: 2,
}

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

const FRAGMENTS_BY_RARITY = {
  common: 1,
  rare: 4,
  epic: 12,
  legendary: 35,
  mythic: 100,
}

const CATEGORIES = {
  packs: {
    label: "🎁 Packs",
    color: 0x5865f2,
  },
  recharges: {
    label: "⏳ Recharges",
    color: 0x3498db,
  },
  boosts: {
    label: "🍀 Boosts",
    color: 0x2ecc71,
  },
  protections: {
    label: "🛡️ Protections",
    color: 0xe67e22,
  },
  ameliorations: {
    label: "⚙️ Améliorations",
    color: 0x9b59b6,
  },
  cosmetiques: {
    label: "🎖️ Cosmétiques",
    color: 0xf1c40f,
  },
  effets: {
    label: "📌 Effets actifs",
    color: 0x1abc9c,
  },
}

const SHOP_ITEMS = [
  // 🎁 PACKS
  {
    key: "common_pack",
    category: "packs",
    type: "pack",
    emoji: "🎁",
    label: "Pack Commun+",
    price: 25,
    description: "Donne 1 carte aléatoire. Peut contenir toutes les raretés.",
    allowedRarities: ["common", "rare", "epic", "legendary", "mythic"],
  },
  {
    key: "rare_pack",
    category: "packs",
    type: "pack",
    emoji: "🔵",
    label: "Pack Rare+",
    price: 100,
    description: "Donne 1 carte rare minimum.",
    allowedRarities: ["rare", "epic", "legendary", "mythic"],
  },
  {
    key: "epic_pack",
    category: "packs",
    type: "pack",
    emoji: "🟣",
    label: "Pack Épique+",
    price: 300,
    description: "Donne 1 carte épique minimum.",
    allowedRarities: ["epic", "legendary", "mythic"],
  },
  {
    key: "legendary_pack",
    category: "packs",
    type: "pack",
    emoji: "🟡",
    label: "Pack Légendaire+",
    price: 900,
    description: "Donne 1 carte légendaire ou mythique.",
    allowedRarities: ["legendary", "mythic"],
  },
  {
    key: "mythic_pack",
    category: "packs",
    type: "pack",
    emoji: "🔴",
    label: "Pack Mythique",
    price: 2500,
    description: "Donne 1 carte mythique.",
    allowedRarities: ["mythic"],
  },
  {
    key: "zaun_pack",
    category: "packs",
    type: "pack",
    emoji: "🧪",
    label: "Pack Zaun",
    price: 250,
    description: "Donne 1 carte liée à Zaun.",
    keywords: ["zaun"],
  },
  {
    key: "piltover_pack",
    category: "packs",
    type: "pack",
    emoji: "🏛️",
    label: "Pack Piltover",
    price: 250,
    description: "Donne 1 carte liée à Piltover.",
    keywords: ["piltover"],
  },
  {
    key: "enforcer_pack",
    category: "packs",
    type: "pack",
    emoji: "🛡️",
    label: "Pack Enforcer",
    price: 300,
    description: "Donne 1 carte liée aux Enforcers ou à Piltover.",
    keywords: ["enforcer", "piltover"],
  },
  {
    key: "shimmer_pack",
    category: "packs",
    type: "pack",
    emoji: "💉",
    label: "Pack Shimmer",
    price: 350,
    description: "Donne 1 carte liée à Zaun, au Shimmer ou aux chem-barons.",
    keywords: ["shimmer", "chem", "zaun"],
  },
  {
    key: "unique_random",
    category: "packs",
    type: "unique_card",
    emoji: "🌟",
    label: "Carte unique aléatoire",
    price: 1500,
    description: "Donne une carte que tu ne possèdes pas encore, si possible.",
  },

  // ⏳ RECHARGES
  {
    key: "reset_tirage",
    category: "recharges",
    type: "reset_cooldown",
    emoji: "🎲",
    label: "Recharge Tirage",
    price: 250,
    description: "Supprime ton cooldown de /tirage.",
    cooldowns: ["tirage"],
  },
  {
    key: "reset_pve",
    category: "recharges",
    type: "reset_cooldown",
    emoji: "⚔️",
    label: "Recharge Combat PVE",
    price: 75,
    description: "Supprime ton cooldown de /combat pve.",
    cooldowns: ["pve"],
  },
  {
    key: "reset_double",
    category: "recharges",
    type: "reset_cooldown",
    emoji: "⚡",
    label: "Recharge Double",
    price: 300,
    description: "Supprime ton cooldown de /tirage et de /combat pve.",
    cooldowns: ["tirage", "pve"],
  },

  // 🍀 BOOSTS
  {
    key: "draw_boost_rare",
    category: "boosts",
    type: "effect",
    emoji: "🍀",
    label: "Boost Rare",
    price: 300,
    description: "Améliore ton prochain tirage. À brancher dans /tirage.",
    effectKey: "draw_boost_rare",
    effectType: "draw_boost",
    uses: 1,
  },
  {
    key: "draw_boost_epic",
    category: "boosts",
    type: "effect",
    emoji: "✨",
    label: "Boost Épique",
    price: 750,
    description: "Améliore fortement ton prochain tirage. À brancher dans /tirage.",
    effectKey: "draw_boost_epic",
    effectType: "draw_boost",
    uses: 1,
  },
  {
    key: "pve_reward_x2",
    category: "boosts",
    type: "effect",
    emoji: "💠",
    label: "Boost Récompense PVE",
    price: 200,
    description: "Double les fragments gagnés au prochain combat PVE gagné. À brancher dans /combat.",
    effectKey: "pve_reward_x2",
    effectType: "combat_boost",
    uses: 1,
  },
  {
    key: "shop_discount_10",
    category: "boosts",
    type: "effect",
    emoji: "🏷️",
    label: "Boost Boutique -10%",
    price: 150,
    description: "Réduit de 10% le prix de ton prochain achat boutique.",
    effectKey: "shop_discount_10",
    effectType: "shop_boost",
    uses: 1,
  },

  // 🛡️ PROTECTIONS
  {
    key: "pvp_protection",
    category: "protections",
    type: "effect",
    emoji: "🛡️",
    label: "Protection PVP",
    price: 150,
    description: "Empêche une perte de fragments lors du prochain PVP perdu. À brancher dans /combat.",
    effectKey: "pvp_protection",
    effectType: "protection",
    uses: 1,
  },
  {
    key: "pve_insurance",
    category: "protections",
    type: "effect",
    emoji: "🧷",
    label: "Assurance PVE",
    price: 100,
    description: "Empêche une perte de fragments lors du prochain PVE perdu. À brancher dans /combat.",
    effectKey: "pve_insurance",
    effectType: "protection",
    uses: 1,
  },
  {
    key: "economic_shield",
    category: "protections",
    type: "effect",
    emoji: "🔰",
    label: "Bouclier économique",
    price: 400,
    description: "Protège contre 3 pertes de fragments. À brancher dans /combat.",
    effectKey: "economic_shield",
    effectType: "protection",
    uses: 3,
  },

  // ⚙️ AMÉLIORATIONS
  {
    key: "upgrade_fragment",
    category: "ameliorations",
    type: "item",
    emoji: "🔧",
    label: "Fragment d'amélioration",
    price: 100,
    description: "Ressource utilisée plus tard pour améliorer une carte.",
    itemKey: "upgrade_fragment",
    itemLabel: "Fragment d'amélioration",
    quantity: 1,
  },
  {
    key: "upgrade_kit",
    category: "ameliorations",
    type: "item",
    emoji: "🧰",
    label: "Kit d'amélioration",
    price: 500,
    description: "Donne 6 fragments d'amélioration.",
    itemKey: "upgrade_fragment",
    itemLabel: "Fragment d'amélioration",
    quantity: 6,
  },
  {
    key: "hextech_crystal",
    category: "ameliorations",
    type: "item",
    emoji: "💎",
    label: "Cristal Hextech",
    price: 1200,
    description: "Ressource rare pour les futures améliorations haut niveau.",
    itemKey: "hextech_crystal",
    itemLabel: "Cristal Hextech",
    quantity: 1,
  },
  {
    key: "shimmer_catalyst",
    category: "ameliorations",
    type: "item",
    emoji: "🧪",
    label: "Catalyseur Shimmer",
    price: 800,
    description: "Objet spécial prévu pour améliorer l'attaque d'une carte.",
    itemKey: "shimmer_catalyst",
    itemLabel: "Catalyseur Shimmer",
    quantity: 1,
  },
  {
    key: "hextech_armor",
    category: "ameliorations",
    type: "item",
    emoji: "🛡️",
    label: "Armure Hextech",
    price: 800,
    description: "Objet spécial prévu pour améliorer la défense d'une carte.",
    itemKey: "hextech_armor",
    itemLabel: "Armure Hextech",
    quantity: 1,
  },
  {
    key: "speed_core",
    category: "ameliorations",
    type: "item",
    emoji: "💨",
    label: "Noyau de vitesse",
    price: 800,
    description: "Objet spécial prévu pour améliorer la vitesse d'une carte.",
    itemKey: "speed_core",
    itemLabel: "Noyau de vitesse",
    quantity: 1,
  },

  // 🎖️ COSMÉTIQUES
  {
    key: "title_collector",
    category: "cosmetiques",
    type: "cosmetic",
    emoji: "🎖️",
    label: "Titre : Collectionneur",
    price: 500,
    description: "Titre cosmétique pour ton futur profil collectionneur.",
    cosmeticType: "title",
    cosmeticKey: "collector",
    cosmeticLabel: "Collectionneur",
  },
  {
    key: "title_arena_champion",
    category: "cosmetiques",
    type: "cosmetic",
    emoji: "🏆",
    label: "Titre : Champion de l'Arène",
    price: 900,
    description: "Titre cosmétique lié aux combats.",
    cosmeticType: "title",
    cosmeticKey: "arena_champion",
    cosmeticLabel: "Champion de l'Arène",
  },
  {
    key: "title_zaun_merchant",
    category: "cosmetiques",
    type: "cosmetic",
    emoji: "🧪",
    label: "Titre : Marchand de Zaun",
    price: 750,
    description: "Titre cosmétique lié à Zaun.",
    cosmeticType: "title",
    cosmeticKey: "zaun_merchant",
    cosmeticLabel: "Marchand de Zaun",
  },
  {
    key: "title_piltover_heir",
    category: "cosmetiques",
    type: "cosmetic",
    emoji: "🏛️",
    label: "Titre : Héritier de Piltover",
    price: 750,
    description: "Titre cosmétique lié à Piltover.",
    cosmeticType: "title",
    cosmeticKey: "piltover_heir",
    cosmeticLabel: "Héritier de Piltover",
  },
  {
    key: "badge_zaun",
    category: "cosmetiques",
    type: "cosmetic",
    emoji: "🧪",
    label: "Badge Zaun",
    price: 800,
    description: "Badge cosmétique pour ton futur profil collectionneur.",
    cosmeticType: "badge",
    cosmeticKey: "zaun",
    cosmeticLabel: "Badge Zaun",
  },
  {
    key: "badge_piltover",
    category: "cosmetiques",
    type: "cosmetic",
    emoji: "🏛️",
    label: "Badge Piltover",
    price: 800,
    description: "Badge cosmétique pour ton futur profil collectionneur.",
    cosmeticType: "badge",
    cosmeticKey: "piltover",
    cosmeticLabel: "Badge Piltover",
  },
  {
    key: "badge_hextech",
    category: "cosmetiques",
    type: "cosmetic",
    emoji: "💎",
    label: "Badge Hextech",
    price: 1200,
    description: "Badge cosmétique rare.",
    cosmeticType: "badge",
    cosmeticKey: "hextech",
    cosmeticLabel: "Badge Hextech",
  },
]

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function getShopItem(itemKey) {
  return SHOP_ITEMS.find((item) => item.key === itemKey)
}

function getItemsByCategory(category) {
  return SHOP_ITEMS.filter((item) => item.category === category)
}

function chunkArray(array, size) {
  const chunks = []

  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }

  return chunks
}

async function getWalletFragments(client, userId) {
  const wallet = await client.db.collection("player_wallets").findOne({
    userId,
  })

  return wallet?.fragments || 0
}

async function addFragments(client, userId, amount) {
  if (amount <= 0) return

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
}

async function spendFragments(client, userId, amount) {
  const before = await getWalletFragments(client, userId)

  if (before < amount) {
    return {
      success: false,
      before,
      after: before,
      spent: 0,
    }
  }

  const after = before - amount

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
    success: true,
    before,
    after,
    spent: amount,
  }
}

async function userOwnsCard(client, userId, cardKey) {
  const card = await client.db.collection("player_cards").findOne({
    userId,
    cardKey,
  })

  return Boolean(card)
}

async function getOwnedCardKeys(client, userId) {
  const cards = await client.db.collection("player_cards")
    .find({
      userId,
    })
    .project({
      cardKey: 1,
    })
    .toArray()

  return new Set(cards.map((card) => card.cardKey))
}

function matchesKeywords(card, keywords = []) {
  if (!keywords.length) return true

  const haystack = normalizeText([
    card.name,
    card.characterName,
    card.characterKey,
    card.faction,
    card.season,
    card.description,
    ...(card.tags || []),
  ].join(" "))

  return keywords.some((keyword) => haystack.includes(normalizeText(keyword)))
}

function getCandidateCardsForItem(item, ownedCardKeys = null) {
  let cards = [...arcaneCards]

  if (item.allowedRarities && item.allowedRarities.length) {
    cards = cards.filter((card) => item.allowedRarities.includes(card.rarity))
  }

  if (item.keywords && item.keywords.length) {
    cards = cards.filter((card) => matchesKeywords(card, item.keywords))
  }

  if (item.type === "unique_card" && ownedCardKeys) {
    cards = cards.filter((card) => !ownedCardKeys.has(card.key))
  }

  return cards
}

function pickWeightedCard(cards) {
  if (!cards.length) return null

  const totalWeight = cards.reduce((total, card) => {
    return total + (RARITY_WEIGHTS[card.rarity] || 1)
  }, 0)

  let random = Math.random() * totalWeight

  for (const card of cards) {
    random -= RARITY_WEIGHTS[card.rarity] || 1

    if (random <= 0) {
      return card
    }
  }

  return cards[cards.length - 1]
}

async function grantCard(client, userId, card) {
  const alreadyOwned = await userOwnsCard(client, userId, card.key)

  if (alreadyOwned) {
    const fragments = FRAGMENTS_BY_RARITY[card.rarity] || 1

    await addFragments(client, userId, fragments)

    return {
      result: "duplicate",
      card,
      fragments,
    }
  }

  await client.db.collection("player_cards").insertOne({
    userId,
    cardKey: card.key,
    cardName: card.name,
    rarity: card.rarity,
    rarityLabel: card.rarityLabel,
    value: card.value,
    image: card.image,
    description: card.description || "",
    source: "boutique",
    claimedAt: new Date(),
    favorite: false,
    locked: false,
  })

  return {
    result: "new",
    card,
    fragments: 0,
  }
}

async function getActiveEffect(client, userId, effectKey) {
  return client.db.collection("player_effects").findOne({
    userId,
    effectKey,
    uses: {
      $gt: 0,
    },
  })
}

async function addEffect(client, userId, item) {
  await client.db.collection("player_effects").updateOne(
    {
      userId,
      effectKey: item.effectKey,
    },
    {
      $inc: {
        uses: item.uses || 1,
      },
      $set: {
        userId,
        effectKey: item.effectKey,
        effectType: item.effectType,
        label: item.label,
        description: item.description,
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

async function consumeEffect(client, userId, effectKey) {
  const effect = await getActiveEffect(client, userId, effectKey)

  if (!effect) return false

  if ((effect.uses || 0) <= 1) {
    await client.db.collection("player_effects").deleteOne({
      _id: effect._id,
    })

    return true
  }

  await client.db.collection("player_effects").updateOne(
    {
      _id: effect._id,
    },
    {
      $inc: {
        uses: -1,
      },
      $set: {
        updatedAt: new Date(),
      },
    }
  )

  return true
}

async function addItem(client, userId, item) {
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
        label: item.itemLabel,
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

async function hasCosmetic(client, userId, item) {
  const cosmetic = await client.db.collection("player_cosmetics").findOne({
    userId,
    cosmeticType: item.cosmeticType,
    cosmeticKey: item.cosmeticKey,
  })

  return Boolean(cosmetic)
}

async function addCosmetic(client, userId, item) {
  await client.db.collection("player_cosmetics").insertOne({
    userId,
    cosmeticType: item.cosmeticType,
    cosmeticKey: item.cosmeticKey,
    label: item.cosmeticLabel,
    source: "boutique",
    boughtAt: new Date(),
  })
}

async function resetCooldowns(client, userId, cooldowns = []) {
  if (cooldowns.includes("tirage")) {
    await client.db.collection("tirage_cooldowns").deleteOne({
      userId,
    })
  }

  if (cooldowns.includes("pve")) {
    await client.db.collection("combat_cooldowns").deleteOne({
      userId,
      type: "pve",
    })
  }
}

function getEffectivePrice(item, hasShopDiscount) {
  if (!hasShopDiscount) return item.price

  if (item.key === "shop_discount_10") {
    return item.price
  }

  return Math.max(1, Math.floor(item.price * 0.9))
}

async function executePurchase(client, userId, itemKey) {
  const item = getShopItem(itemKey)

  if (!item) {
    return {
      success: false,
      message: "❌ Objet introuvable dans la boutique.",
    }
  }

  let selectedCard = null

  if (item.type === "pack" || item.type === "unique_card") {
    const ownedCardKeys = await getOwnedCardKeys(client, userId)
    const candidates = getCandidateCardsForItem(item, ownedCardKeys)

    if (!candidates.length) {
      return {
        success: false,
        message: "❌ Aucune carte disponible pour cet achat.",
      }
    }

    selectedCard = pickWeightedCard(candidates)
  }

  if (item.type === "cosmetic") {
    const alreadyOwned = await hasCosmetic(client, userId, item)

    if (alreadyOwned) {
      return {
        success: false,
        message: `❌ Tu possèdes déjà ce cosmétique : **${item.cosmeticLabel}**.`,
      }
    }
  }

  const shopDiscount = await getActiveEffect(client, userId, "shop_discount_10")
  const hasShopDiscount = Boolean(shopDiscount)
  const finalPrice = getEffectivePrice(item, hasShopDiscount)

  const payment = await spendFragments(client, userId, finalPrice)

  if (!payment.success) {
    return {
      success: false,
      message:
        `❌ Tu n'as pas assez de fragments.\n` +
        `Prix : **${finalPrice}**\n` +
        `Tes fragments : **${payment.before}**`,
    }
  }

  let discountConsumed = false

  if (hasShopDiscount && item.key !== "shop_discount_10") {
    discountConsumed = await consumeEffect(client, userId, "shop_discount_10")
  }

  if (item.type === "pack" || item.type === "unique_card") {
    const grant = await grantCard(client, userId, selectedCard)
    const after = await getWalletFragments(client, userId)

    return {
      success: true,
      item,
      payment,
      finalPrice,
      discountConsumed,
      type: "card",
      grant,
      walletAfter: after,
    }
  }

  if (item.type === "reset_cooldown") {
    await resetCooldowns(client, userId, item.cooldowns)

    return {
      success: true,
      item,
      payment,
      finalPrice,
      discountConsumed,
      type: "cooldown",
    }
  }

  if (item.type === "effect") {
    await addEffect(client, userId, item)

    return {
      success: true,
      item,
      payment,
      finalPrice,
      discountConsumed,
      type: "effect",
    }
  }

  if (item.type === "item") {
    await addItem(client, userId, item)

    return {
      success: true,
      item,
      payment,
      finalPrice,
      discountConsumed,
      type: "item",
    }
  }

  if (item.type === "cosmetic") {
    await addCosmetic(client, userId, item)

    return {
      success: true,
      item,
      payment,
      finalPrice,
      discountConsumed,
      type: "cosmetic",
    }
  }

  return {
    success: false,
    message: "❌ Type d'objet boutique non géré.",
  }
}

async function buildEffectsEmbed(client, userId) {
  const fragments = await getWalletFragments(client, userId)

  const effects = await client.db.collection("player_effects")
    .find({
      userId,
      uses: {
        $gt: 0,
      },
    })
    .toArray()

  const items = await client.db.collection("player_items")
    .find({
      userId,
      quantity: {
        $gt: 0,
      },
    })
    .toArray()

  const cosmetics = await client.db.collection("player_cosmetics")
    .find({
      userId,
    })
    .toArray()

  const embed = new EmbedBuilder()
    .setTitle("📌 Effets, objets et cosmétiques")
    .setColor(CATEGORIES.effets.color)
    .setDescription(`💠 Fragments disponibles : **${fragments}**`)
    .setTimestamp()

  embed.addFields({
    name: "🍀 Boosts / protections actifs",
    value: effects.length
      ? effects
          .map((effect) => `**${effect.label}** — x${effect.uses}`)
          .join("\n")
          .slice(0, 1024)
      : "Aucun effet actif.",
    inline: false,
  })

  embed.addFields({
    name: "⚙️ Objets d'amélioration",
    value: items.length
      ? items
          .map((item) => `**${item.label}** — x${item.quantity}`)
          .join("\n")
          .slice(0, 1024)
      : "Aucun objet possédé.",
    inline: false,
  })

  embed.addFields({
    name: "🎖️ Cosmétiques",
    value: cosmetics.length
      ? cosmetics
          .map((cosmetic) => `**${cosmetic.label}** (${cosmetic.cosmeticType})`)
          .join("\n")
          .slice(0, 1024)
      : "Aucun cosmétique possédé.",
    inline: false,
  })

  return embed
}

async function buildShopEmbed(client, userId, category) {
  if (category === "effets") {
    return buildEffectsEmbed(client, userId)
  }

  const fragments = await getWalletFragments(client, userId)
  const shopDiscount = await getActiveEffect(client, userId, "shop_discount_10")
  const hasShopDiscount = Boolean(shopDiscount)

  const categoryData = CATEGORIES[category] || CATEGORIES.packs
  const items = getItemsByCategory(category)

  const lines = items.map((item) => {
    const finalPrice = getEffectivePrice(item, hasShopDiscount)
    const discountText = finalPrice < item.price
      ? ` ~~${item.price}~~ → **${finalPrice}**`
      : ` **${item.price}**`

    return (
      `${item.emoji} **${item.label}** — 💠${discountText}\n` +
      `${item.description}`
    )
  })

  const embed = new EmbedBuilder()
    .setTitle(`🛒 Boutique — ${categoryData.label}`)
    .setColor(categoryData.color)
    .setDescription(
      `💠 Tes fragments : **${fragments}**\n` +
      `${hasShopDiscount ? "🏷️ Boost boutique actif : **-10% sur le prochain achat**\n" : ""}` +
      `\n${lines.join("\n\n") || "Aucun objet dans cette catégorie."}`
    )
    .setFooter({
      text: "Clique sur un bouton pour acheter. Les achats sont personnels.",
    })
    .setTimestamp()

  return embed
}

function buildCategoryRows(activeCategory) {
  const categories = Object.entries(CATEGORIES)
  const chunks = chunkArray(categories, 5)

  return chunks.map((chunk) => {
    const row = new ActionRowBuilder()

    for (const [categoryKey, categoryData] of chunk) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`boutique:category:${categoryKey}`)
          .setLabel(categoryData.label)
          .setStyle(categoryKey === activeCategory ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setDisabled(categoryKey === activeCategory)
      )
    }

    return row
  })
}

function buildBuyRows(category) {
  if (category === "effets") return []

  const items = getItemsByCategory(category)
  const chunks = chunkArray(items, 5)

  return chunks.map((chunk) => {
    const row = new ActionRowBuilder()

    for (const item of chunk) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`boutique:buy:${item.key}`)
          .setLabel(`${item.emoji} ${item.label}`)
          .setStyle(ButtonStyle.Success)
      )
    }

    return row
  })
}

function buildComponents(category) {
  const rows = [
    ...buildCategoryRows(category),
    ...buildBuyRows(category),
  ]

  return rows.slice(0, 5)
}

function buildPurchaseEmbed(result) {
  const item = result.item

  const embed = new EmbedBuilder()
    .setTitle("✅ Achat effectué")
    .setColor(0x2ecc71)
    .setDescription(
      `${item.emoji} Tu as acheté : **${item.label}**\n` +
      `💠 Prix payé : **${result.finalPrice}** fragment${result.finalPrice > 1 ? "s" : ""}` +
      `${result.discountConsumed ? "\n🏷️ Ton boost boutique -10% a été consommé." : ""}`
    )
    .setTimestamp()

  if (result.type === "card") {
    const card = result.grant.card
    const emoji = RARITY_EMOJIS[card.rarity] || "🎴"

    if (result.grant.result === "new") {
      embed.addFields({
        name: "🎴 Carte obtenue",
        value:
          `${emoji} **${card.name}**\n` +
          `Rareté : **${card.rarityLabel || card.rarity}**\n` +
          `ID : \`${card.key}\`\n` +
          `✅ Nouvelle carte ajoutée à ta collection.`,
        inline: false,
      })
    }

    if (result.grant.result === "duplicate") {
      embed.addFields({
        name: "♻️ Doublon converti",
        value:
          `${emoji} **${card.name}**\n` +
          `Rareté : **${card.rarityLabel || card.rarity}**\n` +
          `💠 Doublon converti en **${result.grant.fragments}** fragment${result.grant.fragments > 1 ? "s" : ""}.\n` +
          `Fragments après achat : **${result.walletAfter}**`,
        inline: false,
      })
    }

    if (card.image) {
      embed.setImage(card.image)
    }
  }

  if (result.type === "cooldown") {
    embed.addFields({
      name: "⏳ Recharge appliquée",
      value: "Le ou les cooldowns concernés ont été supprimés.",
      inline: false,
    })
  }

  if (result.type === "effect") {
    embed.addFields({
      name: "🍀 Effet ajouté",
      value:
        `Effet : **${item.label}**\n` +
        `Utilisations : **${item.uses || 1}**\n` +
        `Tu peux voir tes effets avec **/boutique categorie:Effets actifs**.`,
      inline: false,
    })
  }

  if (result.type === "item") {
    embed.addFields({
      name: "⚙️ Objet ajouté",
      value: `**${item.itemLabel}** x${item.quantity || 1}`,
      inline: false,
    })
  }

  if (result.type === "cosmetic") {
    embed.addFields({
      name: "🎖️ Cosmétique débloqué",
      value: `**${item.cosmeticLabel}**`,
      inline: false,
    })
  }

  return embed
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("boutique")
    .setDescription("Ouvrir la boutique du mini-jeu Arcane")
    .addStringOption((option) =>
      option
        .setName("categorie")
        .setDescription("Catégorie de la boutique")
        .setRequired(false)
        .addChoices(
          {
            name: "🎁 Packs",
            value: "packs",
          },
          {
            name: "⏳ Recharges",
            value: "recharges",
          },
          {
            name: "🍀 Boosts",
            value: "boosts",
          },
          {
            name: "🛡️ Protections",
            value: "protections",
          },
          {
            name: "⚙️ Améliorations",
            value: "ameliorations",
          },
          {
            name: "🎖️ Cosmétiques",
            value: "cosmetiques",
          },
          {
            name: "📌 Effets actifs",
            value: "effets",
          }
        )
    ),

  async execute(interaction, client) {
    const category = interaction.options.getString("categorie") || "packs"
    const safeCategory = CATEGORIES[category] ? category : "packs"

    const embed = await buildShopEmbed(client, interaction.user.id, safeCategory)
    const components = buildComponents(safeCategory)

    return interaction.reply({
      embeds: [embed],
      components,
      ephemeral: true,
    })
  },

  async handleButton(interaction, client) {
    if (!interaction.customId.startsWith("boutique:")) return

    const parts = interaction.customId.split(":")
    const action = parts[1]
    const value = parts[2]

    if (action === "category") {
      const category = CATEGORIES[value] ? value : "packs"

      const embed = await buildShopEmbed(client, interaction.user.id, category)
      const components = buildComponents(category)

      return interaction.update({
        embeds: [embed],
        components,
      })
    }

    if (action === "buy") {
      await interaction.deferUpdate()

      const result = await executePurchase(client, interaction.user.id, value)

      if (!result.success) {
        return interaction.followUp({
          content: result.message || "❌ Achat impossible.",
          ephemeral: true,
        })
      }

      const embed = buildPurchaseEmbed(result)

      return interaction.followUp({
        embeds: [embed],
        ephemeral: true,
      })
    }
  },
}