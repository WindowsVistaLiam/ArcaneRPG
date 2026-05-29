const { EmbedBuilder } = require("discord.js")

async function getLogsChannel(client, guildId) {
    const settings = await client.db.collection("guild_settings").findOne({
        guildId
    })

    if (!settings || !settings.logsChannelId) return null

    const guild = client.guilds.cache.get(guildId)
    if (!guild) return null

    const channel = guild.channels.cache.get(settings.logsChannelId)
    if (!channel) return null

    return channel
}

async function sendLog(client, guildId, options) {
    try {
        const channel = await getLogsChannel(client, guildId)
        if (!channel) return

        const embed = new EmbedBuilder()
            .setTitle(options.title || "Log serveur")
            .setDescription(options.description || "Aucune description.")
            .setColor(options.color || 0x5865f2)
            .setTimestamp()

        if (options.fields) {
            embed.addFields(options.fields)
        }

        if (options.footer) {
            embed.setFooter({ text: options.footer })
        }

        await channel.send({ embeds: [embed] })
    } catch (error) {
        console.error("Erreur sendLog :", error)
    }
}

module.exports = {
    sendLog
}