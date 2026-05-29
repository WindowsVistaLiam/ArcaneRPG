const { sendLog } = require("../../utils/sendLog")

module.exports = {
    name: "messageUpdate",

    async execute(oldMessage, newMessage, client) {
        if (!newMessage.guild) return
        if (newMessage.author?.bot) return

        const oldContent = oldMessage.content || "*Ancien contenu indisponible*"
        const newContent = newMessage.content || "*Nouveau contenu indisponible*"

        if (oldContent === newContent) return

        await sendLog(client, newMessage.guild.id, {
            title: "Message modifié",
            color: 0xf1c40f,
            fields: [
                {
                    name: "Auteur",
                    value: `${newMessage.author} (${newMessage.author.id})`,
                    inline: false
                },
                {
                    name: "Salon",
                    value: `${newMessage.channel}`,
                    inline: true
                },
                {
                    name: "Avant",
                    value: oldContent.slice(0, 1000),
                    inline: false
                },
                {
                    name: "Après",
                    value: newContent.slice(0, 1000),
                    inline: false
                }
            ]
        })
    }
}