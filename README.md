# da-light-client

## Introduction

Naive approach for building one DA light client, which will do following

- Poll for newly mined blocks every `X` second
- As soon as new block is available, attempts to process block, by fetching commitment provided in header & asking for proof from full client _( via JSON RPC interface )_ for `N` many cells where cell is defined as `{row, col}` pair
- For each of those `N` many proof(s), attempts to check correctness, eventually gains confidence

## Usage

- First clone this repo in your local setup & run 👇 in root of this project, which will download all dependencies

```bash
npm i
```

- Make sure you've started one full node & assuming it's exposing JSON RPC interface on port `9933`, run

```bash
make run
```

- You can change JSON RPC URL by modifying **HTTPURI** in `./index.js`

**More info coming ...**
