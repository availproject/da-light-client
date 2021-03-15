// -- Reading config file in memory
const { join } = require('path')
require('dotenv').config({ path: join(__dirname, '.env') })

const { startLightClient } = require('./src/light')

// Main entry point, to be invoked for starting light client ops
const main = _ => startLightClient()

main().catch(e => {
    console.error(e)
    process.exit(1)
})
