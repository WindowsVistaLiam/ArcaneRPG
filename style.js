const { EmbedBuilder } = require("discord.js")

// 🌌 Couleurs Arcane RPG
const COLORS = {
    primary: 0x6a0dad,    // violet foncé
    secondary: 0xffd700,  // or
    danger: 0xff0000,     // rouge
    success: 0x00ff00,    // vert
    info: 0x1e90ff        // bleu ciel
}

// ⚔️ Embed personnage
function characterEmbed(character, page, total) {
    return new EmbedBuilder()
        .setTitle(`✨ ${character.prenom} ${character.nom} ✨`)
        .setColor(COLORS.primary)
        .addFields(
            { name: "🗓️ Âge", value: character.age, inline: true },
            { name: "⚧ Sexe", value: character.sexe, inline: true },
            { name: "🏳️ Orientation", value: character.orientation, inline: true },
            { name: "📝 Description", value: character.description }
        )
        .setImage(character.image)
        .setFooter({ text: `Personnage ${page+1}/${total} | Arcane RPG ⚔️` })
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