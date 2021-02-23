const { default: axios } = require('axios')
const { verifyProof } = require('./verifier')

const HTTPURI = 'http://localhost:9933'

const AskProofCount = 30
const MatrixDimX = 256
const MatrixDimY = 256

// Return random integer in specified range
// where lower bound is inclusive, but other end is not
const getRandomInt = (low, high) => {

    return Math.floor(Math.random() * (high - low + 1)) + low

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

// Given a block, which is already fetched, attempts to
// verify block content by checking commitment & proof asked by
// cell indices
const verifyBlock = async block => {

    const commitment = block.block.header.extrinsicsRoot.commitment
    const status = { success: 0, failure: 0 }

    for (let i = 0; i <= AskProofCount; i++) {

        let [x, y] = [getRandomInt(0, MatrixDimX), getRandomInt(0, MatrixDimY)]

        try {

            const proof = await axios.post(HTTPURI,
                {
                    "id": 1,
                    "jsonrpc": "2.0",
                    "method": "kate_queryProof",
                    "params": [block.number, [{ "row": x, "col": y }]]
                },
                {
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            )

            if (verifyProof(x, y, commitment, proof.data.result)) {
                status.success++
            } else {
                status.failure++
            }

        } catch (e) {

            console.error(e.toString())
            status.failure++

        }

    }

    console.log(`[+] Verified block with ${status}}`)

}

// Given block number range, fetches all of them & attempts to
// verify each of them
const processBlocksInRange = async (x, y) => {

    for (let i = x; i <= y; i++) {

        console.log(`[*] Processing block : ${i}`)

        const block = await fetchBlockByNumber(i)
        if (!block) {
            continue
        }

        await verifyBlock(block)
        console.log(`[+] Processed block : ${i}`)

    }

}

// Sleep for `t` millisecond
const sleep = t => {
    setTimeout(_ => { }, t)
}

// Main entry point, to be invoked for starting light client ops
const main = async _ => {

    let lastSeenBlock = -1

    while (1) {

        const block = await getLatestBlockHeader()
        if (!block) {
            sleep(3000)
            continue
        }

        if (!(lastSeenBlock < block.number)) {
            sleep(6000)
            continue
        }

        await processBlocksInRange(lastSeenBlock + 1, block.number)
        lastSeenBlock = block.number

    }

}

main().catch(e => {
    console.error(e)
    process.exit(1)
})
