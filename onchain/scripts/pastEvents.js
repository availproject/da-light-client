const Provider = require('ethers').providers.JsonRpcProvider
const ContractInterface = require('ethers').utils.Interface

const provider = new Provider('https://matic-mumbai.chainstacklabs.com')
const DAOracle = '0xD5fA61C334BdA418C7854d9128352FB325033760'
const FromBlock = 14_000_000
const BlockConfidenceSig = '0xbf1ec74434af424546e6f30bd0744a156db3ff0670cd0a462a86999a29edab54'
const BlockConfidenceRequestSig = '0x0f24941505adda13671d7eb1714f4259acd09589ac6152c1d5648e6ccd216578'
const interface = [{ "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "block_", "type": "uint256" }, { "indexed": false, "internalType": "bytes32", "name": "requestId_", "type": "bytes32" }], "name": "BlockConfidenceRequest", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "block_", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "confidence_", "type": "uint256" }], "name": "BlockConfidence", "type": "event" }]

const showConfidenceRequestLog = _ => new Promise((res, rej) => {
    provider.getLogs({
        address: DAOracle,
        fromBlock: FromBlock,
        topics: [BlockConfidenceRequestSig]
    }).then((result) => {
        res(result.map(event => {
            const parsed = contractInterface.parseLog(event)
            return {
                block: parsed.args.block_.toString(),
                requestId: parsed.args.requestId_,
                txHash: event.transactionHash
            }
        }))
    }).catch(rej)
})

const showConfidenceFulfilmentLog = _ => new Promise((res, rej) => {
    provider.getLogs({
        address: DAOracle,
        fromBlock: FromBlock,
        topics: [BlockConfidenceSig]
    }).then((result) => {
        res(result.map(event => {
            const parsed = contractInterface.parseLog(event)
            return {
                block: parsed.args.block_.toString(),
                confidence: `${parsed.args.confidence_ / 10 ** 7} %`,
                txHash: event.transactionHash
            }
        }))
    }).catch(rej)
})

const contractInterface = new ContractInterface(interface)
showConfidenceRequestLog().then(v => {
    console.table(v)
    showConfidenceFulfilmentLog().then(v => {
        console.table(v)
        process.exit(0)
    }).catch(e => {
        console.error(e)
        process.exit(1)
    })
}).catch(e => {
    console.error(e)
    process.exit(1)
})
