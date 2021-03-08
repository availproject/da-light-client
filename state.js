class BlockConfidence {

    constructor() {
        this.blocks = {}
        this.total = process.env.AskProofCount || 10
    }

    setConfidence(number, confidence) {
        this.blocks[number] = confidence
    }

    getConfidence(number) {
        return `${(this.blocks[number] || 0 * 100) / this.total} %`
    }

}

module.exports = { BlockConfidence }
