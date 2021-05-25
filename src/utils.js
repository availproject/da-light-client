const AskProofCount = parseInt(process.env.AskProofCount) || 10

const getRows = indices => indices.map(({ row, _ }) => row)

const getColumns = indices => indices.map(({ _, col }) => col)

// Generates unique random data matrix indices, to be used when querying
// full node for proofs, for a certain block number
//
// `rows` & `cols` specifies data matrix size, as per that
// indices are generated
const generateRandomDataMatrixIndices = (rows, cols) => {
    const target = Math.min(rows * cols, AskProofCount)
    const indices = {}

    while (Object.keys(indices).length < target) {
        const row = getRandomInt(0, rows)
        const col = getRandomInt(0, cols)

        const key1 = `${row}${col}`
        if (!(key1 in indices)) {
            indices[key1] = { row, col }
        }

        if (row == col) {
            continue
        }

        const key2 = `${col}${row}`
        if (!(key2 in indices)) {
            indices[key2] = { row: col, col: row }
        }
    }

    return Object.entries(indices).map(v => v[1])
}

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
