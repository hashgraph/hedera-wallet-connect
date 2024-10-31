# Overview

This library is the result of Hedera community collaboration to bring Hedera into the
WalletConnect ecosystem and vice versa.

The goal of this repository is to be a reference for wallets and dApps integrating the
WalletConnect <> Hedera JSON-RPC reference. Additionally, this library is meant to be included
in projects supporting WalletConnect and Hedera, providing utility functions useful to
validating requests and resposes in both the WalletConnect JSON-RPC context as well as the
Hedera context.

A few useful resources include:

- [HIP-820](https://hips.hedera.com/hip/hip-820)
- [WalletConnect <> Hedera JSON-RPC spec](https://specs.walletconnect.com/2.0/blockchain-rpc/hedera-rpc).

> WalletConnect brings the ecosystem together by enabling wallets and apps to securely connect
> and interact.
>
> -- <cite> https://walletconnect.com

Hedera aims to be:

> The open source public ledger for everyone
>
> -- <cite> https://hedera.com

---

This package managed by the Hedera community and is intended to be a standard for ecosystem
wallets and dApp providers utilizing [WalletConnect](https://walletconnect.com) as a their
communications protocol. It utilizes the
[`@hashgraph/sdk`](https://www.npmjs.com/package/@hashgraph/sdk) and provides functions to
facilitate implementing the
[WalletConnect <> Hedera JSON-RPC spec](https://specs.walletconnect.com/2.0/blockchain-rpc/hedera-rpc)
which has been defined through the collaborative HIP process in
[HIP-820](https://hips.hedera.com/hip/hip-820).

This library facilitates the implementation of the **WalletConnect <> Hedera Spec** which allows
wallets and dApps to natively integrate with Hedera. It provides additional, out of network
functionality with the `hedera_signMessage` function.

In short, it uses the Hedera javascript SDK to build transactions, serialize them, send to
wallets for processing and return responses back to dApps.

_Please note, this is distinct from the
[Implementation of Ethereum JSON-RPC APIs for Hedera](https://github.com/hashgraph/hedera-json-rpc-relay).
At the time of this writing, "the Hedera JSON-RPC relay implementation is in beta, offers
limited functionality today, and is only available to developers."_

_The relay and this library have different intentions and serve different purposes - namely
native Hedera integration vs. Ethereum compatability layers to ease developer onboarding for
those more familiar with the Ethereum ecosystem._

# Documentation

WalletConnect <> Hedera docs are fully hosted on [https://hwc-docs.hgraph.app/](https://hwc-docs.hgraph.app/)

- [Installation](/docs/docs/installation.md)
- [dApp Guide](/docs/docs/dapp-guide.md)
- [Wallet Guide](/docs/docs/wallet-guide.md)
- [Signing Messages](/docs/docs/sign-messages.md)
- [Demos](/docs/docs/demos.md)

# Accessing the docs locally

- `cd docs`
- `npm install`
- `npm run docs`
- Navigating to `localhost:3000`
