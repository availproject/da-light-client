const humanizeDuration = require('humanize-duration')
const { default: axios } = require('axios')
const { verifyProof } = require('./verifier')
const { getRandomInt, max, setUp } = require('./utils')

const HTTPURI = process.env.HTTPURI || 'http://localhost:9933'
const AskProofCount = process.env.AskProofCount || 10
const BatchSize = BigInt(process.env.BatchSize || 10)

const MatrixDimX = 256
const MatrixDimY = 256

// To be initialised at some later point of time
//
// @note Kept in global scope intensionally, to avoid
// passing to all functions, who will potentially make use of it
let state, api

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

        const start = new Date().getTime()
        const [x, y] = [getRandomInt(0, MatrixDimX), getRandomInt(0, MatrixDimY)]

        try {

            const ret = await singleIterationOfVerification(blockNumber, x, y, commitment.slice(48 * x, x * 48 + 48))

            console.info(ret ? `➕  Verified proof for cell (${x}, ${y}) of block ${blockNumber} in ${humanizeDuration(new Date().getTime() - start)}` : `➖  Failed to verify proof for cell (${x}, ${y}) of block ${blockNumber} in ${humanizeDuration(new Date().getTime() - start)}`)

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

        console.log(`🛠   Verifying block : ${num}`)

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

        for (let i = y - covered; i >= max(y - covered - BatchSize + 1n, x); i -= 1n) {
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

// Subscribing to chain tip & attempt to run
// block verification and confidence gaining life cycle
// for each block seen/ mined in chain
const startLightClient = async _ => {

    [state, api] = await setUp()

    let first = true

    api.rpc.chain.subscribeNewHeads(async header => {

        console.log(`🚀  Chain tip @ ${header.number}`)

        if (first) {

            first = !first
            if (BigInt(header.number) > 1n) {
                processBlocksInRange(1n, BigInt(header.number))
                return
            }

        }

        const start = new Date().getTime()
        console.log(`🛠   Verifying block : ${header.number}`)

        await verifyBlock(header.number, header.extrinsicsRoot.commitment)

        console.log(`✅ Verified block : ${header.number} in ${humanizeDuration(new Date().getTime() - start)}`)

    })

}

module.exports = { startLightClient }
