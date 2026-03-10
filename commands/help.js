const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { COLORS } = require("../style"); // Couleurs Arcane

module.exports = {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Affiche la liste des commandes disponibles"),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle("🛡️ Arcane RPG - Commandes")
            .setDescription("Voici les commandes que tu peux utiliser avec le bot :")
            .setColor(COLORS.primary)
            .addFields(
                { name: "/profil", value: "Voir vos personnages et naviguer entre eux" },
                { name: "/profil <@user>", value: "Voir les personnages d’un autre joueur" },
                { name: "/create", value: "Créer un nouveau personnage" },
                { name: "/edit", value: "Modifier un de vos personnages existants" },
                { name: "/delete", value: "Supprimer un de vos personnages" },
                { name: "/help", value: "Afficher ce message d'aide" }
            )
            .setFooter({ text: "Arcane RPG ⚔️", iconURL: "https://i.imgur.com/0XkHxHV.png" })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};