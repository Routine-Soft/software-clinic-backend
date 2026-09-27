class AppError extends Error {

    constructor(message, statusCode, codigo) {

        super(message)

        this.statusCode = statusCode
        this.codigo = codigo

    }

}

export default AppError