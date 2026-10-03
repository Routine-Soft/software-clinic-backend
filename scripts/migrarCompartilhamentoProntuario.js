import "dotenv/config";
import mongoose from "mongoose";
import db from "../src/db/db.js";
import ProntuarioModel from "../src/modules/prontuario/prontuario.model.js";
import ProfissionalModel from "../src/modules/profissional/profissional.model.js";

// Atendimentos criados antes da opção "quem pode ler" ficam liberados para a(s) especialidade(s) do autor.
// Só mexe em quem ainda não tem o campo, então pode rodar mais de uma vez.
// Rode DEPOIS de subir o código novo. Use --aplicar para gravar; sem ele, só mostra o que faria.
// --tenant=<id> limita a uma clínica (útil para testar).
const aplicar = process.argv.includes("--aplicar");
const tenant = process.argv.find((arg) => arg.startsWith("--tenant="))?.split("=")[1];

async function migrar() {
  await db();

  const filtro = { compartilhadoCom: { $exists: false }, ...(tenant ? { tenantId: new mongoose.Types.ObjectId(tenant) } : {}) };
  const pendentes = await ProntuarioModel.find(filtro)
    .select("profissionalId")
    .lean();
  const profissionais = await ProfissionalModel.find({ _id: { $in: pendentes.map((p) => p.profissionalId) } })
    .select("especialidadeIds")
    .lean();
  const especialidadesDe = new Map(profissionais.map((p) => [String(p._id), p.especialidadeIds ?? []]));

  const operacoes = pendentes.map((p) => ({
    updateOne: {
      filter: { _id: p._id, compartilhadoCom: { $exists: false } },
      update: { $set: { compartilhadoCom: especialidadesDe.get(String(p.profissionalId)) ?? [] } },
    },
  }));

  const semEspecialidade = operacoes.filter((o) => o.updateOne.update.$set.compartilhadoCom.length === 0).length;
  console.log(`Atendimentos sem o campo: ${pendentes.length} (${semEspecialidade} ficam só com o autor: profissional sem especialidade ou removido).`);

  if (!aplicar) {
    console.log("Simulação: nada foi gravado. Rode com --aplicar para gravar.");
  } else if (operacoes.length > 0) {
    const resultado = await ProntuarioModel.bulkWrite(operacoes);
    console.log(`Atualizados: ${resultado.modifiedCount}.`);
  }

  await mongoose.disconnect();
}

migrar().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
