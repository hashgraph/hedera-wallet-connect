---
title: Ed25519 & ECDSA Keys
sidebar_position: 6
---

# Choosing between Ed25519 & ECDSA Keys

When adding support for and building on the Hedera network using WalletConnect (Reown), understanding the differences between key types is crucial. The choice will depend on the use case and the networks planned to be supported, especially if full EVM compatibility is required.

## Ed25519

Use `Ed25519` keys if key length, security, and performance are priorities. This key type is fully supported natively on the Hedera network, offering additional features. However, `Ed25519` keys are not compatible with the [JSON-RPC relay](https://docs.hedera.com/hedera/core-concepts/smart-contracts/json-rpc-relay), which limits EVM compatibility.

## ECDSA

Use `ECDSA` keys if you need to use MetaMask or other EVM developer tools. These keys are ideal for apps that interface with Ethereum or EVM-compatible networks due to the associated EVM address. `ECDSA` keys are compatible with the [JSON-RPC relay](https://docs.hedera.com/hedera/core-concepts/smart-contracts/json-rpc-relay), ensuring seamless EVM compatibility.

:::tip ECDSA Keys Recommended 

For full EVM compatibility with the Hedera network via WalletConnect (Reown), it is recommended that dapps use **ECDSA** keys when creating accounts if EVM compatibility is important.

:::

## A note on accounts with Ed25519 keys

As of Dec 2024, most accounts on Hedera use the `Ed25519` key type since it was the first supported key type on the network. This is an important consideration for developers building on the network or integrating WalletConnect (Reown).

Hedera introduced support for `ECDSA` keys to enhance EVM compatibility, making tools like MetaMask and WalletConnect easier to use. Developers should balance their need for EVM compatibility with native Hedera features when choosing a key type.