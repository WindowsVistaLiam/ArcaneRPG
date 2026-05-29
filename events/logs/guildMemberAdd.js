const { sendLog } = require("../../utils/sendLog")

module.exports = {
    name: "guildMemberAdd",

    async execute(member, client) {
        await sendLog(client, member.guild.id, {
            title: "Membre arrivé",
            color: 0x2ecc71,
            description: `${member.user} a rejoint le serveur.`,
            fields: [
                {
                    name: "Utilisateur",
                    value: `${member.user.tag} (${member.user.id})`
                }
            ]
        })
    }
}