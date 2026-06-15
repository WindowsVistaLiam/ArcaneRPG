const dns = require("dns")
dns.setServers(["1.1.1.1", "8.8.8.8"])

const { MongoClient } = require("mongodb")

try {
  require("dotenv").config()
} catch {}

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = "arcaneRPG"

const args = process.argv.slice(2)
const shouldApply = args.includes("--apply")
const confirmed = args.includes("--confirm-reset-cards")

async function countCollections(db) {
  return {
    player_cards: await db.collection("player_cards").countDocuments({}),
    player_card_upgrades: await db.collection("player_card_upgrades").countDocuments({}),
    tirage_sessions: await db.collection("tirage_sessions").countDocuments({}),
    exchange_sessions: await db.collection("exchange_sessions").countDocuments({}),
    combat_sessions: await db.collection("combat_sessions").countDocuments({}),
    daily_quests: await db.collection("daily_quests").countDocuments({}),
    tirage_cooldowns: await db.collection("tirage_cooldowns").countDocuments({}),
    combat_cooldowns: await db.collection("combat_cooldowns").countDocuments({}),
    player_wallets: await db.collection("player_wallets").countDocuments({}),
    player_profiles_with_favorite: await db.collection("player_profiles").countDocuments({
      favoriteCardKey: {
        $exists: true,
      },
    }),
  }
}

function printCounts(title, counts) {
  console.log(`\n${title}`)
  console.log("=".repeat(title.length))

  for (const [collection, count] of Object.entries(counts)) {
    console.log(`${collection}: ${count}`)
  }
}

async function main() {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI est manquant dans les variables d'environnement.")
  }

  const client = new MongoClient(MONGO_URI)

  try {
    await client.connect()

    const db = client.db(DB_NAME)

    console.log("Connexion MongoDB OK.")
    console.log(`Base utilisée : ${DB_NAME}`)

    const beforeCounts = await countCollections(db)
    printCounts("État actuel", beforeCounts)

    if (!shouldApply || !confirmed) {
      console.log("\nMode simulation uniquement.")
      console.log("Aucune donnée n'a été supprimée.")
      console.log("\nPour appliquer réellement le reset, lance :")
      console.log("node scripts/resetCardsKeepFragments.js --apply --confirm-reset-cards")
      return
    }

    console.log("\nRESET EN COURS...")
    console.log("Les fragments dans player_wallets ne seront pas modifiés.")

    const now = new Date()

    const results = {}

    results.player_cards = await db.collection("player_cards").deleteMany({})

    results.player_card_upgrades = await db.collection("player_card_upgrades").deleteMany({})

    results.tirage_sessions = await db.collection("tirage_sessions").deleteMany({})

    results.exchange_sessions = await db.collection("exchange_sessions").deleteMany({})

    results.combat_sessions = await db.collection("combat_sessions").deleteMany({})

    results.daily_quests = await db.collection("daily_quests").deleteMany({})

    results.tirage_cooldowns = await db.collection("tirage_cooldowns").deleteMany({})

    results.combat_cooldowns = await db.collection("combat_cooldowns").deleteMany({})

    results.player_profiles = await db.collection("player_profiles").updateMany(
      {
        favoriteCardKey: {
          $exists: true,
        },
      },
      {
        $unset: {
          favoriteCardKey: "",
        },
        $set: {
          updatedAt: now,
        },
      }
    )

    console.log("\nRésultat du reset")
    console.log("================")

    console.log(`player_cards supprimés : ${results.player_cards.deletedCount}`)
    console.log(`player_card_upgrades supprimés : ${results.player_card_upgrades.deletedCount}`)
    console.log(`tirage_sessions supprimées : ${results.tirage_sessions.deletedCount}`)
    console.log(`exchange_sessions supprimées : ${results.exchange_sessions.deletedCount}`)
    console.log(`combat_sessions supprimées : ${results.combat_sessions.deletedCount}`)
    console.log(`daily_quests supprimées : ${results.daily_quests.deletedCount}`)
    console.log(`tirage_cooldowns supprimés : ${results.tirage_cooldowns.deletedCount}`)
    console.log(`combat_cooldowns supprimés : ${results.combat_cooldowns.deletedCount}`)
    console.log(`profils modifiés : ${results.player_profiles.modifiedCount}`)

    const afterCounts = await countCollections(db)
    printCounts("État après reset", afterCounts)

    console.log("\nReset terminé.")
    console.log("Les fragments des joueurs ont été conservés.")
  } finally {
    await client.close()
  }
}

main().catch((error) => {
  console.error("Erreur pendant le reset :", error)
  process.exit(1)
})