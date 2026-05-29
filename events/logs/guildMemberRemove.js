const { sendLog } = require("../../utils/sendLog")

module.exports = {
    name: "guildMemberRemove",

    async execute(member, client) {
        await sendLog(client, member.guild.id, {
            title: "Membre parti",
            color: 0xe67e22,
            description: `${member.user} a quitté le serveur.`,
            fields: [
                {
                    name: "Utilisateur",
                    value: `${member.user.tag} (${member.user.id})`
                }
            ]
        })
    }
}