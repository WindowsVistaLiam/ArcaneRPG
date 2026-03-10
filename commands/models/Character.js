const mongoose = require("mongoose")

const characterSchema = new mongoose.Schema({

userId: String,

nom: String,
prenom: String,
age: String,
sexe: String,
orientation: String,
description: String,
image: String

})

module.exports = mongoose.model("Character", characterSchema)