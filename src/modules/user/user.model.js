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
    nomeEmpresa: { type: String, required: true },

    role: {
        type: String,
        enum: ['super_admin', 'admin', 'profissional', 'recepcao'],
        default: 'admin',
    },

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