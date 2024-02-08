import fastify from  'fastify'
import cookie from '@fastify/cookie'
import { createPoll } from './routes/create-poll'
import { getPoll } from './routes/get-poll'
import { voteOnPoll } from './routes/vote-on-poll'

const app = fastify()

app.register(cookie, {
    secret: "pollsupersecret",
    hook: 'onRequest', // default value of the hook option is onRequest
})

app.register(createPoll)
app.register(getPoll)
app.register(voteOnPoll)

app.listen({port: 3333 }).then(() => {
    console.log( 'Server is running!' )
})
