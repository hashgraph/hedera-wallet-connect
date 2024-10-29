---
sidebar_position: 2
---

# dApp Guide

This guide provides step-by-step instructions to integrate and use **Hedera Wallet Connect**
within your decentralized application (dApp). By following these steps, you'll enable seamless
and secure interactions between your dApp and Hedera-based wallets.

## Table of Contents

- [dApp Guide](#dapp-guide)
  - [Table of Contents](#table-of-contents)
  - [Prerequisites](#prerequisites)
  - [Setup](#setup)
    - [Step 1: Importing Dependencies](#step-1-importing-dependencies)
    - [Step 2: Initializing Hedera Wallet Connect](#step-2-initializing-hedera-wallet-connect)
    - [Step 3: Listening for New Sessions](#step-3-listening-for-new-sessions)
    - [Step 4: Connecting to a Wallet](#step-4-connecting-to-a-wallet)
    - [Step 5: Submitting a Transaction](#step-5-submitting-a-transaction)
    - [Putting it all together](#putting-it-all-together)

## Prerequisites

Before you begin, ensure you have completed the [Installation](./installation.md) steps and have
the necessary dependencies installed in your project.

## Setup

Follow the steps below to set up Hedera Wallet Connect in your dApp.

### Step 1: Importing Dependencies

First, import the required modules from the Hedera Wallet Connect and Hedera SDK packages. These
dependencies are essential for establishing a connection between your dApp and Hedera wallets.

```javascript
import {
  HederaSessionEvent,
  HederaJsonRpcMethod,
  DAppConnector,
  HederaChainId,
} from '@hashgraph/hedera-wallet-connect'
import { LedgerId } from '@hashgraph/sdk'
```

### Step 2: Initializing Hedera Wallet Connect

Initialize a new `DAppConnector` instance with the necessary parameters. It's recommended to
store this instance (e.g., as a singleton) for reuse throughout your application.

```javascript
const dAppConnector = new DAppConnector(
  metadata,
  LedgerId.Mainnet,
  projectId,
  Object.values(HederaJsonRpcMethod),
  [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
  [HederaChainId.Mainnet],
)

await dAppConnector.init({ logger: 'error' })
```

### Step 3: Listening for New Sessions

Set up a listener to handle new iFrame sessions automatically. This ensures your dApp can
operate seamlessly within a wallet's dApp Browser. Handling sessions properly allows you to
manage user accounts and network information effectively.

```javascript
function handleNewSession(session: SessionTypes.Struct) {
  const sessionAccount = session.namespaces?.hedera?.accounts?.[0]
  const sessionParts = sessionAccount?.split(':')
  const accountId = sessionParts.pop()
  const network = sessionParts.pop()

  if (!accountId) {
    return
  } else {
    // Save the accountId and network in local storage for later use
    localStorage.setItem('hederaAccountId', accountId)
    localStorage.setItem('hederaNetwork', network)
    console.log('sessionAccount is', accountId, network)
  }
}

dAppConnector.onSessionIframeCreated = (session) => {
  handleNewSession(session)
}

console.log(`Hedera Wallet Connect SDK initialized`)
```

> **Note:** For a comprehensive example on handling sessions, refer to
> [hashinals-wc](https://github.com/hashgraph-online/hashinal-wc/blob/main/src/index.ts#L270).

### Step 4: Connecting to a Wallet

With the `DAppConnector` initialized, you can now enable users to connect their wallets. This
process involves opening a modal for users to select and connect their preferred Hedera wallet.

```javascript
// Open a modal for the user to connect their wallet
const session = await dAppConnector.openModal()

// Once connected, handle and store the session information
handleNewSession(session)
```

> **Recommendation:** Save the session information in local storage or a session to utilize it
> in future interactions within your dApp.

---

### Step 5: Submitting a Transaction

Creating and submitting a transaction is straightforward.

First, let's create a new transfer transaction.

```javascript
const transaction = new TransferTransaction()
  .setTransactionId(TransactionId.generate(fromAccountId))
  .addHbarTransfer(AccountId.fromString(fromAccountId), new Hbar(-amount))
  .addHbarTransfer(AccountId.fromString(toAccountId), new Hbar(amount))
```

Next, let's get the signer for the account that we connected to the dApp. Remember, we saved the
accountId in local storage when we connected to the dApp, let's retrieve it.

```javascript
const accountId = localStorage.getItem('hederaAccountId')
```

Now, let's get the signer for the account.

```javascript
const signer = dAppConnector.signers.find(
  (signer_) => signer_.getAccountId().toString() === accountId,
)
```

Finally, let's sign and submit the transaction.

```javascript
// Freeze the transaction with the signer
const signedTx = await tx.freezeWithSigner(signer)
// Execute the transaction with the signer
const executedTx = await signedTx.executeWithSigner(signer)
// Get the receipt of the transaction with the signer
return await executedTx.getReceiptWithSigner(signer)
```

By following these steps, your dApp will be equipped to interact securely and efficiently with
Hedera-based wallets, providing users with a smooth and integrated experience.

### Putting it all together

Here's a complete example that combines all the steps above into a single implementation:

Notes:
- You will need to replace the `projectId` and `metadata` with your own values.
- You can find more elaborate examples in [Demos](./demos.md).

```javascript
import {
  HederaSessionEvent,
  HederaJsonRpcMethod,
  DAppConnector,
  HederaChainId,
} from '@hashgraph/hedera-wallet-connect'
import { LedgerId, TransferTransaction, TransactionId, AccountId, Hbar } from '@hashgraph/sdk'

const projectId = 'your-project-id-from-wallet-connect';
const metadata = {
  name: 'MydApp',
  description: 'My dApp does things.',
  url: 'https://mywebsite.com',
  icons: ['https://mywebsite.com/logo.jpg'],
};

let dAppConnector;

// Session handling function
function handleNewSession(session) {
  const sessionAccount = session.namespaces?.hedera?.accounts?.[0]
  const sessionParts = sessionAccount?.split(':')
  const accountId = sessionParts.pop()
  const network = sessionParts.pop()

  if (!accountId) {
    return
  } else {
    localStorage.setItem('hederaAccountId', accountId)
    localStorage.setItem('hederaNetwork', network)
    console.log('sessionAccount is', accountId, network)
  }
}

// Initialize and set up event listeners
async function initializeWalletConnect() {
  dAppConnector = new DAppConnector(
    metadata,
    LedgerId.Mainnet,
    projectId,
    Object.values(HederaJsonRpcMethod),
    [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
    [HederaChainId.Mainnet],
  )
  await dAppConnector.init({ logger: 'error' })

  dAppConnector.onSessionIframeCreated = (session) => {
    handleNewSession(session)
  }
}

// Connect wallet function
async function connectWallet() {
  const session = await dAppConnector.openModal()
  handleNewSession(session)
}

// Example transfer function
async function transferHbar(fromAccountId, toAccountId, amount) {
  try {
    // Create the transaction
    const transaction = new TransferTransaction()
      .setTransactionId(TransactionId.generate(fromAccountId))
      .addHbarTransfer(AccountId.fromString(fromAccountId), new Hbar(-amount))
      .addHbarTransfer(AccountId.fromString(toAccountId), new Hbar(amount))

    // Get the signer for the connected account
    const accountId = localStorage.getItem('hederaAccountId')
    const signer = dAppConnector.signers.find(
      (signer_) => signer_.getAccountId().toString() === accountId,
    )

    // Sign and execute the transaction
    const signedTx = await transaction.freezeWithSigner(signer)
    const executedTx = await signedTx.executeWithSigner(signer)
    const receipt = await executedTx.getReceiptWithSigner(signer)

    return receipt
  } catch (error) {
    console.error('Transfer failed:', error)
    throw error
  }
}

// Usage example
(async () => {
  await initializeWalletConnect()

  // Connect wallet when needed
  await connectWallet()

  // Example transfer
  const receipt = await transferHbar(
    '0.0.123456',
    '0.0.123457',
    1, // amount in HBAR
  )
  console.log('Transfer complete:', receipt)
})()
```

This complete example shows how all the pieces fit together, from initialization to executing
transactions. Remember to:

1. Initialize the DAppConnector first
2. Set up your session handlers
3. Connect the wallet when needed
4. Use the established connection to execute transactions

You can adapt this code to your specific needs and integrate it into your application's
architecture.
