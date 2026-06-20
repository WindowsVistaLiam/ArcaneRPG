require("dotenv").config()

const dns = require("dns")
const { MongoClient } = require("mongodb")

dns.setServers(["1.1.1.1", "8.8.8.8"])

async function dropIndexIfExists(collection, indexName) {
  const indexes = await collection.indexes()
  const exists = indexes.some((index) => index.name === indexName)

  if (!exists) return

  await collection.dropIndex(indexName)
  console.log(`🗑️ Index supprimé : ${indexName}`)
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI manquant dans le fichier .env")
    process.exit(1)
  }

  const mongoClient = new MongoClient(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
  })

  try {
    console.log("Connexion à MongoDB Atlas...")
    await mongoClient.connect()

    const db = mongoClient.db("arcaneRPG")
    const playerEffects = db.collection("player_effects")

    await dropIndexIfExists(playerEffects, "userId_1_effectKey_1_uses_1")

    await playerEffects.createIndex(
      { userId: 1, effectKey: 1 },
      { unique: true }
    )

    await playerEffects.createIndex(
      { expiresAt: 1 },
      {
        expireAfterSeconds: 0,
        partialFilterExpression: {
          expiresAt: { $type: "date" },
        },
      }
    )

    console.log("✅ Index des effets 24h créés avec succès.")
  } catch (error) {
    console.error("❌ Erreur création index effets :", error)
  } finally {
    await mongoClient.close()
  }
}

main()
