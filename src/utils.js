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

// Given number, converts it into an array
// of unsigned 8-bit intergers, where bytes
// are placed in BigEndian form
const numberToUint8Array = number => {
    if (number == 0) {
        return new Uint8Array([])
    }

    const arr = []
    arr.unshift(number & 255)
    while (number >= 256) {
        number = number >>> 8
        arr.unshift(number & 255)
    }

    return new Uint8Array(arr)
}

// Converts a unsigned 8-bit interger array into
// hexadecimal string ( doesn't prepend `0x` )
const getUint8ArrayToHex = (number, size) => {
    return [...numberToUint8Array(number)]
        .map(v => v.toString(16).padStart(2, '0'))
        .join('')
        .padStart(size, '0')
}

// Given block number & respective confidence ( represented out of 10 ^ 9 )
// encodes block number in 28 bytes ( upper i.e. MSB ) & confidence in 4 bytes ( LSB )
//
// To be deserialised in contract
const serialiseConfidence = (block, confidence) => {
    return '0x' + getUint8ArrayToHex(block, 56) + getUint8ArrayToHex(confidence, 8)
}

module.exports = {
    generateRandomDataMatrixIndices, getRows, getColumns, serialiseConfidence
}
