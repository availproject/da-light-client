SHELL:=/bin/bash

build-dev:
	pushd verifier; cargo build; popd

run-dev: build-dev
	LD_LIBRARY_PATH=verifier/target/debug node index.js

build:
	pushd verifier; cargo build --release; popd

run: build
	LD_LIBRARY_PATH=verifier/target/release node index.js
