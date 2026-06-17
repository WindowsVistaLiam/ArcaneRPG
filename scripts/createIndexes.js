const dns = require("dns")
dns.setServers(["1.1.1.1", "8.8.8.8"])

require("dotenv").config()

const { MongoClient } = require("mongodb")

async function main() {
  const mongoClient = new MongoClient(process.env.MONGO_URI)

  try {
    await mongoClient.connect()
    const db = mongoClient.db("arcaneRPG")

    await Promise.all([
      db.collection("player_cards").createIndex(
        { userId: 1, cardKey: 1 },
        { unique: true }
      ),

      db.collection("player_profiles").createIndex(
        { userId: 1 },
        { unique: true }
      ),

      db.collection("player_wallets").createIndex(
        { userId: 1 },
        { unique: true }
      ),

      db.collection("player_card_upgrades").createIndex(
        { userId: 1, cardKey: 1 },
        { unique: true }
      ),

      db.collection("player_effects").createIndex(
        { userId: 1, effectKey: 1, uses: 1 }
      ),

      db.collection("combat_cooldowns").createIndex(
        { userId: 1, type: 1 },
        { unique: true }
      ),

      db.collection("combat_sessions").createIndex(
        { status: 1, expiresAt: 1 }
      ),

      db.collection("combat_stats").createIndex(
        { userId: 1 },
        { unique: true }
      ),

      db.collection("daily_quests").createIndex(
        { userId: 1, dateKey: 1 },
        { unique: true }
      ),

      db.collection("tirage_cooldowns").createIndex(
        { userId: 1 },
        { unique: true }
      ),

      db.collection("tirage_sessions").createIndex(
        { userId: 1, createdAt: -1 }
      ),

      db.collection("relations").createIndex(
        { sourceCharacterId: 1, targetCharacterId: 1 },
        { unique: true }
      ),

      db.collection("popularity_votes").createIndex(
        { characterId: 1, voterUserId: 1 },
        { unique: true }
      ),
    ])

    console.log("✅ Index MongoDB créés avec succès.")
  } catch (error) {
    console.error("❌ Erreur création index :", error)
  } finally {
    await mongoClient.close()
  }
}

main()