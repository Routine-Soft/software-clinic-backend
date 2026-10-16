const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '')

export function modeloDTO(body = {}) {
    return {
        titulo: texto(body.titulo),
        // O texto do termo mantém as quebras de linha e espaços como a clínica escreveu.
        texto: typeof body.texto === 'string' ? body.texto.replace(/\r\n/g, '\n').trim() : '',
    }
}

export function envioDTO(body = {}) {
    return {
        pacienteId: body.pacienteId,
        modeloId: body.modeloId,
        profissionalId: body.profissionalId || null,
    }
}

export function assinaturaDTO(body = {}) {
    return {
        nome: texto(body.nome).replace(/\s+/g, ' '),
        documento: texto(body.documento),
        relacao: body.relacao === 'responsavel' ? 'responsavel' : 'paciente',
        imagem: typeof body.imagem === 'string' ? body.imagem : '',
        aceite: body.aceite === true,
    }
}
