const humanizeDuration = require('humanize-duration')
const { verifyProof } = require('./verifier')
const { max, setUp, generateRandomDataMatrixIndices } = require('./utils')

const BatchSize = BigInt(process.env.BatchSize || 10)

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

// Asking for batch proof i.e. given block number & a set of
// data matrix indices
//
// @note Length of response byte array will be : len(indices) * 80
//
// We asked for N-many cell's proof(s) in a batch
const askProof = (blockNumber, indices) =>
    new Promise(async (res, rej) => {

        try {

            const proof = await api.rpc.kate.queryProof(blockNumber, indices)

            res([...proof])

        } catch (e) {
            rej(e)
        }

    })

// Given a block, which is already fetched, attempts to
// verify block content by checking commitment & proof asked by
// cell indices
const verifyBlock = async (blockNumber, indices, commitment, proof) => {


    try {

        (await Promise.all(indices.map(({ row, col }, index) => {

            return verifyProof(row, col, commitment.slice(48 * row, row * 48 + 48), proof.slice(80 * index, index * 80 + 80))

        }))).map((v, i) => {

            console.info(v ? `➕  Verified proof : cell (${indices[i].row}, ${indices[i].col}) of #${blockNumber}` : `➖  Failed to verify proof : cell (${indices[i].row}, ${indices[i].col}) of #${blockNumber}`)

            if (v) {
                state.incrementConfidence(BigInt(blockNumber).toString())
            }

        })

    } catch (e) {
        console.log(`❌ Verification attempt failed for block ${BigInt(blockNumber)} : ${e.toString()}`)
    }

}

// Function for fetching single block & attempting
// to verify block by asking for `N` proof(s), in a batch call
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

        const blockNumber = block.block.header.number
        const indices = generateRandomDataMatrixIndices()
        const commitment = [...block.block.header.extrinsicsRoot.commitment]
        const proof = await askProof(blockNumber, indices)

        await verifyBlock(blockNumber, indices, commitment, proof)

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
//
// @note Proof asking rounds are now batched into a single RPC call
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

        const blockNumber = header.number
        const indices = generateRandomDataMatrixIndices()
        const commitment = [...header.extrinsicsRoot.commitment]
        const proof = await askProof(blockNumber, indices)

        await verifyBlock(blockNumber, indices, commitment, proof)

        console.log(`✅ Verified block : ${header.number} in ${humanizeDuration(new Date().getTime() - start)}`)

    })

}

module.exports = { startLightClient }
