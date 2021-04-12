const { BigNumber } = require('bignumber.js')
const humanizeDuration = require('humanize-duration')

class BlockConfidence {

    constructor() {
        this.blocks = {}
        this.latest = 0n
        // this is milliseconds
        this.startedAt = new Date().getTime()
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

    rate() {
        // per second blocks getting verified
        return new BigNumber(this.done() / ((new Date().getTime() - this.startedAt) / 1000))
    }

    eta() {
        // expected when syncing will be fully done
        return humanizeDuration(new BigNumber((this.latest - BigInt(this.done())).toString()).div(this.rate()).toNumber() * 1000)
    }

    uptime() {
        // light client is up & running for duration
        return humanizeDuration(new Date().getTime() - this.startedAt)
    }

}

module.exports = { BlockConfidence }
