const { ObjectId } = require("mongodb");

module.exports = {
  name: "interactionCreate",

  async execute(interaction, client) {
    try {
      // --- Slash commands ---
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) {
          return interaction.reply({
            content: "❌ Commande introuvable.",
            ephemeral: true,
          });
        }

        await command.execute(interaction, client);
        return;
      }

      // --- Menus déroulants ---
      if (interaction.isStringSelectMenu()) {
        for (const command of client.commands.values()) {
          if (typeof command.handleSelect === "function") {
            await command.handleSelect(interaction, client);
          }
        }

        return;
      }

      // --- Boutons ---
      if (interaction.isButton()) {
        for (const command of client.commands.values()) {
          if (typeof command.handleButton === "function") {
            await command.handleButton(interaction, client);
          }
        }

        return;
      }

      // --- Modal submit pour /editperso ---
      if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith("edit_modal_")
      ) {
        const charId = interaction.customId.split("_")[2];
        const characters = client.db.collection("characters");

        const nomPrenom = interaction.fields.getTextInputValue("nom_prenom");

        let nom = "";
        let prenom = "";

        if (nomPrenom) {
          const parts = nomPrenom.split(" ");
          prenom = parts.shift() || "";
          nom = parts.join(" ") || "";
        }

        await characters.updateOne(
          { _id: new ObjectId(charId) },
          {
            $set: {
              nom: nom,
              prenom: prenom,
              age: interaction.fields.getTextInputValue("age"),
              sexe: interaction.fields.getTextInputValue("sexe"),
              orientation: interaction.fields.getTextInputValue("orientation"),
              description: interaction.fields.getTextInputValue("description"),
            },
          }
        );

        await interaction.reply({
          content: "✅ Personnage mis à jour !",
          ephemeral: true,
        });

        return;
      }

      // --- Autres modals : /image, futures commandes, etc. ---
      if (interaction.isModalSubmit()) {
        for (const command of client.commands.values()) {
          if (typeof command.handleModal === "function") {
            await command.handleModal(interaction, client);
          }
        }

        return;
      }
    } catch (err) {
      console.error("❌ Erreur interaction :", err);

      if (interaction.replied || interaction.deferred) {
        await interaction
          .editReply({
            content: "❌ Une erreur est survenue.",
          })
          .catch(async () => {
            await interaction
              .followUp({
                content: "❌ Une erreur est survenue.",
                ephemeral: true,
              })
              .catch(() => {});
          });
      } else {
        await interaction
          .reply({
            content: "❌ Une erreur est survenue.",
            ephemeral: true,
          })
          .catch(() => {});
      }
    }
  },
};  