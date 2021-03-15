const { ApiPromise, WsProvider } = require('@polkadot/api')
let api

const { default: axios } = require('axios')
const { verifyProof } = require('./verifier')
const { BlockConfidence } = require('./state')

const { JSONRPCServer } = require('json-rpc-2.0')
const express = require('express')
const cors = require('cors')

const humanizeDuration = require('humanize-duration')

// -- Reading config file in memory
const { join } = require('path')
require('dotenv').config({ path: join(__dirname, '.env') })

const HTTPURI = process.env.HTTPURI || 'http://localhost:9933'
const WSURI = process.env.WSURI || 'ws://localhost:9944'
const AskProofCount = process.env.AskProofCount || 10
const BatchSize = BigInt(process.env.BatchSize || 10)
const port = process.env.PORT || 7000

const MatrixDimX = 256
const MatrixDimY = 256

const state = new BlockConfidence()
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

// Starting JSON-RPC server
app.listen(port, _ => {

    console.log(`✅ Running JSON-RPC server @ http://localhost:${port}`)

})

// Return random integer in specified range
// where lower bound is inclusive, but other end is not
const getRandomInt = (low, high) => {

    return Math.floor(Math.random() * (high - low)) + low

}

// Given block number ( as string ), get block hash
//
// @note First need to parse block number as integer, otherwise
// RPC call fails, cause it's given as BigInt
const fetchBlockHashByNumber = async num => {

    try {

        const blockHash = await api.rpc.chain.getBlockHash(parseInt(num))
        return blockHash.toHex()

    } catch (e) {

        console.error(e.toString())
        return null

    }

}

// Given block hash, attempts to fetch block
const fetchBlockByHash = async hash => {

    try {

        const block = await api.rpc.chain.getBlock(hash)
        return block

    } catch (e) {

        console.error(e.toString())
        return null

    }

}

// Given block number, first fetch hash of block, then fetch block using hash
const fetchBlockByNumber = async num => {

    const hash = await fetchBlockHashByNumber(num)
    if (!hash) {
        return null
    }

    return await fetchBlockByHash(hash)

}

// Single cell verification job is submiited in a different thread of
// worker, using this function
const singleIterationOfVerification = (blockNumber, x, y, commitment) =>
    new Promise(async (res, rej) => {

        try {

            const proof = await axios.post(HTTPURI,
                {
                    "id": 1,
                    "jsonrpc": "2.0",
                    "method": "kate_queryProof",
                    "params": [blockNumber, [{ "row": x, "col": y }]]
                },
                {
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            )

            if (proof.status != 200) {

                rej(new Error('bad status code'))

            }

            res(verifyProof(x, y, [...commitment], proof.data.result))

        } catch (e) {
            rej(e)
        }

    })

// Given a block, which is already fetched, attempts to
// verify block content by checking commitment & proof asked by
// cell indices
const verifyBlock = async (blockNumber, commitment) => {

    for (let i = 0; i < AskProofCount; i++) {

        const [x, y] = [getRandomInt(0, MatrixDimX), getRandomInt(0, MatrixDimY)]

        try {

            const ret = await singleIterationOfVerification(blockNumber, x, y, commitment.slice(48 * x, x * 48 + 48))

            if (ret) {
                state.incrementConfidence(BigInt(blockNumber).toString())
            }

        } catch (e) {
            console.log(`❌ Verification attempt failed for block ${BigInt(blockNumber)} : ${e.toString()}`)
        }

    }

}

// Function for fetching single block & attempting
// to verify block by asking for proof `N` times
// where block number is given
const processBlockByNumber = num =>
    new Promise(async (res, _) => {

        const start = new Date().getTime()

        console.log(`🛠  Verifying block : ${num}`)

        const block = await fetchBlockByNumber(num.toString())
        if (!block) {

            res({
                status: 0,
                block: num
            })
            return

        }

        await verifyBlock(block.block.header.number, block.block.header.extrinsicsRoot.commitment)

        console.log(`✅ Verified block : ${num} in ${humanizeDuration(new Date().getTime() - start)}`)
        res({
            status: 1,
            block: num
        })

    })

// Given block number range, fetches all of them & attempts to
// verify each of them, where in each iteration it'll process `N`
// many block(s) & attempt to gain confiidence, by performing a set of
// proof query & verification rounds
const processBlocksInRange = async (x, y) => {

    const target = y - x + 1n
    let covered = 0n

    while (covered <= target) {

        const promises = []

        for (let i = x + covered; i <= min(x + covered + BatchSize - 1n, y); i += 1n) {
            promises.push(processBlockByNumber(i))
        }

        try {

            const start = new Date().getTime()

            const result = (await Promise.all(promises)).reduce((acc, cur) => {

                acc[cur.status].push(cur.block)
                return acc

            }, { 0: [], 1: [] })

            if (result[1].length != 0) {

                console.log(`✅ Batch verified ${result[1].length} block(s) in ${humanizeDuration(new Date().getTime() - start)}`)

            }

            if (result[0].length != 0) {

                console.log(`❌ Failed to batch verify ${result[0].length} block(s) 👇`)
                console.log(result[0])

            }

        } catch (e) {
            console.error(e.toString())
        } finally {
            covered += (BatchSize + 1n)
        }

    }


}

// Compare two big intergers & return minimum of them
const min = (a, b) => {
    return a < b ? a : b
}

// Initialised Polkadot API, which is to be used
// for interacting with node RPC API
const setUp = async _ => {

    const provider = new WsProvider(WSURI)

    api = await ApiPromise.create({
        provider, types: {
            ExtrinsicsRoot: {
                hash: 'Hash',
                commitment: 'Vec<u8>'
            },
            Header: {
                parentHash: 'Hash',
                number: 'Compact<BlockNumber>',
                stateRoot: 'Hash',
                extrinsicsRoot: 'ExtrinsicsRoot',
                digest: 'Digest'
            }
        }
    })

}

// Subscribing to chain tip & attempt to run
// block verification and confidence gaining life cycle
// for each block seen/ mined in chain
const subscribeToBlockHead = async _ => {

    let first = true

    api.rpc.chain.subscribeNewHeads(async header => {

        console.log(`🚀  Chain tip @ ${header.number}`)

        if (first) {

            first = !first
            if (header.number > 1) {
                processBlocksInRange(1n, BigInt(header.number))
                return
            }

        }

        const start = new Date().getTime()
        console.log(`🛠  Verifying block : ${header.number}`)

        await verifyBlock(header.number, header.extrinsicsRoot.commitment)

        console.log(`✅ Verified block : ${header.number} in ${humanizeDuration(new Date().getTime() - start)}`)

    })

}

// Main entry point, to be invoked for starting light client ops
const main = async _ => {
    await setUp()
    subscribeToBlockHead()
}

main().catch(e => {
    console.error(e)
    process.exit(1)
})
