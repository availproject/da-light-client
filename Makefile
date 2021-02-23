SHELL:=/bin/bash

build:
	pushd verifier; cargo build; popd

run: build
	LD_LIBRARY_PATH=verifier/target/debug node index.js
