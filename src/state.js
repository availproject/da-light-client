class BlockConfidence {

    constructor() {
        this.blocks = {}
        this.latest = 0n
    }

    incrementConfidence(number) {
        this.blocks[number] = (this.blocks[number] || 0) + 1
    }

    setConfidence(number, confidence) {
        this.blocks[number] = confidence
    }

    getConfidence(number) {
        return `${(1 - (1 / Math.pow(2, this.blocks[number] || 0))) * 100} %`
    }

    done() {
        return Object.keys(this.blocks).length
    }

    updateLatest(num) {
        this.latest = num
    }

}

module.exports = { BlockConfidence }
