const { JSONRPCServer } = require('json-rpc-2.0')
const express = require('express')
const cors = require('cors')

const port = process.env.PORT || 7000

let state
const server = new JSONRPCServer()

// Supported JSON-RPC method, where given decimal block number ( as utf-8 string )
// returns confidence associated with it
server.addMethod('get_blockConfidence', ({ number }) => {
    return typeof number === 'string' ?
        {
            number,
            confidence: state.getConfidence(number)
        } :
        typeof number === 'number' ?
            {
                number,
                confidence: state.getConfidence(number.toString())
            } :
            {
                number,
                confidence: '0 %',
                error: 'Block number must be number/ string'
            }
})

server.addMethod('get_progress', _ => {

    return {
        done: state.done().toString(),
        latest: state.latest.toString(),
        uptime: state.uptime()
    }

})

const app = express()
app.use(express.json())
app.use(cors())

app.post('/v1/json-rpc', (req, res) => {

    console.log(`⚡️ Received JSON-RPC request from ${req.ip} at ${new Date().toISOString()}`)

    server.receive(req.body).then((jsonRPCResp) => {
        if (jsonRPCResp) {
            res.json(jsonRPCResp)
        } else {
            res.sendStatus(204)
        }
    })

})

const startServer = _state => {

    // Initialising state holder, so that JSON-RPC queries can be
    // answered
    state = _state
    // Starting JSON-RPC server
    app.listen(port, _ => {

        console.log(`✅ Running JSON-RPC server @ http://localhost:${port}`)

    })


}

module.exports = { startServer }
