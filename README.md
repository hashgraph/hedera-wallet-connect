# Overview

This package managed by the Hedera community and is intended to be a standard for ecosystem
wallets and dApp providers utilizing [WalletConnect](https://walletconnect.com) as a their
communications protocol. It utilizes the
[`@hashgraph/sdk`](https://www.npmjs.com/package/@hashgraph/sdk) and provides functions to
facilitate implementing the
[Hedera <> WalletConnect JSON-RPC spec](https://walletconnect-specs-git-fork-hgraph-io-main-walletconnect1.vercel.app/2.0/blockchain-rpc/hedera-rpc).

> WalletConnect brings the ecosystem together by enabling wallets and apps to securely connect
> and interact.
>
> -- <cite> https://walletconnect.com

This library facilitates the implementation of the **Hedera <> WalletConnect Spec** which allows
wallets and dApps to natively integrate with Hedera. It provides additional, out of network
functionality with the `hedera_signMessage` function.

In short, it uses the Hedera javascript SDK to build transactions, serialize them, send "them
over the wire" to wallets for processing and return responses back to dApps.

A message could be one of:

- a Hedera network response
- an error message
- signed transaction bytes
- signed arbitrary set of bytes

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

### dApp

1. **Initialize WalletConnect SignClient**: Start by setting up a WalletConnect
   [`SignClient`](https://docs.walletconnect.com/2.0/api/sign/dapp-usage). This is your primary
   interface for establishing and managing sessions between a dApp and a wallet.

```javascript
import SignClient from '@walletconnect/sign-client'

const signClient = await SignClient.init({ ...signClientProps })
// Ensure other initialization steps are followed as per the WalletConnect documentation.
```

2. **Construct a Hedera Transaction**: Use the `@hashgraph/sdk` to build your desired Hedera
   transaction. When calling the `.freeze()` method in preparation for serialization you must
   set a `TransactionId` and a `NodeAccountId`.
   [Create an unsigned transaction](https://docs.hedera.com/hedera/sdks-and-apis/sdks/transactions/create-an-unsigned-transaction).

```javascript
import { AccountId, TransactionId, TopicMessageSubmitTransaction } from '@hashgraph/sdk'

const payerAccountId = new AccountId(userAccountId)
const nodeAccountIds = [new AccountId(3)]
const transactionId = TransactionId.generate(payerAccountId)

const transaction = new TopicMessageSubmitTransaction()
  .setTransactionId(transactionId)
  .setNodeAccountIds(nodeAccountIds)
  .setTopicId(topicId)
  .setMessage('Hello Future')
```

3. **Build the Session Request Payload**: The `@hashgraph/wallectconnect` library provides a
   seamless way to prepare the session request payload. Ensure that you set the `RequestType`
   accurately to match the type of Hedera transaction you've constructed.

```javascript
import {..., RequestType } from '@hashgraph/sdk'
import { HederaSessionRequest } from '@hashgraph/wallectconnect'

const payload = HederaSessionRequest.create({
  chainId: 'hedera:testnet',
  topic: 'abcdef123456',
}).buildSignAndExecuteTransactionRequest(RequestType.ConsensusSubmitMessage, transaction)
```

4. **Send the Transaction to the Wallet**: With the payload prepared, utilize the WalletConnect
   `signClient` to dispatch the transaction details to the user's wallet for approval. When the
   payload is received by the connected wallet, the wallet should prompt the account owner
   either sign or reject the transaction.

```javascript
const result = await signClient.request(payload)
// do something with the result
console.log(result)
```

By following these steps, your dApp has access to the full set of Hedera network services. Be
sure to refer to the linked documentation for in-depth details, best practices, and updates.

### Wallet

There are 2 core WalletConnect APIs to be implemented by a Wallet:

The [Sign API](https://docs.walletconnect.com/2.0/api/sign/overview)

> WalletConnect Sign is a remote signer protocol to communicate securely between web3 wallets
> and dapps. The protocol establishes a remote pairing between two apps and/or devices using a
> Relay server to relay payloads. These payloads are symmetrically encrypted through a shared
> key between the two peers. The pairing is initiated by one peer displaying a QR Code or deep
> link with a standard WalletConnect URI and is established when the counter-party approves this
> pairing request.

The [Auth API](https://docs.walletconnect.com/2.0/api/auth/overview)

> WalletConnect Auth is an authentication protocol that can be used to log-in blockchain wallets
> into apps. With a simple and lean interface, this API verifies wallet address ownership
> through a single signature request, realizing login in one action. It enables apps to set up a
> decentralized and passwordless onboarding flow.

The following instructions demonstrate implementation of the Sign API.

#### 1. Setup and Installation

First, make sure you've installed the necessary npm packages:

```bash
npm install @walletconnect/sign-client @hashgraph/sdk @hashgraph/wallectconnect
```

#### 2. Initialize WalletConnect SignClient

You'll need your WalletConnect Project ID for this step. If you haven't already, obtain a
Project ID from [WalletConnect Cloud](https://cloud.walletconnect.com/app).

```javascript
import SignClient from '@walletconnect/sign-client'

const signClient = await SignClient.init({
  projectId: 'YOUR_PROJECT_ID',
  metadata: {
    name: 'Your Wallet Name',
    description: 'Description for your wallet',
    url: 'https://your-wallet-url.com',
    icons: ['https://your-wallet-url.com/icon.png'],
  },
})
```

#### 3. Event Listeners

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

For a complete list of events and their structure, refer to the provided WalletConnect
documentation. [WalletConnect Usage](https://docs.walletconnect.com/2.0/api/sign/wallet-usage)

#### 4. Pairing with dApps

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

#### 5. Handling Session Proposals

Upon receiving a `session_proposal` event, display the proposal details to the user. Allow them
to approve or reject the session:

```javascript
// Approving a session proposal
const { topic, acknowledged } = await signClient.approve({
  id: proposalId, // From the session_proposal event
  namespaces: {
    hedera: {
      accounts: ['hedera:testnet:YOUR_HEDERA_ACCOUNT_ID'],
      methods: ['hedera_signAndExecuteTransaction'],
    },
  },
})

// Rejecting a session proposal
await signClient.reject({
  id: proposalId,
  reason: {
    code: 1,
    message: 'User rejected the proposal',
  },
})
```

##### 6. Handling Session Requests

Upon receiving a `session_request` event, process the request. For instance, if the dApp
requests a transaction to be signed:

```javascript
// Using the @hashgraph/sdk library
import { base64StringToTransaction, HederaWallet } from '@hashgraph/walletconnect'

const transaction = base64StringToTransaction(event.params.request.params)
// show the transaction details and prompt the user for confirmation or rejection
confirm('Would you like to complete this transaction?')

//sign on approval
const hederaWallet = await HederaWallet.init({
  accountId: 'YOUR_HEDERA_ACCOUNT_ID',
  privateKey: 'YOUR_HEDERA_PRIVATE_KEY',
  network: 'testnet',
})
const response = await hederaWallet.signAndExecuteTransaction(transaction)
```

Return the network response to the dApp:

```javascript
await signClient.send({ id: event.id, result: response })
```

##### 7. Ending a Session

Sessions can be deleted by either the dApp or the wallet. When the `session_delete` event is
triggered, update your application's state to reflect the end of the session:

```javascript
signClient.on('session_delete', (event) => {
  // Update the UI to show the session has ended
})
```

Remember to always handle errors gracefully, informing users about any issues or required
actions. Upon successful implementation by using the above steps and associated documentation,
your wallet is ready to interact with dApps using WalletConnect.
