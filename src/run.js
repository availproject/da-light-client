const { setUp } = require('./setup')
const { generateRandomDataMatrixIndices } = require('./utils')
const humanizeDuration = require('humanize-duration')

// Subscribing to chain tip & attempt to run
// block verification and confidence gaining life cycle
// for each block seen/ mined in chain, after light client
// has started
const startLightClient = async _ => {

    const [lc, api] = await setUp()

    api.rpc.chain.subscribeNewHeads(async header => {

        console.log(`🚀  Chain tip @ ${header.number}`)
        // keeping track of latest block of chain
        lc.updateLatest(BigInt(header.number))

        // Because genesis block doesn't have any commitment in header
        if (BigInt(header.number) < 1n) {
            return
        }

        const start = new Date().getTime()
        console.log(`🛠   Verifying block : ${header.number}`)

        const blockNumber = header.number
        const indices = generateRandomDataMatrixIndices(
            parseInt(header.extrinsicsRoot.rows),
            parseInt(header.extrinsicsRoot.cols))
        const commitment = [...header.extrinsicsRoot.commitment]
        const proof = await lc.askProof(blockNumber, indices)

        if (await lc.verifyBlock(blockNumber, indices, commitment, proof)) {
            console.log(`✅ Verified block : ${header.number} in ${humanizeDuration(new Date().getTime() - start)}`)
        }

    })

}

module.exports = { startLightClient }
