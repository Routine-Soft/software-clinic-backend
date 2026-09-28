import "dotenv/config";
import mongoose from "mongoose";
import db from "../src/db/db.js";
import PlanoModel from "../src/modules/plano/plano.model.js";

async function seed() {
  await db();

  const planos = [
    { nome: "Gratuito", tipo: "gratis", preco: 0, duracaoDiasTrial: 3, ativo: true },
    { nome: "Pago", tipo: "pago", preco: 99.9, ativo: true },
  ];

  for (const plano of planos) {
    const existente = await PlanoModel.findOne({ tipo: plano.tipo });
    if (existente) {
      console.log(`Plano "${plano.tipo}" já existe (id ${existente._id}), pulando.`);
      continue;
    }
    const criado = await PlanoModel.create(plano);
    console.log(`Plano "${plano.tipo}" criado (id ${criado._id}).`);
  }

  await mongoose.disconnect();
}

seed();
