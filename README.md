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

### DApps

#### Signer

This library provides a `DAppSigner` class that implements the `@hashgraph/sdk`'s `Signer`
interface. You may use the `DAppSigner` class to sign and execute transactions on the Hedera
network.

##### Get Signer

After you have paired your wallet with your dApp, you can get the signer from the
`DAppConnector` instance:

```javascript
const signer = dAppConnector.signers[0] // DAppSigner
```

Or, if multiple signers are available, you can find the signer by account ID:

```javascript
const signer = dAppConnector.signers.find(
  (signer_) => signer_.getAccountId().toString() === '0.0.100',
) // DAppSigner
```

##### Sign Transactions

```javascript
const transaction = new TransferTransaction()
  .addHbarTransfer('0.0.100', new Hbar(-1))
  .addHbarTransfer('0.0.101', new Hbar(1))

await transaction.freezeWithSigner(signer)
const signedTransaction = await signer.signTransaction(transaction)
```

##### Sign and Execute Transactions

```javascript
const transaction = new TransferTransaction()
  .addHbarTransfer('0.0.100', new Hbar(-1))
  .addHbarTransfer('0.0.101', new Hbar(1))

await transaction.freezeWithSigner(signer)
const transactionResponse = await transaction.executeWithSigner(signer)
```

##### Sign and verify messages

```javascript
const text = 'Example message to sign'
const base64String = btoa(text)

const sigMaps = await signer.sign([base64StringToUint8Array(base64String)]) // import { base64StringToUint8Array } from '@hashgraph/hedera-wallet-connect'

// sigMaps[0].publicKey also contains the public key of the signer, but you should obtain a PublicKey you can trust from a mirror node.
const verifiedResult = verifySignerSignature(base64String, sigMaps[0], publicKey) // import { verifySignerSignature } from '@hashgraph/hedera-wallet-connect'
```

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

#### Extension popup

By default, it is not possible to directly pop up an extension with Wallet Connect. However, to
allow this possibility, the dAppConnector accepts a list of extension IDs. If you create the
AppConnector with an extension ID, it will automatically send a message to the extension to
detect if it is installed. In case the extension is installed, it will be added to the available
extensions and its data can be found at the extensions property of dAppConnector.

To connect an available extension, use the method `connectExtension(<extensionId>)`. This will
link the extension to the signer and session. Whenever you use the signer created for this
session, the extension will automatically open. You can find out if the extension is available
by checking the `extensions` property.

```javascript
const dAppConnector = new DAppConnector(
  dAppMetadata,
  LedgerId.TESTNET,
  projectId,
  Object.values(HederaJsonRpcMethod),
  [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
  [HederaChainId.Testnet],
  ['<Extension ID 1>, <Extension ID 2>'],
)

[...]

dAppConnector?.extensions?.forEach((extension) => {
  console.log(extension)
})

const extension = dAppConnector?.extensions?.find((extension) => extension.name === '<Extension name>')
if (extension.available) {
  await dAppConnector!.connectExtension(extension.id);
  const signer = dAppConnector.getSigner(AccountId.fromString('0.0.12345'))

  // This request will open the extension
  const response = await signer.signAndExecuteTransaction(transaction)
}
```

Wallets that are compatible should be able to receive and respond to the following messages:

- `"hedera-extension-query-<extesnionId>"`: The extension is required to respond with
  `"hedera-extension-response"` and provide the next set of data in the metadata property.
  ```javascript
  let metadata = {
    id: '<extesnionId>',
    name: '<Wallet name>',
    url: '<Wallet url>',
    icon: '<Wallet con>',
    description: '<Wallet url>',
  }
  ```
- `"hedera-extension-open-<extensionId>"`: The extension needs to listen to this message and
  automatically open.
- `"hedera-extension-connect-<extensionId>"`: The extension must listen to this message and
  utilize the `pairingString` property in order to establish a connection.

This communication protocol between the wallet and web dApps requires an intermediate script to
use the Chrome API. Refer to the
[Chrome Extensions documentation](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)

## Demo & docs

This repository includes a vanilla html/css/javascript implementation with a dApp and wallet
example useful for testing and development while integrating WalletConnect and Hedera.

The docs site utilizes [Typedoc](https://typedoc.org) to generate a library documentation site
at <https://wc.hgraph.app/docs/>

The demo source code lives in `./src/examples/typescript` and is available at
<https://wc.hgraph.app>

## Passing tests

- `git commit -Ss "the commit message"`
