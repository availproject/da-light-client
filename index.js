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
const fetchBlockHashByNumber = num => {

    try {

        const blockHeader = await axios.post(HTTPURI,
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

        return 'result' in blockHeader.data ? blockHeader.data.result : null

    } catch (e) {

        console.error(e.toString())
        return null

    }

}

// Given block hash, attempts to fetch block
const fetchBlockByHash = hash => {

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
const fetchBlockByNumber = num => {

    const hash = fetchBlockHashByNumber(num)
    if (!hash) {
        return null
    }

    const block = fetchBlockByHash(hash)
    if (!block) {
        return null
    }

}

const processBlocksInRange = (x, y) => {

    for (let i = x; i <= y; i++) {



    }

}

// Main entry point function, to be invoked for starting light client ops
const main = _ => {

    let lastSeenBlock = BigInt(0)

    while (1) {



    }

}
