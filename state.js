class BlockConfidence {

    constructor() {
        this.blocks = {}
    }

    setConfidence(number, confidence) {
        this.blocks[number] = confidence
    }

    getConfidence(number) {
        return this.blocks[number]
    }

}

module.exports = { BlockConfidence }
