import { number, z } from "zod"
import { randomUUID } from "crypto"
import { prisma } from "../../lib/prisma"
import { FastifyInstance } from "fastify"
import { redis } from "../../lib/redis"
import { voting } from "../../utils/voting-pub-sub"

// Define the schema for this type of request. This will be used to validate incoming requests.
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
            // If the user has already voted on this poll before, update their existing vote instead of creating a new one
            if (userPreviousVoteOnPoll && userPreviousVoteOnPoll.pollOptionId !== pollOptionId){
                await prisma.vote.delete({
                    where: {
                        id: userPreviousVoteOnPoll.id,
                    }
                })

                const votes = await redis.zincrby(pollId, -1, userPreviousVoteOnPoll.pollOptionId)

                voting.publish(pollId, {
                    pollOptionId: userPreviousVoteOnPoll.pollOptionId,
                    votes: Number(votes),
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

        const votes = await redis.zincrby(pollId, 1, pollOptionId)

        voting.publish(pollId, {
            pollOptionId,
            votes: Number(votes),
        })

        return reply.status(201).send()
    })
}