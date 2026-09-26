import { PrintService } from './print.service.js'

export const PrintController = {
    async printTest(req, reply) {
        try {
            const result = await PrintService.testPrinter(req.body?.texto)
            return reply.send({ data: result, message: result.message })
        } catch (err) {
            return reply.code(err.statusCode ?? 500).send({
                message: err.message,
                logs: err.logs ?? [],
            })
        }
    },

    async printAgendamento(req, reply) {
        const { tenantId } = req.user
        try {
            const result = await PrintService.printAgendamento(req.params.agendaId, tenantId)
            return reply.send({ data: result, message: result.message })
        } catch (err) {
            return reply.code(err.statusCode ?? 500).send({
                message: err.message,
                logs: err.logs ?? [],
            })
        }
    },
}