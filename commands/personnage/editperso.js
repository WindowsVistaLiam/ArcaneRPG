const {
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js")
const { ObjectId } = require("mongodb")

function truncateText(text, maxLength) {
  const value = String(text || "")

  if (value.length <= maxLength) return value

  return value.slice(0, maxLength)
}

function buildCharacterLabel(character) {
  const prenom = character.prenom || "Sans prénom"
  const nom = character.nom || "Sans nom"

  return truncateText(`${prenom} ${nom}`, 100)
}

function buildCharacterDescription(character) {
  const description = character.description || "Aucune description."

  return truncateText(description, 100)
}

function parseNomPrenom(value, oldCharacter) {
  const raw = String(value || "").trim()
  const parts = raw.split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return {
      nom: oldCharacter.nom || "",
      prenom: oldCharacter.prenom || "",
    }
  }

  if (parts.length === 1) {
    return {
      nom: parts[0],
      prenom: oldCharacter.prenom || "",
    }
  }

  return {
    nom: parts[0],
    prenom: parts.slice(1).join(" "),
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("editperso")
    .setDescription("Modifier un de vos personnages"),

  async execute(interaction, client) {
    await interaction.deferReply({
      ephemeral: true,
    })

    const characters = client.db.collection("characters")

    const persos = await characters
      .find({ userId: interaction.user.id })
      .sort({ prenom: 1, nom: 1 })
      .toArray()

    if (persos.length === 0) {
      return interaction.editReply({
        content: "❌ Tu n'as aucun personnage à modifier.",
      })
    }

    const displayedPersos = persos.slice(0, 25)

    const options = displayedPersos.map((character) => ({
      label: buildCharacterLabel(character),
      description: buildCharacterDescription(character),
      value: character._id.toString(),
    }))

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`editperso:select:${interaction.user.id}`)
      .setPlaceholder("Sélectionne le personnage à modifier")
      .addOptions(options)

    const row = new ActionRowBuilder().addComponents(menu)

    const warning = persos.length > 25
      ? "\n\n⚠️ Tu as plus de 25 personnages. Discord limite le menu à 25 choix, donc seuls les 25 premiers sont affichés."
      : ""

    return interaction.editReply({
      content: `Quel personnage veux-tu modifier ?${warning}`,
      components: [row],
    })
  },

  async handleSelect(interaction, client) {
    if (!interaction.customId.startsWith("editperso:select:")) return

    const [, , ownerId] = interaction.customId.split(":")

    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: "❌ Tu ne peux pas modifier les personnages d'un autre joueur avec ce menu.",
        ephemeral: true,
      })
    }

    const characterId = interaction.values[0]

    if (!ObjectId.isValid(characterId)) {
      return interaction.reply({
        content: "❌ Personnage invalide.",
        ephemeral: true,
      })
    }

    const character = await client.db.collection("characters").findOne({
      _id: new ObjectId(characterId),
      userId: interaction.user.id,
    })

    if (!character) {
      return interaction.reply({
        content: "❌ Ce personnage est introuvable ou ne t'appartient pas.",
        ephemeral: true,
      })
    }

    const modalTitle = truncateText(
      `Modifier ${character.prenom || ""} ${character.nom || ""}`.trim(),
      45
    )

    const modal = new ModalBuilder()
      .setCustomId(`editperso:modal:${interaction.user.id}:${character._id.toString()}`)
      .setTitle(modalTitle || "Modifier personnage")

    const inputNomPrenom = new TextInputBuilder()
      .setCustomId("nom_prenom")
      .setLabel("Nom puis prénom")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100)
      .setValue(truncateText(`${character.nom || ""} ${character.prenom || ""}`.trim(), 100))

    const inputAge = new TextInputBuilder()
      .setCustomId("age")
      .setLabel("Âge")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(50)
      .setValue(truncateText(character.age || "", 50))

    const inputGenre = new TextInputBuilder()
      .setCustomId("sexe")
      .setLabel("Genre")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100)
      .setValue(truncateText(character.sexe || "", 100))

    const inputOrientation = new TextInputBuilder()
      .setCustomId("orientation")
      .setLabel("Orientation")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100)
      .setValue(truncateText(character.orientation || "", 100))

    const inputDescription = new TextInputBuilder()
      .setCustomId("description")
      .setLabel("Description")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(4000)
      .setValue(truncateText(character.description || "", 4000))

    modal.addComponents(
      new ActionRowBuilder().addComponents(inputNomPrenom),
      new ActionRowBuilder().addComponents(inputAge),
      new ActionRowBuilder().addComponents(inputGenre),
      new ActionRowBuilder().addComponents(inputOrientation),
      new ActionRowBuilder().addComponents(inputDescription)
    )

    return interaction.showModal(modal)
  },

  async handleModal(interaction, client) {
    if (!interaction.customId.startsWith("editperso:modal:")) return

    const parts = interaction.customId.split(":")
    const ownerId = parts[2]
    const characterId = parts[3]

    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: "❌ Tu ne peux pas modifier les personnages d'un autre joueur.",
        ephemeral: true,
      })
    }

    if (!ObjectId.isValid(characterId)) {
      return interaction.reply({
        content: "❌ Personnage invalide.",
        ephemeral: true,
      })
    }

    await interaction.deferReply({
      ephemeral: true,
    })

    const characters = client.db.collection("characters")

    const oldCharacter = await characters.findOne({
      _id: new ObjectId(characterId),
      userId: interaction.user.id,
    })

    if (!oldCharacter) {
      return interaction.editReply({
        content: "❌ Ce personnage est introuvable ou ne t'appartient pas.",
      })
    }

    const nomPrenomValue = interaction.fields.getTextInputValue("nom_prenom")
    const { nom, prenom } = parseNomPrenom(nomPrenomValue, oldCharacter)

    const age = interaction.fields.getTextInputValue("age").trim()
    const sexe = interaction.fields.getTextInputValue("sexe").trim()
    const orientation = interaction.fields.getTextInputValue("orientation").trim()
    const description = interaction.fields.getTextInputValue("description").trim()

    if (!nom || !prenom || !age || !sexe || !orientation || !description) {
      return interaction.editReply({
        content:
          "❌ Tous les champs sont obligatoires.\n" +
          "Pour le premier champ, écris bien sous la forme : `Nom Prénom`.",
      })
    }

    await characters.updateOne(
      {
        _id: new ObjectId(characterId),
        userId: interaction.user.id,
      },
      {
        $set: {
          nom,
          prenom,
          age,
          sexe,
          orientation,
          description,
          updatedAt: new Date(),
        },
      }
    )

    return interaction.editReply({
      content: `✅ Le personnage **${prenom} ${nom}** a bien été modifié.`,
    })
  },
}