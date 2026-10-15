import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
    nomeCompleto: { type: String, required: true },
    // Sempre sem espaços e em minúsculas, para o login não depender de como a pessoa digitou.
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        set: (valor) => (typeof valor === 'string' ? valor.replace(/\s+/g, '') : valor),
    },
    // Sem senha quando a conta foi criada pelo Google; a pessoa pode definir uma depois em "Minha conta".
    password: { type: String, default: null },
    googleId: { type: String, default: null },
    telefone: { type: String, required: true },
    cnpj: { type: String, default: null },
    // Afiliado não tem clínica.
    nomeEmpresa: { type: String, required: function () { return this.role !== 'afiliado' } },
    // Código do "Indique e ganhe" da clínica (desconto na mensalidade; só do dono); criado ao abrir a tela.
    codigoIndicacao: { type: String, unique: true, sparse: true },
    // Lembretes de consulta pelo WhatsApp ligados para a clínica (só vale no usuário dono da clínica).
    // Recurso pago: quem liga é o super_admin.
    lembretesWhatsapp: { type: Boolean, default: false },

    role: {
        type: String,
        enum: ['super_admin', 'admin', 'profissional', 'recepcao', 'afiliado'],
        default: 'admin',
    },

    // Afiliado: vende a Sonelia e ganha comissão por clínica que pagar. Pode ser uma conta só de afiliado
    // (role 'afiliado') ou qualquer usuário de clínica (recepção, profissional, dona) que ativou o programa.
    afiliadoDesde: { type: Date, default: undefined },
    codigoAfiliado: { type: String, unique: true, sparse: true },
    afiliadoAtivo: { type: Boolean, default: undefined },
    documento: { type: String, default: null },
    chavePix: { type: String, default: null },
    termosAfiliadoEm: { type: Date, default: undefined },
    termosAfiliadoVersao: { type: String, default: undefined },

    // Aceite dos Termos de uso no cadastro da clínica.
    termosAceitosEm: { type: Date, default: null },
    termosVersao: { type: String, default: null },

    // tenantId aponta pra si mesmo quando o usuário é o dono da clínica (admin).
    // Usuários criados depois dentro da mesma clínica herdam esse mesmo tenantId.
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },

    token: { type: String, required: false },
    tokenRefresh: { type: String, required: false },
    resetPasswordToken: { type: String, required: false },
    resetPasswordExpires: { type: Date, required: false },

}, { timestamps: true });

userSchema.methods.toJSON = function () {
  const obj = this.toObject()
  obj.temSenha = !!obj.password
  delete obj.password
  delete obj.googleId
  delete obj.token
  delete obj.tokenRefresh
  delete obj.resetPasswordToken
  delete obj.resetPasswordExpires
  return obj
}

const UserModel = mongoose.models.users || mongoose.model('users', userSchema);

export default UserModel;