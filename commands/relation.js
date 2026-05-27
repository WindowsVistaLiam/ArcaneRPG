const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const { ObjectId } = require("mongodb");

function getCharacterName(character) {
  return `${character.prenom || ""} ${character.nom || ""}`.trim() || "Personnage sans nom";
}

async function buildRelationEmbed(client, sourceCharacter) {
  const relationsCollection = client.db.collection("relations");
  const charactersCollection = client.db.collection("characters");

  const relations = await relationsCollection
    .find({ sourceCharacterId: sourceCharacter._id })
    .sort({ createdAt: -1 })
    .toArray();

  const embed = new EmbedBuilder()
    .setTitle(`Relations de ${getCharacterName(sourceCharacter)}`)
    .setColor(0x8e44ad)
    .setDescription("Interface de gestion des relations du personnage.");

  if (sourceCharacter.image) {
    embed.setThumbnail(sourceCharacter.image);
  }

  if (!relations.length) {
    embed.addFields({
      name: "Relations",
      value: "Aucune relation définie pour ce personnage.",
    });

    return embed;
  }

  const targetIds = relations.map((relation) => relation.targetCharacterId);

  const targetCharacters = await charactersCollection
    .find({ _id: { $in: targetIds } })
    .toArray();

  const targetMap = new Map(
    targetCharacters.map((character) => [character._id.toString(), character])
  );

  const relationText = relations
    .map((relation) => {
      const targetCharacter = targetMap.get(relation.targetCharacterId.toString());
      const targetName = targetCharacter
        ? getCharacterName(targetCharacter)
        : "Personnage supprimé";

      return `**${targetName}** — ${relation.label}`;
    })
    .join("\n");

  embed.addFields({
    name: "Relations",
    value: relationText.slice(0, 1024),
  });

  return embed;
}

