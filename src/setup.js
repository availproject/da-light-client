const { ApiPromise, WsProvider } = require('@polkadot/api')
const { BlockConfidence } = require('./state')
const { startServer } = require('./rpc')
const { LightClient } = require('./light')

const WSURI = process.env.WSURI || 'ws://localhost:9944'

// Initialised Polkadot API, which is to be used
// for interacting with node RPC API
const setUp = async _ => {

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

    const state = new BlockConfidence()
    const lc = new LightClient(api, state)
    startServer(state, lc)

    return [state, api]

}

module.exports = { setUp }
