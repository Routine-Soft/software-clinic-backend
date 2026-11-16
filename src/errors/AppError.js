class AppError extends Error {

    // `dados`: campos extras que vão junto na resposta de erro (ex.: o recurso do plano que faltou).
    constructor(message, statusCode, codigo, dados) {

        super(message)

        this.statusCode = statusCode
        this.codigo = codigo
        this.dados = dados

    }

}

export default AppError