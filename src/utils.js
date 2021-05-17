const AskProofCount = parseInt(process.env.AskProofCount) || 10
const MatrixDimX = 256
const MatrixDimY = 256

const getRows = indices => indices.map(({ row, _ }) => row)

const getColumns = indices => indices.map(({ _, col }) => col)

// Generates random data matrix indices, to be used when querying
// full node for proofs, for a certain block number
const generateRandomDataMatrixIndices = _ => [...Array(AskProofCount).keys()].map(_ => {
    return {
        row: getRandomInt(0, MatrixDimX),
        col: getRandomInt(0, MatrixDimY)
    }
})

// Return random integer in specified range
// where lower bound is inclusive, but other end is not
const getRandomInt = (low, high) => {
    return Math.floor(Math.random() * (high - low)) + low
}

// Given block number & respective confidence ( represented out of 10 ^ 9 )
// encodes block number in upper 28 bytes & confidence in lower 4 bytes
//
// To be deserialised in contract
const serialiseConfidence = (block, confidence) => (BigInt(block) << BigInt(32) | BigInt(confidence)).toString(10)

module.exports = {
    generateRandomDataMatrixIndices, getRows, getColumns, serialiseConfidence
}
