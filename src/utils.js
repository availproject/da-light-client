const { ApiPromise, WsProvider } = require('@polkadot/api')

const WSURI = process.env.WSURI || 'ws://localhost:9944'

// Compare two big intergers & return maximum of them
const max = (a, b) => {
    return a > b ? a : b
}

// Initialised Polkadot API, which is to be used
// for interacting with node RPC API
const setUp = async _ => {

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

    return api

}

module.exports = {
    max, setUp
}
