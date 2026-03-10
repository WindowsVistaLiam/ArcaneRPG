const { EmbedBuilder } = require("discord.js")

// 🌌 Couleurs Arcane RPG
const COLORS = {
    primary: 0x6a0dad,    // violet foncé
    secondary: 0xffd700,  // or
    danger: 0xff0000,     // rouge
    success: 0x00ff00,    // vert
    info: 0x1e90ff        // bleu ciel
}

// ⚡ Helper pour sécuriser les champs
function safe(val, defaultVal = "Inconnu") {
    return val && val !== "1" ? val : defaultVal
}

// ⚔️ Embed personnage
function characterEmbed(character, page, total) {
    return new EmbedBuilder()
        .setTitle(`✨ ${safe(character.prenom)} ${safe(character.nom)} ✨`)
        .setDescription(safe(character.description, "Aucune description..."))
        .setColor(COLORS.primary)
        .addFields(
            { name: "🗓️ Âge", value: safe(character.age), inline: true },
            { name: "⚧ Genre", value: safe(character.sexe), inline: true },
            { name: "🏳️ Orientation", value: safe(character.orientation), inline: true }
        )
        .setFooter({ text: `Personnage ${page + 1} / ${total} | Arcane RPG ⚔️`, iconURL: "https://i.imgur.com/0XkHxHV.png" })
        .setImage(character.image && character.image !== "1" ? character.image : null)
        .setTimestamp()
}

// ✅ Embed succès
function successEmbed(message) {
    return new EmbedBuilder()
        .setTitle("✅ Succès !")
        .setDescription(message)
        .setColor(COLORS.success)
        .setFooter({ text: "Arcane RPG ⚔️" })
}

// ❌ Embed erreur
function errorEmbed(message) {
    return new EmbedBuilder()
        .setTitle("❌ Erreur !")
        .setDescription(message)
        .setColor(COLORS.danger)
        .setFooter({ text: "Arcane RPG ⚔️" })
}

// ℹ️ Embed info
function infoEmbed(message) {
    return new EmbedBuilder()
        .setTitle("ℹ️ Info")
        .setDescription(message)
        .setColor(COLORS.info)
        .setFooter({ text: "Arcane RPG ⚔️" })
}

module.exports = {
    COLORS,
    characterEmbed,
    successEmbed,
    errorEmbed,
    infoEmbed
}