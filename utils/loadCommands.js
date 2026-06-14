const fs = require("fs")
const path = require("path")

function getCommandFiles(dir) {
  const files = []

  if (!fs.existsSync(dir)) {
    return files
  }

  const entries = fs.readdirSync(dir, {
    withFileTypes: true,
  })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...getCommandFiles(fullPath))
    }

    if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath)
    }
  }

  return files
}

function loadCommands(client, commandsPath) {
  const commandFiles = getCommandFiles(commandsPath)

  let loadedCount = 0

  for (const filePath of commandFiles) {
    try {
      delete require.cache[require.resolve(filePath)]

      const command = require(filePath)

      if (!command.data || !command.data.name || typeof command.execute !== "function") {
        console.warn(`⚠️ Commande ignorée : ${filePath}`)
        continue
      }

      client.commands.set(command.data.name, command)
      loadedCount++

      console.log(`✅ Commande chargée : /${command.data.name}`)
    } catch (error) {
      console.error(`❌ Erreur chargement commande : ${filePath}`)
      console.error(error)
    }
  }

  console.log(`📦 ${loadedCount} commande(s) chargée(s).`)
}

function loadCommandsForDeploy(commandsPath) {
  const commandFiles = getCommandFiles(commandsPath)
  const commands = []

  for (const filePath of commandFiles) {
    try {
      delete require.cache[require.resolve(filePath)]

      const command = require(filePath)

      if (!command.data || !command.data.name) {
        console.warn(`⚠️ Commande ignorée au déploiement : ${filePath}`)
        continue
      }

      commands.push(command.data.toJSON())
      console.log(`✅ Commande prête au deploy : /${command.data.name}`)
    } catch (error) {
      console.error(`❌ Erreur deploy commande : ${filePath}`)
      console.error(error)
    }
  }

  return commands
}

module.exports = {
  getCommandFiles,
  loadCommands,
  loadCommandsForDeploy,
}