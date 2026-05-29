const { sendLog } = require("../../utils/sendLog")

module.exports = {
    name: "messageDelete",

    async execute(message, client) {
        if (!message.guild) return
        if (message.author?.bot) return

        await sendLog(client, message.guild.id, {
            title: "Message supprimé",
            color: 0xe74c3c,
            fields: [
                {
                    name: "Auteur",
                    value: message.author
                        ? `${message.author} (${message.author.id})`
                        : "Auteur inconnu",
                    inline: false
                },
                {
                    name: "Salon",
                    value: `${message.channel}`,
                    inline: true
                },
                {
                    name: "Message supprimé",
                    value: message.content?.slice(0, 1000) || "*Contenu indisponible*",
                    inline: false
                }
            ]
        })
    }
}