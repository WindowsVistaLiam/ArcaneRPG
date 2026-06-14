const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const { ObjectId } = require("mongodb");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("image")
    .setDescription("Modifier l'image d'un de tes personnages"),

  async execute(interaction, client) {
    const characters = await client.db
      .collection("characters")
      .find({ userId: interaction.user.id })
      .toArray();

    if (!characters.length) {
      return interaction.reply({
        content: "❌ Tu n'as aucun personnage à modifier.",
        ephemeral: true,
      });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("select_image_character")
      .setPlaceholder("Choisis le personnage à modifier")
      .addOptions(
        characters.slice(0, 25).map((character) => {
          const fullName = `${character.prenom || ""} ${character.nom || ""}`.trim();

          return {
            label: fullName || "Personnage sans nom",
            description: "Modifier l'image de ce personnage",
            value: character._id.toString(),
          };
        })
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    return interaction.reply({
      content: "Sélectionne le personnage dont tu veux modifier l'image :",
      components: [row],
      ephemeral: true,
    });
  },

  async handleSelect(interaction, client) {
    if (interaction.customId !== "select_image_character") return;

    const characterId = interaction.values[0];

    const character = await client.db.collection("characters").findOne({
      _id: new ObjectId(characterId),
      userId: interaction.user.id,
    });

    if (!character) {
      return interaction.reply({
        content: "❌ Personnage introuvable ou non autorisé.",
        ephemeral: true,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`image_modal_${characterId}`)
      .setTitle("Modifier l'image");

    const imageInput = new TextInputBuilder()
      .setCustomId("image")
      .setLabel("Nouvelle URL de l'image")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("https://exemple.com/image.png")
      .setRequired(true);

    const row = new ActionRowBuilder().addComponents(imageInput);

    modal.addComponents(row);

    return interaction.showModal(modal);
  },

  async handleModal(interaction, client) {
    if (!interaction.customId.startsWith("image_modal_")) return;

    const characterId = interaction.customId.replace("image_modal_", "");
    const imageUrl = interaction.fields.getTextInputValue("image");

    if (!/^https?:\/\/.+/i.test(imageUrl)) {
      return interaction.reply({
        content: "❌ L'image doit être une URL valide commençant par `http://` ou `https://`.",
        ephemeral: true,
      });
    }

    const result = await client.db.collection("characters").updateOne(
      {
        _id: new ObjectId(characterId),
        userId: interaction.user.id,
      },
      {
        $set: {
          image: imageUrl,
        },
      }
    );

    if (result.matchedCount === 0) {
      return interaction.reply({
        content: "❌ Personnage introuvable ou non autorisé.",
        ephemeral: true,
      });
    }

    return interaction.reply({
      content: "✅ L'image du personnage a bien été modifiée.",
      ephemeral: true,
    });
  },
};