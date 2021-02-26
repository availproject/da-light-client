const { default: axios } = require('axios')
const { verifyProof } = require('./verifier')
const humanizeDuration = require('humanize-duration')

const HTTPURI = 'http://localhost:9933'

const AskProofCount = 10
const MatrixDimX = 256
const MatrixDimY = 256

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

// Given block number, get block hash
const fetchBlockHashByNumber = async num => {

    try {

        const blockHash = await axios.post(HTTPURI,
            {
                "id": 1,
                "jsonrpc": "2.0",
                "method": "chain_getBlockHash",
                "params": [num]
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

            console.log(`[🛠] Processing block : ${num}`)

            const block = await fetchBlockByNumber(num)
            if (!block) {

                console.log()

                res({
                    status: 0,
                    block: num
                })
                return

            }

            const result = await verifyBlock(block)
            if (result) {

                console.log(`[✅] Processed block : ${num} with ${JSON.stringify(result)} in ${humanizeDuration(new Date().getTime() - start)}`)

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

    for (let i = x; i <= y; i++) {
        promises.push(processBlockByNumber(i))
    }

    try {

        const result = (await Promise.all(promises)).reduce((acc, cur) => {

            acc[cur.status].push(cur.block)
            return acc

        }, { 0: [], 1: [] })

        if (result[1].length != 0) {

            console.log(`[✅] Processed + Verified ${result[1].length} blocks`)

        }

        if (result[0].length != 0) {

            console.log(`[❌] Failed to Process + Verify ${result[0].length} blocks 👇`)
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

// Main entry point, to be invoked for starting light client ops
const main = async _ => {

    let lastSeenBlock = 0

    while (1) {

        const block = await getLatestBlockHeader()
        if (!block) {
            sleep(3000)
            continue
        }

        // Parse block number in hex string format
        const blockNumber = parseInt(block.number)

        if (!(lastSeenBlock < blockNumber)) {
            sleep(6000)
            continue
        }

        await processBlocksInRange(lastSeenBlock + 1, blockNumber)
        lastSeenBlock = blockNumber

    }

}

main().catch(e => {
    console.error(e)
    process.exit(1)
})
