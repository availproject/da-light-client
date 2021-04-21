const humanizeDuration = require('humanize-duration')

class BlockConfidence {

    constructor() {
        this.blocks = {}
        this.startedBlock = 0n
        this.latestBlock = 0n
        // this is milliseconds
        this.startedAt = new Date().getTime()
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
        return `${(1 - (1 / Math.pow(2, this.blocks[number] || 0))) * 100} %`
    }

    done() {
        return Object.keys(this.blocks).length
    }

    updateLatest(num) {
        if (this.startedBlock == 0n) {
            this.startedBlock = num
        }

        this.latestBlock = num
    }

    uptime() {
        return humanizeDuration(new Date().getTime() - this.startedAt)
    }

}

module.exports = { BlockConfidence }
