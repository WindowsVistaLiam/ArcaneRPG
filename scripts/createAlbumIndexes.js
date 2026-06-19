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
      db.collection("player_album_rewards").createIndex(
        { userId: 1, albumKey: 1, level: 1 },
        { unique: true }
      ),

      db.collection("player_album_notifications").createIndex(
        { userId: 1, albumKey: 1, level: 1 },
        { unique: true }
      ),

      db.collection("player_titles").createIndex(
        { userId: 1, titleKey: 1 },
        { unique: true }
      ),
    ])

    console.log("✅ Index albums créés avec succès.")
  } catch (error) {
    console.error("❌ Erreur création index albums :", error)
  } finally {
    await mongoClient.close()
  }
}

main()
