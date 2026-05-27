const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

const { ObjectId } = require("mongodb");

function getCharacterName(character) {
  return `${character.prenom || ""} ${character.nom || ""}`.trim() || "Personnage sans nom";
}

function isValidObjectId(id) {
  return ObjectId.isValid(id);
}

async function getPopularityScore(client, characterId) {
  return client.db.collection("popularity_votes").countDocuments({
    characterId: new ObjectId(characterId),
    value: 1,
  });
}

async function hasUserVoted(client, characterId, userId) {
  const vote = await client.db.collection("popularity_votes").findOne({
    characterId: new ObjectId(characterId),
    voterUserId: userId,
  });

  return Boolean(vote);
}

async function buildPopularityEmbed(client, character, userId) {
  const characterId = character._id.toString();

  const score = await getPopularityScore(client, characterId);
  const userHasVoted = await hasUserVoted(client, characterId, userId);

  const embed = new EmbedBuilder()
    .setTitle(`Popularité de ${getCharacterName(character)}`)
    .setColor(0xf1c40f)
    .setDescription("Système de vote de popularité entre personnages.")
    .addFields(
      {
        name: "Score actuel",
        value: `⭐ ${score} vote${score > 1 ? "s" : ""}`,
        inline: true,
      },
      {
        name: "Ton vote",
        value: userHasVoted ? "✅ Tu as voté pour ce personnage." : "❌ Tu n'as pas encore voté.",
        inline: true,
      }
    );

  if (character.image) {
    embed.setThumbnail(character.image);
  }

  return embed;
}

function buildPopularityButtons(characterId, isOwner) {
  const voteButton = new ButtonBuilder()
    .setCustomId(`popularite:vote:${characterId}`)
    .setLabel("Voter")
    .setStyle(ButtonStyle.Success)
    .setDisabled(isOwner);

  const removeVoteButton = new ButtonBuilder()
    .setCustomId(`popularite:remove:${characterId}`)
    .setLabel("Retirer mon vote")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(isOwner);

  const refreshButton = new ButtonBuilder()
    .setCustomId(`popularite:refresh:${characterId}`)
    .setLabel("Actualiser")
    .setStyle(ButtonStyle.Primary);

  return new ActionRowBuilder().addComponents(
    voteButton,
    removeVoteButton,
    refreshButton
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("popularite")
    .setDescription("Voter pour la popularité d'un personnage"),

  async execute(interaction, client) {
    const characters = await client.db
      .collection("characters")
      .find({
        userId: { $ne: interaction.user.id },
      })
      .limit(25)
      .toArray();

    if (!characters.length) {
      return interaction.reply({
        content: "❌ Aucun personnage d'un autre joueur n'est disponible pour le moment.",
        ephemeral: true,
      });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("popularite:select-character")
      .setPlaceholder("Choisis un personnage")
      .addOptions(
        characters.map((character) => ({
          label: getCharacterName(character).slice(0, 100),
          description: `Score de popularité disponible`,
          value: character._id.toString(),
        }))
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    return interaction.reply({
      content: "Choisis le personnage pour lequel tu veux voter :",
      components: [row],
      ephemeral: true,
    });
  },

  async handleSelect(interaction, client) {
    if (interaction.customId !== "popularite:select-character") return;

    const characterId = interaction.values[0];

    if (!isValidObjectId(characterId)) {
      return interaction.reply({
        content: "❌ Personnage invalide.",
        ephemeral: true,
      });
    }

    const character = await client.db.collection("characters").findOne({
      _id: new ObjectId(characterId),
    });

    if (!character) {
      return interaction.reply({
        content: "❌ Personnage introuvable.",
        ephemeral: true,
      });
    }

    const isOwner = character.userId === interaction.user.id;

    const embed = await buildPopularityEmbed(client, character, interaction.user.id);
    const row = buildPopularityButtons(characterId, isOwner);

    return interaction.update({
      content: "",
      embeds: [embed],
      components: [row],
    });
  },

  async handleButton(interaction, client) {
    if (interaction.customId.startsWith("popularite:vote:")) {
      const characterId = interaction.customId.replace("popularite:vote:", "");

      if (!isValidObjectId(characterId)) {
        return interaction.reply({
          content: "❌ Personnage invalide.",
          ephemeral: true,
        });
      }

      const character = await client.db.collection("characters").findOne({
        _id: new ObjectId(characterId),
      });

      if (!character) {
        return interaction.reply({
          content: "❌ Personnage introuvable.",
          ephemeral: true,
        });
      }

      if (character.userId === interaction.user.id) {
        return interaction.reply({
          content: "❌ Tu ne peux pas voter pour ton propre personnage.",
          ephemeral: true,
        });
      }

      await client.db.collection("popularity_votes").updateOne(
        {
          characterId: new ObjectId(characterId),
          voterUserId: interaction.user.id,
        },
        {
          $set: {
            characterId: new ObjectId(characterId),
            targetUserId: character.userId,
            voterUserId: interaction.user.id,
            value: 1,
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

      const embed = await buildPopularityEmbed(client, character, interaction.user.id);
      const row = buildPopularityButtons(characterId, false);

      return interaction.update({
        content: "✅ Ton vote a été pris en compte.",
        embeds: [embed],
        components: [row],
      });
    }

    if (interaction.customId.startsWith("popularite:remove:")) {
      const characterId = interaction.customId.replace("popularite:remove:", "");

      if (!isValidObjectId(characterId)) {
        return interaction.reply({
          content: "❌ Personnage invalide.",
          ephemeral: true,
        });
      }

      const character = await client.db.collection("characters").findOne({
        _id: new ObjectId(characterId),
      });

      if (!character) {
        return interaction.reply({
          content: "❌ Personnage introuvable.",
          ephemeral: true,
        });
      }

      await client.db.collection("popularity_votes").deleteOne({
        characterId: new ObjectId(characterId),
        voterUserId: interaction.user.id,
      });

      const embed = await buildPopularityEmbed(client, character, interaction.user.id);
      const row = buildPopularityButtons(characterId, character.userId === interaction.user.id);

      return interaction.update({
        content: "✅ Ton vote a été retiré.",
        embeds: [embed],
        components: [row],
      });
    }

    if (interaction.customId.startsWith("popularite:refresh:")) {
      const characterId = interaction.customId.replace("popularite:refresh:", "");

      if (!isValidObjectId(characterId)) {
        return interaction.reply({
          content: "❌ Personnage invalide.",
          ephemeral: true,
        });
      }

      const character = await client.db.collection("characters").findOne({
        _id: new ObjectId(characterId),
      });

      if (!character) {
        return interaction.reply({
          content: "❌ Personnage introuvable.",
          ephemeral: true,
        });
      }

      const embed = await buildPopularityEmbed(client, character, interaction.user.id);
      const row = buildPopularityButtons(characterId, character.userId === interaction.user.id);

      return interaction.update({
        embeds: [embed],
        components: [row],
      });
    }
  },
};