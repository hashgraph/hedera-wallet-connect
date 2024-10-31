---
sidebar_position: 3
---

# Wallet Guide
This guide provides step-by-step instructions to integrate and use **Hedera Wallet Connect** within your wallet. Ensure you have followed the [installation](./installation.md) instructions before proceeding.
### Required Dependencies

Additionally, in this guide we will use the `@walletconnect/web3wallet` package. Install it using npm or yarn:

```
  npm install @walletconnect/web3wallet
```

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
allow this possibility, the dAppConnector look for extensions. If you create the AppConnector,
it will automatically send a message to the extension to detect if it is installed. In case the
extension is installed, it will be added to the available extensions and its data can be found
at the extensions property of dAppConnector.

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
  [HederaChainId.Testnet]
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

- `"hedera-extension-query"`: The extension is required to respond with
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

To enable communication between the extension and a web dApp embedded in an iframe, the wallet
must support the following messages:

- `"hedera-iframe-query"`:The extension is required to respond with `"hedera-iframe-response"`
  and provide the next set of data in the metadata property.
  ```javascript
  let metadata = {
    id: '<Wallet extension id>',
    name: '<Wallet name>',
    url: '<Wallet url>',
    icon: '<Wallet icon>',
    description: '<Wallet description>',
  }
  ```
- `"hedera-iframe-connect"`: The extension must listen to this message and utilize the
  `pairingString` property in order to establish a connection.

The dAppConnector is designed to automatically initiate pairing without any need for user
action, in case no sessions are noticed and an iframe extension is detected. To capture this
event and the newly established session, you can utilize the `onSessionIframeCreated` function.
**