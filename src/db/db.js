import mongoose from 'mongoose'

const db = async () => {
    await mongoose.connect(`mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@clustersoftwareclinic.aavqt49.mongodb.net/softwareclinic?retryWrites=true&w=majority`, {
    }).then(() => {
        console.log('Conectado ao MongoDB')
    }).catch((error) => {
        console.log('Erro ao conectar ao MongoDB ' + error)
    })
}

export default db