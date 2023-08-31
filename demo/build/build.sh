#! /bin/sh

mkdir -p demo/dist/{wallet,dApp}

cp demo/src/index.html demo/dist/index.html
cp demo/src/wallet/index.html demo/dist/wallet/index.html
cp demo/src/dApp/index.html demo/dist/dApp/index.html

node demo/build/build.mjs
