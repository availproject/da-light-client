const { parentPort, workerData, isMainThread } = require('worker_threads')

const { verifyProof } = require('./verifier')

if (!isMainThread) {

    parentPort.postMessage(verifyProof(...workerData))

} else {

    console.log('[❌] Bad invocation')

}
