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

## Set up

To start using WalletConnect, sign up for an account at <https://cloud.walletconnect.com>. You
will use your project id when initializing client libraries.

It is important to understand core WalletConnect concepts when integrating this library. Please
reference the [WalletConnect documentation](https://docs.walletconnect.com/2.0/).

## Usage

Upon successfully configuring your dApp and/or wallet to manage WalletConnect sessions, you can
use this library’s functions to easily create and handle requests for the Hedera network.

### Wallet

This library provides a Wallet class that extends the
[ Web3Wallet ](https://github.com/WalletConnect/walletconnect-monorepo/tree/v2.0/packages/web3wallet)
class provided by WalletConnect class

#### Event Listeners

WalletConnect emits various events during a session. Listen to these events to synchronize the
state of your application:

```javascript
// Handle pairing proposals
signClient.on('session_proposal', (event) => {
  // Display session proposal to the user and decide to approve or reject
})

// Handle session requests, like signing transactions or messages
signClient.on('session_request', (event) => {
  // Process the session request
})

// Handle session deletions
signClient.on('session_delete', (event) => {
  // React to session termination
})
```

#### Pairing with dApps

Pairing establishes a connection between the wallet and a dApp. Once paired, the dApp can send
session requests to the wallet.

##### a. Pairing via URI

If a dApp shares a URI for pairing:

```javascript
await signClient.core.pairing.pair({ uri: 'RECEIVED_URI' })
```

Upon successful pairing, the `session_proposal` event will be triggered.

##### b. Pairing via QR Codes

For a better user experience, dApps often share QR codes that wallets can scan to establish a
pairing. Use a QR code scanning library to scan and obtain the URI, then proceed with pairing:

```javascript
const scannedUri = '...' // URI obtained from scanning the QR code
await signClient.core.pairing.pair({ uri: scannedUri })
```

#### Handling Session Proposals

Upon receiving a `session_proposal` event, display the proposal details to the user. Allow them
to approve or reject the session:

##### Handling Session Requests

Upon receiving a `session_request` event, process the request. For instance, if the dApp
requests a transaction to be signed:

### DApp

This library provides a simple interface to connect to a wallet and send requests using the
DAppConnector class, which wraps the WalletConnect signClient and WalletConnectModal.

#### Initialization

```javascript
import {
  DAppConnector,
  HederaSessionEvent,
  HederaChainId,
} from '@hashgraph/walletconnect-hedera'
import { LedgerId } from '@hashgraph/sdk'

const dAppMetadata = {
  name: '<Your dapp name>',
  description: '<Your dapp description>',
  url: '<Dapp url>',
  icons: ['<Image url>'],
}

const dAppConnector = new DAppConnector(
  dAppMetadata,
  LedgerId.TESTNET,
  projectId,
  Object.values(HederaJsonRpcMethod),
  [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
  [HederaChainId.Testnet],
)
await dAppConnector.init()
```

#### Pairing with Wallets

Establish a connection between a dApp and a wallet by pairing them. Multiple accounts can be
paired simultaneously.

```javascript
const session = await dAppConnector.openModal()
```

#### Sending Requests

Once paired, the dApp can send requests to the wallet. For instance, if the dApp wants to
request a transaction to be signed:

```javascript

const transaction = new TransferTransaction()
      .addHbarTransfer("0.0.12345", -1)
      .addHbarTransfer(receiver, 1)

const accountId = AccountId.fromString('0.0.12345')
const transactionSigned = await dAppConnector.signTransaction(
  accountId
  transaction,
)
```

##### 1 - hedera_getNodeAddresses

```javascript
const nodeAddresses = await dAppConnector.getNodeAddresses()
```

##### 2- hedera_ExecuteTransaction

```javascript
const transactionSigned = await dAppConnector.executeTransaction(
  accountId
  transaction,
)
```

##### 3- hedera_signMessage

```javascript
const response = await dAppConnector.signMessage(accountId, message)
```

##### 4- handleExecuteQuery

```javascript
const response = await dAppConnector.executeQuery(accountId, query)
```

##### 5- hedera_signAndExecuteTransaction

```javascript
const response = await dAppConnector.signAndExecuteTransaction(
  accountId
  transaction,
)
```

##### 6- hedera_signTransaction

```javascript
const transaction = await dAppConnector.signTransaction(
  accountId
  transaction,
)
```

#### Get a Signer

Use the accountId of a paired account to retrieve a signer and simplify interactions with the
Wallet and multiple accounts.

```javascript
const signer = dAppConnector.getSigner(AccountId.fromString('0.0.12345'))
const response = await signer.signAndExecuteTransaction(transaction)
```

#### Events

The events exposed by the DAppConnector can be accessed through the `walletConnectClient` prop.
To learn more about these events, please refer to
[WalletConnect Session Events](https://specs.walletconnect.com/2.0/specs/clients/sign/session-events).

```javascript
  dAppConnector.walletConnectClient.on('session_event', (event) => {
    // Handle session events, such as "chainChanged", "accountsChanged", etc.
    console.log(event)
  })

  dAppConnector.walletConnectClient.on('session_request_sent', (event) => {
    // Handle session events, such as "chainChanged", "accountsChanged", etc.
    console.log('session_request_sent: ', event)
  })

  dAppConnector.walletConnectClient.on('session_update', ({ topic, params }) => {
    // Handle session update
    const { namespaces } = params
    const _session = dAppConnector.walletConnectClient!.session.get(topic)
    // Overwrite the `namespaces` of the existing session with the incoming one.
    const updatedSession = { ..._session, namespaces }
    // Integrate the updated session state into your dapp state.
    console.log(updatedSession)
  })
```

#### Disconnecting

##### Disconnect single session

```javascript
dAppConnector.disconnectSession(session.topic)
```

##### Disconnect all sessions

```javascript
dAppConnector.disconnectAllSessions()
```

## Demo & docs

This repository includes a vanilla html/css/javascript implementation with a dApp and wallet
example useful for testing and development while integrating WalletConnect and Hedera.

The docs site utilizes [Typedoc](https://typedoc.org) to generate a library documentation site
at <https://wc.hgraph.app/docs/>

The demo source code lives in `./src/examples/typescript` and is available at
<https://wc.hgraph.app>

## Passing tests

- `git commit -Ss "the commit message"`
