const EPHEMERAL_FLAG = 64

function getInteractionLabel(interaction) {
  if (interaction.isChatInputCommand()) {
    return `/${interaction.commandName}`
  }

  if (interaction.isButton()) {
    return `button:${interaction.customId}`
  }

  if (interaction.isStringSelectMenu()) {
    return `select:${interaction.customId}`
  }

  if (interaction.isModalSubmit()) {
    return `modal:${interaction.customId}`
  }

  return interaction.type
}

function isUnknownInteractionError(error) {
  return error?.code === 10062 || error?.rawError?.code === 10062
}

async function safeErrorReply(interaction, message) {
  try {
    if (interaction.replied) {
      return interaction.followUp({
        content: message,
        flags: EPHEMERAL_FLAG,
      }).catch(() => {})
    }

    if (interaction.deferred) {
      return interaction.editReply({
        content: message,
      }).catch(() => {})
    }

    return interaction.reply({
      content: message,
      flags: EPHEMERAL_FLAG,
    }).catch(() => {})
  } catch {
    return null
  }
}

module.exports = {
  name: "interactionCreate",

  async execute(interaction, client) {
    const label = getInteractionLabel(interaction)

    try {
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName)

        if (!command) {
          return interaction.reply({
            content: "❌ Commande introuvable.",
            flags: EPHEMERAL_FLAG,
          }).catch(() => {})
        }

        console.log(`➡️ Interaction commande : ${label}`)
        await command.execute(interaction, client)
        return
      }

      if (interaction.isButton()) {
        console.log(`➡️ Interaction bouton : ${label}`)

        for (const command of client.commands.values()) {
          if (typeof command.handleButton === "function") {
            await command.handleButton(interaction, client)

            if (interaction.replied || interaction.deferred) {
              break
            }
          }
        }

        return
      }

      if (interaction.isStringSelectMenu()) {
        console.log(`➡️ Interaction select : ${label}`)

        for (const command of client.commands.values()) {
          if (typeof command.handleSelect === "function") {
            await command.handleSelect(interaction, client)

            if (interaction.replied || interaction.deferred) {
              break
            }
          }
        }

        return
      }

      if (interaction.isModalSubmit()) {
        console.log(`➡️ Interaction modal : ${label}`)

        for (const command of client.commands.values()) {
          if (typeof command.handleModal === "function") {
            await command.handleModal(interaction, client)

            if (interaction.replied || interaction.deferred) {
              break
            }
          }
        }

        return
      }
    } catch (error) {
      if (isUnknownInteractionError(error)) {
        console.warn(`⚠️ Interaction expirée : ${label}`)
        console.warn("Cause probable : la commande a mis plus de 3 secondes avant de répondre.")
        return
      }

      console.error(`❌ Erreur interaction : ${label}`)
      console.error(error)

      await safeErrorReply(
        interaction,
        "❌ Une erreur est survenue pendant l'exécution de cette interaction."
      )
    }
  },
}