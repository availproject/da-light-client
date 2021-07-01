class BlockConfidence {

    constructor() {
        this.blocks = {}
        this.latestBlock = 0n
    }

    alreadyVerified(number) {
        return number in this.blocks
    }

    incrementConfidence(number) {
        this.blocks[number] = (this.blocks[number] || 0) + 1
    }

    setConfidence(number, confidence) {
        this.blocks[number] = confidence
    }

    getConfidence(number) {
        return (1 - (1 / Math.pow(2, this.blocks[number] || 0))) * 100
    }

    updateLatest(num) {
        if (this.startedBlock == 0n) {
            this.startedBlock = num
        }

        this.latestBlock = num
    }
}

module.exports = { BlockConfidence }
