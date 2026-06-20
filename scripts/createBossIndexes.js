require("dotenv").config()

const dns = require("dns")
const { MongoClient } = require("mongodb")

dns.setServers(["1.1.1.1", "8.8.8.8"])

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

    await Promise.all([
      db.collection("boss_sessions").createIndex({ status: 1, joinEndsAt: 1 }),
      db.collection("boss_sessions").createIndex({ guildId: 1, channelId: 1, createdAt: -1 }),
      db.collection("boss_sessions").createIndex({ messageId: 1 }),
    ])

    console.log("✅ Index boss créés avec succès.")
  } catch (error) {
    console.error("❌ Erreur création index boss :", error)
  } finally {
    await mongoClient.close()
  }
}

main()
