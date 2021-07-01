# da-light-client

Light client for Data Availability Blockchain of Polygon 🐿

**OnChain DA LightClient's primary version available [here](./onchain)**

![banner](./sc/banner.png)

## Introduction

Naive approach for building one DA light client, which will do following

- Listen for newly mined blocks
- As soon as new block is available, attempts to eventually gain confidence by asking for proof from full client _( via JSON RPC interface )_ for `N` many cells where cell is defined as `{row, col}` pair
- For lower numbered blocks, for which no confidence is yet gained, does batch processing in reverse order i.e. prioritizing latest blocks over older ones

## Installation

- First clone this repo in your local setup & run 👇 in root of this project, which will download all dependencies

```bash
npm i
```

- Create one `.env` file in root of project & put following content

```bash
touch .env
```

```
WSURI=ws://localhost:9944
AskProofCount=15
BatchSize=10
PORT=7000
```

Environment Variable | Interpretation
--- | ---
WSURI | Light client subcribes to full node, over **Websocket** transport, for receiving notification, as soon as new block gets mined
AskProofCount | For each new block seen by light client, it'll ask for these many proofs & verify those
BatchSize | At max this many blocks to be attempted to be verified, asynchronously, in a single go
PORT | Light client exposes RPC server over HTTP, at this port number

- Now, let's run light client

```bash
make run
```

## Usage

Given block number ( as _(hexa-)_ decimal number ) returns confidence obtained by light client for this block

```bash
curl -s localhost:7000/v1/confidence | jq
```

```json
{
    "number": 223,
    "confidence": 99.90234375,
    "serialisedConfidence": "958776730446"
}
```

---

**Note :** Serialised confidence has been added recently so that it can be consumed by smart contract light client. This field is computed as below

> `blockNumber << 32 | int32(confidence * 10 ** 7)`, where confidence is represented as out of 10 ** 9
