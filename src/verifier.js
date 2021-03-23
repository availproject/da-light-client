const ffi = require('ffi-napi')
const ref = require('ref-napi')
const array = require('ref-array-di')(ref)

const U8Array = array(ref.types.uint8)

// Creating interface to be used for calling verifier
const lib = ffi.Library('libverifier', {
    verify_proof: ['bool', ['uint8', U8Array, 'size_t', U8Array, 'size_t']],
})

module.exports = {

    verifyProof: (col, commitment, proof) => {

        const _commitment = new U8Array(commitment)
        const _proof = new U8Array(proof)

        return lib.verify_proof(col, _commitment, _commitment.length, _proof, _proof.length)

    }

}
