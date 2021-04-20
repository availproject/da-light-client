const humanizeDuration = require('humanize-duration')
const { verifyProof } = require('./verifier')
const { setUp, generateRandomDataMatrixIndices, getRows, getColumns } = require('./utils')

class LightClient {

    constructor(api_, state_) {
        this.api = api_
        this.state = state_
    }

    // Asking for batch proof i.e. given block number & a set of
    // data matrix indices
    //
    // @note Length of response byte array will be : len(indices) * 80
    //
    // We asked for N-many cell's proof(s) in a batch
    askProof(blockNumber, indices) {
        return new Promise(async (res, rej) => {

            try {

                const proof = await this.api.rpc.kate.queryProof(blockNumber, indices)
                res([...proof])

            } catch (e) {
                rej(e)
            }

        })
    }

    // Given a block, which is already fetched, attempts to
    // verify block content by checking commitment & proof asked by
    // cell indices
    verifyBlock(blockNumber, indices, commitment, proof) {
        try {

            const ret = verifyProof(parseInt(blockNumber), getRows(indices), getColumns(indices), commitment, proof)
            this.state.setConfidence(BigInt(blockNumber).toString(), ret)

        } catch (e) {
            console.log(`❌ Verification attempt failed for block ${BigInt(blockNumber)} : ${e.toString()}`)
        }
    }

    // Given block number ( as string ), get block hash
    //
    // @note First need to parse block number as integer, otherwise
    // RPC call fails, cause it's given as BigInt
    async fetchBlockHashByNumber(num) {
        try {

            const blockHash = await this.api.rpc.chain.getBlockHash(parseInt(num))
            return blockHash.toHex()

        } catch (e) {

            console.error(e.toString())
            return null

        }
    }

    // Given block hash, attempts to fetch block
    async fetchBlockByHash(hash) {
        try {

            const block = await this.api.rpc.chain.getBlock(hash)
            return block

        } catch (e) {

            console.error(e.toString())
            return null

        }
    }

    // Given block number, first fetch hash of block, 
    // then fetch block using hash
    async fetchBlockByNumber(num) {
        const hash = await this.fetchBlockHashByNumber(num)
        if (!hash) {
            return null
        }

        return await this.fetchBlockByHash(hash)
    }

    // Function for fetching single block & attempting
    // to verify block by asking for `N` proof(s), in a batch call
    processBlockByNumber(num) {
        return new Promise(async (res, _) => {

            const start = new Date().getTime()

            console.log(`🛠   Verifying block : ${num}, on request`)

            const block = await this.fetchBlockByNumber(num.toString())
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
            const proof = await this.askProof(blockNumber, indices)

            await this.verifyBlock(blockNumber, indices, commitment, proof)

            console.log(`✅ Verified block : ${num} in ${humanizeDuration(new Date().getTime() - start)}, on request`)
            res({
                status: 1,
                block: num
            })

        })
    }

}

// Subscribing to chain tip & attempt to run
// block verification and confidence gaining life cycle
// for each block seen/ mined in chain, after light client
// has started
const startLightClient = async _ => {

    [state, api] = await setUp()

    api.rpc.chain.subscribeNewHeads(async header => {

        console.log(`🚀  Chain tip @ ${header.number}`)
        // keeping track of latest block of chain
        state.updateLatest(BigInt(header.number))

        // Because genesis block doesn't have any commitment in header
        if (BigInt(header.number) < 1n) {
            return
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

module.exports = { startLightClient, processBlockByNumber }
