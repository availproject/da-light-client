const { ApiPromise, WsProvider } = require('@polkadot/api')
const { BlockConfidence } = require('./state')
const { startServer } = require('./rpc')

const WSURI = process.env.WSURI || 'ws://localhost:9944'

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

    return [state, api]

}

module.exports = {
    getRandomInt, max, setUp
}
