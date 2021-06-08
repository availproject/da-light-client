const humanizeDuration = require('humanize-duration')
const { verifyProof } = require('./verifier')
const { generateRandomDataMatrixIndices, getRows, getColumns } = require('./utils')

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
    verifyBlock(blockNumber, totalRows, totalCols, indices, commitment, proof) {
        try {
            
            const ret = verifyProof(parseInt(blockNumber), parseInt(totalRows), parseInt(totalCols), getRows(indices), getColumns(indices), commitment, proof)
            if (ret > 0) {
                this.state.setConfidence(BigInt(blockNumber).toString(), ret)
                return true
            }

            throw Error('zero rounds passed')
        } catch (e) {
            console.log(`❌ Verification attempt failed for block ${BigInt(blockNumber)} : ${e.toString()}`)
            return false
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
            const totalRows = block.block.header.extrinsicsRoot.rows
            const totalCols = block.block.header.extrinsicsRoot.cols
            const indices = generateRandomDataMatrixIndices(
                parseInt(totalRows),
                parseInt(totalCols))
            const commitment = [...block.block.header.extrinsicsRoot.commitment]
            const proof = await this.askProof(blockNumber, indices)

            const status = await this.verifyBlock(blockNumber, totalRows, totalCols, indices, commitment, proof)
            if (status) {
                console.log(`✅ Verified block : ${num} in ${humanizeDuration(new Date().getTime() - start)}, on request`)
            }

            res({
                status: status ? 1 : 0,
                block: num
            })
        })
    }

    updateLatest(number) {
        this.state.updateLatest(number)
    }

}

module.exports = {
    LightClient
}
