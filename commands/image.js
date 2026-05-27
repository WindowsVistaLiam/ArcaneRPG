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
    .setDescription("Modifier l'image de profil d'un personnage"),

  async execute(interaction, db) {
    const characters = await db
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
      .setPlaceholder("Choisis le personnage dont tu veux modifier l'image")
      .addOptions(
        characters.map((character) => ({
          label: `${character.prenom || ""} ${character.nom || ""}`.trim(),
          description: "Modifier l'image de ce personnage",
          value: character._id.toString(),
        }))
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      content: "Sélectionne le personnage à modifier :",
      components: [row],
      ephemeral: true,
    });
  },

  async handleSelect(interaction, db) {
    if (interaction.customId !== "select_image_character") return;

    const characterId = interaction.values[0];

    const modal = new ModalBuilder()
      .setCustomId(`image_modal_${characterId}`)
      .setTitle("Modifier l'image du personnage");

    const imageInput = new TextInputBuilder()
      .setCustomId("image")
      .setLabel("Nouvelle URL de l'image")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("https://exemple.com/image.png")
      .setRequired(true);

    const row = new ActionRowBuilder().addComponents(imageInput);

    modal.addComponents(row);

    await interaction.showModal(modal);
  },

  async handleModal(interaction, db) {
    if (!interaction.customId.startsWith("image_modal_")) return;

    const characterId = interaction.customId.replace("image_modal_", "");
    const imageUrl = interaction.fields.getTextInputValue("image");

    const character = await db.collection("characters").findOne({
      _id: new ObjectId(characterId),
      userId: interaction.user.id,
    });

    if (!character) {
      return interaction.reply({
        content: "❌ Personnage introuvable ou non autorisé.",
        ephemeral: true,
      });
    }

    await db.collection("characters").updateOne(
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

    await interaction.reply({
      content: "✅ L'image du personnage a bien été modifiée.",
      ephemeral: true,
    });
  },
};