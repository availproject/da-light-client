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
            confidence: state.getConfidence(number) || '0 %'
        } :
        typeof number === 'number' ?
            {
                number,
                confidence: state.getConfidence(number.toString()) || '0 %'
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

    console.log(`[⚡️] Received JSON-RPC request from ${req.ip} at ${new Date().toISOString()}`)

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

    console.log(`[✅] Running JSON-RPC server @ http://localhost:${port}`)

})

// Return random integer in specified range
// where lower bound is inclusive, but other end is not
const getRandomInt = (low, high) => {

    return Math.floor(Math.random() * (high - low)) + low

}

// Query for latest block header, in case of failure returns `null`
const getLatestBlockHeader = async _ => {

    try {

        const blockHeader = await axios.post(HTTPURI,
            {
                "id": 1,
                "jsonrpc": "2.0",
                "method": "chain_getHeader"
            },
            {
                headers: {
                    "Content-Type": "application/json"
                }
            }
        )

        return 'result' in blockHeader.data ? blockHeader.data.result : null

    } catch (e) {

        console.error(e.toString())
        return null

    }

}

// Given block number ( as string ), get block hash
//
// @note First need to parse block number as integer, otherwise
// RPC call fails
const fetchBlockHashByNumber = async num => {

    try {

        const blockHash = await axios.post(HTTPURI,
            {
                "id": 1,
                "jsonrpc": "2.0",
                "method": "chain_getBlockHash",
                "params": [parseInt(num)]
            },
            {
                headers: {
                    "Content-Type": "application/json"
                }
            }
        )

        return 'result' in blockHash.data ? blockHash.data.result : null

    } catch (e) {

        console.error(e.toString())
        return null

    }

}

// Given block hash, attempts to fetch block
const fetchBlockByHash = async hash => {

    try {

        const blockHeader = await axios.post(HTTPURI,
            {
                "id": 1,
                "jsonrpc": "2.0",
                "method": "chain_getBlock",
                "params": [hash]
            },
            {
                headers: {
                    "Content-Type": "application/json"
                }
            }
        )

        return 'result' in blockHeader.data ? blockHeader.data.result : null

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

                rej(new Error('Bad status code'))

            }

            res(verifyProof(x, y, commitment, proof.data.result))

        } catch (e) {
            rej(e)
        }

    })

// Given a block, which is already fetched, attempts to
// verify block content by checking commitment & proof asked by
// cell indices
const verifyBlock = async block => {

    const blockNumber = block.block.header.number
    const commitment = block.block.header.extrinsicsRoot.commitment

    const _promises = []

    for (let i = 0; i < AskProofCount; i++) {

        const [x, y] = [getRandomInt(0, MatrixDimX), getRandomInt(0, MatrixDimY)]

        _promises.push(singleIterationOfVerification(blockNumber, x, y, commitment.slice(48 * x, x * 48 + 48)))

    }

    try {

        // Waiting for all verifications to finish
        const status = (await Promise.all(_promises))
            .reduce((acc, cur) => { acc[cur]++; return acc; }, { true: 0, false: 0 })

        return status

    } catch (e) {

        console.error(e.toString())
        return null

    }

}

// Given block number range, fetches all of them & attempts to
// verify each of them
const processBlocksInRange = async (x, y) => {

    // -- Starts here
    //
    // Closure for fetching single block & attempting
    // to verify block by asking for proof `N` times
    // where block number is given
    const processBlockByNumber = num =>
        new Promise(async (res, rej) => {

            const start = new Date().getTime()

            console.log(`[🛠] Verifying block : ${num}`)

            const block = await fetchBlockByNumber(num.toString())
            if (!block) {

                res({
                    status: 0,
                    block: num
                })
                return

            }

            const result = await verifyBlock(block)
            if (result) {

                // Storing confidence gained for block `num`
                state.setConfidence(num.toString(), result)

                console.log(`[✅] Verified block : ${num} with ${JSON.stringify(result)} in ${humanizeDuration(new Date().getTime() - start)}`)

                res({
                    status: 1,
                    block: num
                })
                return

            }

            console.log(`[❌] Failed to verify block : ${num} in ${humanizeDuration(new Date().getTime() - start)}`)
            res({
                status: 0,
                block: num
            })

        })
    // -- Closure ends here

    const promises = []

    for (let i = x; i <= y; i += 1n) {
        promises.push(processBlockByNumber(i))
    }

    try {

        const start = new Date().getTime()

        const result = (await Promise.all(promises)).reduce((acc, cur) => {

            acc[cur.status].push(cur.block)
            return acc

        }, { 0: [], 1: [] })

        if (result[1].length != 0) {

            console.log(`[✅] Verified ${result[1].length} block(s) in ${humanizeDuration(new Date().getTime() - start)}`)

        }

        if (result[0].length != 0) {

            console.log(`[❌] Failed to verify ${result[0].length} block(s) 👇`)
            console.log(result[0])

        }

    } catch (e) {

        console.error(e.toString())

    }

}

// Sleep for `t` millisecond
const sleep = t => {
    setTimeout(_ => { }, t)
}

// Compare two big intergers & return minimum of them
const min = (a, b) => {
    return a < b ? a : b
}

// Main entry point, to be invoked for starting light client ops
const main = async _ => {

    let lastSeenBlock = BigInt(0)

    while (1) {

        const block = await getLatestBlockHeader()
        if (!block) {
            throw Error('Failed to get latest block number')
        }

        // Parse block number in hex string format
        const blockNumber = BigInt(block.number)

        if (!(lastSeenBlock < blockNumber)) {
            sleep(6000)
            continue
        }

        // -- Start block verification
        const start = lastSeenBlock + 1n
        const stop = min(blockNumber, lastSeenBlock + BatchSize)
        // -- End block verification, where both ends are inclusive

        await processBlocksInRange(start, stop)
        lastSeenBlock = stop

    }

}

main().catch(e => {
    console.error(e)
    process.exit(1)
})
