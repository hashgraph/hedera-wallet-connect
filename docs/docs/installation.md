---
sidebar_position: 1
slug: /
---

# Installation

**Hedera Wallet Connect** is a library that enables decentralized applications (dApps) to interact seamlessly with Hedera wallets using the WalletConnect protocol. This integration facilitates secure and efficient communication between your dApp and Hedera-based wallets.

## Table of Contents

- [Installation](#installation)
  - [Table of Contents](#table-of-contents)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation-1)
    - [Using npm](#using-npm)
    - [Using yarn](#using-yarn)

## Prerequisites

Before integrating Hedera Wallet Connect into your project, ensure you have the following:

- **Node.js**: Version 18.0 or above. Use NVM to manage Node.js versions. [Install NVM](https://github.com/nvm-sh/nvm#installing-and-updating) and then run the following commands:
  ```bash
  nvm install 18
  nvm use 18
  ```
- **Package Manager**: npm or yarn. After installing Node.js, npm is included by default. To install Yarn, run:
  ```bash
  npm install --global yarn
  ```
- **WalletConnect Cloud Project ID**: Required for establishing connections between your dApp and wallets.
  1. Visit [WalletConnect Cloud](https://cloud.walletconnect.com)
  2. Sign in or create a new account
  3. Click "Create New Project"
  4. Name your project and click "Create"
  5. Copy the "Project ID" from the project dashboard

## Installation

Install the Hedera Wallet Connect package using npm or yarn. Note, you will also need to install the Hedera SDK and other peer dependencies.

### Using npm

```bash
npm install @hashgraph/hedera-wallet-connect @hashgraph/sdk @hashgraph/proto @hashgraph/hedera-wallet-connect @walletconnect/modal @walletconnect/qrcode-modal @walletconnect/utils @walletconnect/types @walletconnect/modal-core
```

### Using yarn

```bash
yarn add @hashgraph/hedera-wallet-connect @hashgraph/sdk @hashgraph/proto @hashgraph/hedera-wallet-connect @walletconnect/modal @walletconnect/qrcode-modal @walletconnect/utils @walletconnect/types @walletconnect/modal-core
```
