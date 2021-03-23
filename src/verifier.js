const ffi = require('ffi-napi')
const ref = require('ref-napi')
const array = require('ref-array-di')(ref)

const U8Array = array(ref.types.uint8)

// Creating interface to be used for calling verifier
const lib = ffi.Library('libverifier', {
    verify_proof: ['uint8', ['uint64', U8Array, 'size_t', U8Array, 'size_t', U8Array, 'size_t', U8Array, 'size_t']],
})

module.exports = {

    // Returns how many proof verification attempts were successful as `u8`
    verifyProof: (block, rows, cols, commitment, proof) => {

        const _rows = U8Array(rows)
        const _cols = new U8Array(cols)
        const _commitment = new U8Array(commitment)
        const _proof = new U8Array(proof)

        return lib.verify_proof(
            block, _rows, _rows.length,
            _cols, _cols.length,
            _commitment, _commitment.length,
            _proof, _proof.length)

    }

}
