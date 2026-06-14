const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType
} = require("discord.js")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setlogs")
        .setDescription("Définir le salon des logs du serveur")
        .addChannelOption(option =>
            option.setName("channel")
                .setDescription("Salon où envoyer les logs")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        const channel = interaction.options.getChannel("channel")

        await client.db.collection("guild_settings").updateOne(
            { guildId: interaction.guild.id },
            {
                $set: {
                    guildId: interaction.guild.id,
                    logsChannelId: channel.id,
                    updatedAt: new Date()
                },
                $setOnInsert: {
                    createdAt: new Date()
                }
            },
            { upsert: true }
        )

        return interaction.reply({
            content: `✅ Salon de logs défini sur ${channel}.`,
            ephemeral: true
        })
    }
}