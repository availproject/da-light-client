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

- For running light client, set following environment variables

```bash
export FullNodeURL=https://polygon-da-rpc.matic.today
export Port=7000
```


Environment Variable | Interpretation
--- | ---
WSURI | Light client subcribes to full node, over **Websocket** transport, for receiving notification, as soon as new block gets mined
AskProofCount | For each new block seen by light client, it'll ask for these many proofs & verify those
BatchSize | At max this many blocks to be attempted to be verified, asynchronously, in a single go
PORT | Light client exposes RPC server over HTTP, at this port number

- Now, let's run light client from the root directory

```bash
cd src && cargo run
```

## Usage

1. Given block number ( as _(hexa-)_ decimal number/ string ) returns confidence obtained by light client for this block

```bash
curl -s localhost:7000/v1/confidence/<blockNumber> | jq
```

---

**Note :** Serialised confidence has been added recently so that it can be consumed by smart contract light client. This field is computed as below

> `blockNumber << 32 | confidence`, where confidence is represented as out of 10 ** 9

That's what [`serialiseConfidence()`](./src/utils.js) does.

Deserialisation to be handled on-chain.



**More info coming ...**
