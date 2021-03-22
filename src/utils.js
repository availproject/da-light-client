const { ApiPromise, WsProvider } = require('@polkadot/api')
const { BlockConfidence } = require('./state')
const { startServer } = require('./rpc')

const WSURI = process.env.WSURI || 'ws://localhost:9944'
const AskProofCount = parseInt(process.env.AskProofCount) || 10

const MatrixDimX = 256
const MatrixDimY = 256

// Generates random data matrix indices, to be used when querying
// full node for proofs, for a certain block number
const generateRandomDataMatrixIndices = _ => [...Array(AskProofCount).keys()].map(_ => {
    return {
        row: getRandomInt(0, MatrixDimX),
        col: getRandomInt(0, MatrixDimY)
    }
})

// Return random integer in specified range
// where lower bound is inclusive, but other end is not
const getRandomInt = (low, high) => {

    return Math.floor(Math.random() * (high - low)) + low

}

// Compare two big intergers & return maximum of them
const max = (a, b) => {
    return a > b ? a : b
}

// Initialised Polkadot API, which is to be used
// for interacting with node RPC API
const setUp = async _ => {

    const state = new BlockConfidence()
    startServer(state)

    const provider = new WsProvider(WSURI)

    let api = await ApiPromise.create({
        provider,
        types: {
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
            },
            Cell: {
                row: 'u32',
                col: 'u32'
            }
        },
        rpc: {
            kate: {
                queryProof: {
                    description: 'Ask for Kate Proof, given block number & data matrix indices',
                    params: [
                        {
                            name: 'blockNumber',
                            type: 'u64'
                        },
                        {
                            name: 'cells',
                            type: 'Vec<Cell>'
                        }
                    ],
                    type: 'Vec<u8>'
                }
            }
        }
    })

    return [state, api]

}

module.exports = {
    max, setUp, generateRandomDataMatrixIndices
}
