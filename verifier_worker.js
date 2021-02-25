const { parentPort, workerData, isMainThread } = require('worker_threads')

const { default: axios } = require('axios')
const { verifyProof } = require('./verifier')

const HTTPURI = 'http://localhost:9933'

const verifyProofWorker = (blockNumber, x, y, commitment) => {

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

        return verifyProof(x, y, commitment, proof.data.result)

    } catch (e) {

        console.error(e.toString())
        return false

    }

}

if (!isMainThread) {

    parentPort.postMessage(verifyProofWorker(...workerData))

} else {

    console.log('[❌] Bad invocation')

}
