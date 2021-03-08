# da-light-client

## Introduction

Naive approach for building one DA light client, which will do following

- Poll for newly mined blocks every `X` second
- As soon as new block is available, attempts to process block, by fetching commitment provided in header & asking for proof from full client _( via JSON RPC interface )_ for `N` many cells where cell is defined as `{row, col}` pair
- For each of those `N` many proof(s), attempts to check correctness, eventually gains confidence

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
HTTPURI=http://localhost:9933
AskProofCount=10
PORT=7000
```

Environment Variable | Interpretation
--- | ---
HTTPURI | HTTP URI for making RPC calls to a full node
AskProofCount | For each new block seen by light client, it'll ask for these many proofs & verify those
PORT | Light client exposes RPC server over HTTP, at this port number

- Now, let's run light client

```bash
make run
```

## Usage

Given block number returns confidence obtained by light client for this block number

```bash
curl -s -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","method":"get_blockConfidence","params": {"number": 223}, "id": 1}' http://localhost:7000/v1/json-rpc | jq
```

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "number": 223,
    "confidence": "100 %"
  }
}
```

> Note : You'll receive `0 %` in response, when no confidence is yet gained for requested block.

**More info coming ...**
