import { z } from "zod"
import { prisma } from "../../lib/prisma"
import { FastifyInstance } from "fastify"
import { redis } from "../../lib/redis"


export async function getPoll(app: FastifyInstance){
    app.get('/polls/:pollid', async (request, reply) => {
        const getPollParams = z.object({
            pollid: z.string().uuid(),
        })
    
        const { pollid } = getPollParams.parse(request.params)
    
        const poll = await prisma.poll.findUnique({ 
            where: {
                id: pollid,
            },
            include: {
                options: {
                    select: {
                        id: true,
                        title: true,

                    }
                }
            }
        })

        if (!poll){
            return  reply.status(400).send({ error: 'Poll not Found!'})
        }

        const result = await redis.zrange(pollid, 0, -1, 'WITHSCORES')

        const votes = result.reduce((obj, line, index) => {
            if (index  % 2 === 0) {
                const score = result[index + 1]

                Object.assign(obj, { [line]:Number(score)})
            }
            return obj
        },{} as Record<string, number>)

        console.log(votes)

        return reply.send({ 
            poll:{
                id: poll.id,
                title: poll.title,
                options: poll.options.map(option => {
                    return{
                        id:option.id,
                        title: option.title,
                        score: (option.id in votes) ? votes[option.id] : 0 ,
                    }
                })
            }
         })
    })
}