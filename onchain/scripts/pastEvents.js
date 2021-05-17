const Provider = require('ethers').providers.JsonRpcProvider
const ContractInterface = require('ethers').utils.Interface

const provider = new Provider('https://matic-mumbai.chainstacklabs.com')
const DAOracle = '0x64b1893eC781545078AbeeDf219D7CbA7D30B225'
const interface = [
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "block_",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "confidence_",
                "type": "uint256"
            }
        ],
        "name": "BlockConfidence",
        "type": "event"
    }
]

const contractInterface = new ContractInterface(interface)
provider.getLogs({
    address: DAOracle,
    fromBlock: 13000000,
    topics: ['0xbf1ec74434af424546e6f30bd0744a156db3ff0670cd0a462a86999a29edab54']
}).then((result) => {
    console.table(result.map(event => {
        const parsed = contractInterface.parseLog(event)
        return {
            block: parsed.args.block_.toString(),
            confidence: `${parsed.args.confidence_ / 10 ** 7} %`,
            txHash: event.transactionHash
        }
    }))
}).catch((err) => {
    console.error(err)
    process.exit(1)
})