async function showRelationInterface(interaction, client, sourceCharacter) {
  const embed = await buildRelationEmbed(client, sourceCharacter);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`relation:add:${sourceCharacter._id.toString()}`)
      .setLabel("Ajouter une relation")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId(`relation:refresh:${sourceCharacter._id.toString()}`)
      .setLabel("Actualiser")
      .setStyle(ButtonStyle.Secondary)
  );

  if (interaction.replied || interaction.deferred) {
    return interaction.editReply({
      embeds: [embed],
      components: [row],
    });
  }

  return interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("relation")
    .setDescription("Ouvrir l'interface de relations de tes personnages"),

  async execute(interaction, client) {
    const characters = await client.db
      .collection("characters")
      .find({ userId: interaction.user.id })
      .toArray();

    if (!characters.length) {
      return interaction.reply({
        content: "❌ Tu n'as aucun personnage.",
        ephemeral: true,
      });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("relation:select-source")
      .setPlaceholder("Choisis ton personnage")
      .addOptions(
        characters.slice(0, 25).map((character) => ({
          label: getCharacterName(character).slice(0, 100),
          description: "Ouvrir les relations de ce personnage",
          value: character._id.toString(),
        }))
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    return interaction.reply({
      content: "Choisis le personnage dont tu veux gérer les relations :",
      components: [row],
      ephemeral: true,
    });
  },

  async handleSelect(interaction, client) {
    if (interaction.customId === "relation:select-source") {
      const sourceCharacterId = interaction.values[0];

      const sourceCharacter = await client.db.collection("characters").findOne({
        _id: new ObjectId(sourceCharacterId),
        userId: interaction.user.id,
      });

      if (!sourceCharacter) {
        return interaction.reply({
          content: "❌ Personnage introuvable ou non autorisé.",
          ephemeral: true,
        });
      }

      const embed = await buildRelationEmbed(client, sourceCharacter);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`relation:add:${sourceCharacter._id.toString()}`)
          .setLabel("Ajouter une relation")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId(`relation:refresh:${sourceCharacter._id.toString()}`)
          .setLabel("Actualiser")
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.update({
        content: "",
        embeds: [embed],
        components: [row],
      });
    }

    if (interaction.customId.startsWith("relation:select-target:")) {
      const sourceCharacterId = interaction.customId.replace("relation:select-target:", "");
      const targetCharacterId = interaction.values[0];

      const sourceCharacter = await client.db.collection("characters").findOne({
        _id: new ObjectId(sourceCharacterId),
        userId: interaction.user.id,
      });

      if (!sourceCharacter) {
        return interaction.reply({
          content: "❌ Personnage source introuvable ou non autorisé.",
          ephemeral: true,
        });
      }

      const targetCharacter = await client.db.collection("characters").findOne({
        _id: new ObjectId(targetCharacterId),
      });

      if (!targetCharacter) {
        return interaction.reply({
          content: "❌ Personnage cible introuvable.",
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`relation:modal:${sourceCharacterId}:${targetCharacterId}`)
        .setTitle("Définir la relation");

      const relationInput = new TextInputBuilder()
        .setCustomId("relation_label")
        .setLabel("Nom de la relation")
        .setPlaceholder("Ami d'enfance, Rival, Protégé, Ex, Ennemi juré...")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(80)
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(relationInput);

      modal.addComponents(row);

      return interaction.showModal(modal);
    }
  },

  async handleButton(interaction, client) {
    if (interaction.customId.startsWith("relation:add:")) {
      const sourceCharacterId = interaction.customId.replace("relation:add:", "");

      const sourceCharacter = await client.db.collection("characters").findOne({
        _id: new ObjectId(sourceCharacterId),
        userId: interaction.user.id,
      });

      if (!sourceCharacter) {
        return interaction.reply({
          content: "❌ Personnage introuvable ou non autorisé.",
          ephemeral: true,
        });
      }

      const targetCharacters = await client.db
        .collection("characters")
        .find({
          _id: { $ne: new ObjectId(sourceCharacterId) },
          userId: { $ne: interaction.user.id },
        })
        .limit(25)
        .toArray();

      if (!targetCharacters.length) {
        return interaction.reply({
          content: "❌ Aucun personnage d'un autre joueur n'est disponible pour créer une relation.",
          ephemeral: true,
        });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`relation:select-target:${sourceCharacterId}`)
        .setPlaceholder("Choisis le personnage à ajouter en relation")
        .addOptions(
          targetCharacters.map((character) => ({
            label: getCharacterName(character).slice(0, 100),
            description: `Joueur Discord : ${character.userId}`,
            value: character._id.toString(),
          }))
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      return interaction.reply({
        content: `Choisis le personnage à lier à **${getCharacterName(sourceCharacter)}** :`,
        components: [row],
        ephemeral: true,
      });
    }

    if (interaction.customId.startsWith("relation:refresh:")) {
      const sourceCharacterId = interaction.customId.replace("relation:refresh:", "");

      const sourceCharacter = await client.db.collection("characters").findOne({
        _id: new ObjectId(sourceCharacterId),
        userId: interaction.user.id,
      });

      if (!sourceCharacter) {
        return interaction.reply({
          content: "❌ Personnage introuvable ou non autorisé.",
          ephemeral: true,
        });
      }

      const embed = await buildRelationEmbed(client, sourceCharacter);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`relation:add:${sourceCharacter._id.toString()}`)
          .setLabel("Ajouter une relation")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId(`relation:refresh:${sourceCharacter._id.toString()}`)
          .setLabel("Actualiser")
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.update({
        embeds: [embed],
        components: [row],
      });
    }
  },

  async handleModal(interaction, client) {
    if (!interaction.customId.startsWith("relation:modal:")) return;

    const parts = interaction.customId.split(":");
    const sourceCharacterId = parts[2];
    const targetCharacterId = parts[3];

    const label = interaction.fields.getTextInputValue("relation_label").trim();

    const sourceCharacter = await client.db.collection("characters").findOne({
      _id: new ObjectId(sourceCharacterId),
      userId: interaction.user.id,
    });

    if (!sourceCharacter) {
      return interaction.reply({
        content: "❌ Personnage source introuvable ou non autorisé.",
        ephemeral: true,
      });
    }

    const targetCharacter = await client.db.collection("characters").findOne({
      _id: new ObjectId(targetCharacterId),
    });

    if (!targetCharacter) {
      return interaction.reply({
        content: "❌ Personnage cible introuvable.",
        ephemeral: true,
      });
    }

    await client.db.collection("relations").updateOne(
      {
        sourceCharacterId: new ObjectId(sourceCharacterId),
        targetCharacterId: new ObjectId(targetCharacterId),
      },
      {
        $set: {
          sourceCharacterId: new ObjectId(sourceCharacterId),
          sourceUserId: interaction.user.id,
          targetCharacterId: new ObjectId(targetCharacterId),
          targetUserId: targetCharacter.userId,
          label,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      {
        upsert: true,
      }
    );

    return interaction.reply({
      content: `✅ Relation ajoutée : **${getCharacterName(sourceCharacter)}** → **${getCharacterName(targetCharacter)}** : ${label}`,
      ephemeral: true,
    });
  },
};