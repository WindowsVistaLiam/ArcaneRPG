const { sendLog } = require("../../utils/sendLog")

module.exports = {
    name: "messageCreate",

    async execute(message, client) {
        if (!message.guild) return
        if (message.author.bot) return

        await sendLog(client, message.guild.id, {
            title: "Message envoyé",
            color: 0x2ecc71,
            fields: [
                {
                    name: "Auteur",
                    value: `${message.author} (${message.author.id})`,
                    inline: false
                },
                {
                    name: "Salon",
                    value: `${message.channel}`,
                    inline: true
                },
                {
                    name: "Message",
                    value: message.content?.slice(0, 1000) || "*Contenu indisponible*",
                    inline: false
                }
            ]
        })
    }
}