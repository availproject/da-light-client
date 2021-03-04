class BlockConfidence {

    constructor() {
        this.blocks = {}
    }

    setConfidence(number, confidence) {
        this.blocks[number] = confidence
    }

    getConfidence(number) {

        if (number in this.blocks) {
            return `${(this.blocks[number].true * 100) / (this.blocks[number].true + this.blocks[number].false)} %`
        }

        return null

    }

}

module.exports = { BlockConfidence }
