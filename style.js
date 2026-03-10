const { EmbedBuilder } = require("discord.js")

// 🎨 Couleurs Arcane RPG
const COLORS = {
    primary: 0x6a0dad,
    secondary: 0xffd700,
    danger: 0xff0000,
    success: 0x00ff00,
    info: 0x1e90ff
}

// ⚔️ Embed personnage stylé RP
function characterEmbed(character, page, total) {

    return new EmbedBuilder()
        .setColor(COLORS.primary)

        .setTitle(`╔══════════════════════╗
   ⚔️ ${character.prenom} ${character.nom} ⚔️
╚══════════════════════╝`)

        .setDescription(`╭─────── 🧬 Informations ───────╮
**Âge :** ${character.age || "Inconnu"}
**Genre :** ${character.sexe || "Inconnu"}
**Orientation :** ${character.orientation || "Inconnu"}
╰──────────────────────────────╯

╭─────── 📜 Description ───────╮
${character.description || "Aucune description"}
╰──────────────────────────────╯`)

        .setImage(character.image || null)

        .setFooter({
            text: `╔ Page ${page + 1} / ${total} • Arcane RPG ⚔️ ╗`
        })

        .setTimestamp()
}

// ✅ Embed succès
function successEmbed(message) {
    return new EmbedBuilder()
        .setColor(COLORS.success)
        .setTitle("╔═══════ ✅ Succès ═══════╗")
        .setDescription(message)
        .setFooter({ text: "Arcane RPG ⚔️" })
}

// ❌ Embed erreur
function errorEmbed(message) {
    return new EmbedBuilder()
        .setColor(COLORS.danger)
        .setTitle("╔═══════ ❌ Erreur ═══════╗")
        .setDescription(message)
        .setFooter({ text: "Arcane RPG ⚔️" })
}

// ℹ️ Embed info
function infoEmbed(message) {
    return new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle("╔═══════ ℹ️ Information ═══════╗")
        .setDescription(message)
        .setFooter({ text: "Arcane RPG ⚔️" })
}

module.exports = {
    COLORS,
    characterEmbed,
    successEmbed,
    errorEmbed,
    infoEmbed
}