import { z } from "zod"
import { randomUUID } from "crypto"
import { prisma } from "../../lib/prisma"
import { FastifyInstance } from "fastify"


export async function voteOnPoll(app: FastifyInstance){
    app.post('/polls/:pollId/votes', async (request, reply) => {
        const voteOnPollBody = z.object({
            pollOptionId: z.string().uuid()
        })

        const voteOnPollParams = z.object({
            pollId: z.string().uuid(),
        })

        const { pollId } = voteOnPollParams.parse(request.params) 
        const { pollOptionId } = voteOnPollBody.parse(request.body)

        let { sessionId } = request.cookies

        if (sessionId) {
            const userPreviousVoteOnPoll = await prisma.vote.findUnique({
                where: {
                    sessionId_pollId: {
                        sessionId,
                        pollId
                    },
                }
            })

            if (userPreviousVoteOnPoll && userPreviousVoteOnPoll?.pollOptionId != pollOptionId){
                await prisma.vote.delete({
                    where: {
                        id: userPreviousVoteOnPoll.id,
                    }
                })
            } else if (userPreviousVoteOnPoll) {
                return reply.status(400).send({ message: 'Você já votou nesta enquete!' })
            }
        }

        if (!sessionId) {
            sessionId = randomUUID()

            reply.setCookie("session", sessionId, { 
                path: '/',
                maxAge: 60*60*24*38, /* one moth */
                signed: true, // secure cookie
                httpOnly: true, // prevent client access to the cookie via JavaScript
            })
        }

        await prisma.vote.create({
            data:{
                sessionId,
                pollId,
                pollOptionId
            }
            
        })

        return 
    })
}