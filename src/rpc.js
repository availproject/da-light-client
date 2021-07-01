const express = require('express')
const cors = require('cors')
const { serialiseConfidence } = require('./utils')
const morgan = require('morgan')

const port = process.env.PORT || 7000
let state, lc

const lookupConfidence = async number => {

    // This is a closure hook, which will be invoked before
    // responding to obtained confidence RPC query
    //
    // If we've already seen request for this block before
    // ( or processed it, because we caught this block
    // while listening to it ), it'll be responded back immediately
    // with stored confidence. But for this time seen blocks, it'll
    // attempt to gain confidence & then respond back to client
    //
    // @note It can be time consuming for second case
    async function wrapperOnConfidenceFetcher(number) {
        if (number < 1n) {
            return 0
        }

        if (state.alreadyVerified(number.toString(10))) {
            return state.getConfidence(number.toString(10))
        }

        if (state.latestBlock < number) {
            return 0
        }

        const resp = await lc.processBlockByNumber(number)
        if (resp.status != 1) {
            return 0
        }

        return state.getConfidence(number.toString(10))
    }

    async function getConfidence(number) {
        const confidence = await wrapperOnConfidenceFetcher(BigInt(number))
        return {
            number: parseInt(number),
            confidence,
            serialisedConfidence: serialiseConfidence(number, Math.round(confidence * 10 ** 7))
        }
    }

    return typeof number === 'string' && /^((0[xX][0-9a-fA-F]+)|(\d+))$/.test(number)
        ? getConfidence(number)
        : typeof number === 'number'
            ? getConfidence(number.toString())
            :
            {
                number,
                confidence: 0,
                error: 'Block number must be number/ string'
            }
}

const startServer = (_state, _lc) => {
    // Initialising state holder, so that queries can be answered
    state = _state
    lc = _lc

    const app = express()
    app.use(cors())
    app.use(morgan('short'))

    app.get('/v1/confidence/:block', async (req, res) => {
        res.status(200).json(await lookupConfidence(req.params.block))
    })

    app.listen(port, _ => {
        console.log(`✅ Running server @ http://localhost:${port}`)
    })
}

module.exports = { startServer }
