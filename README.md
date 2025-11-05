# Background

This library provides tools and recommendations on how to integrate Hedera into an application
that requires communication with a wallet that supports Hedera. There are 2 different paths to
integrate Hedera in this context. Both approaches use the
[WalletConnect](https://walletconnect.network/) network to send messages from apps to wallets
and back.

## Hedera APIs

Hedera natively operates using a gRPC API for write transactions and by default, a REST API for
read transactions. Hedera implements EVM compatible smart contracts using
[Hyperledger Besu](https://besu.hyperledger.org/) under the hood.

Ethereum developers and toolsets often expect to interact with Ethereum compatible chains using
the [Ethereum JSON-RPC](https://ethereum.org/en/developers/docs/apis/json-rpc/). To achieve
compatibility with this API,
[Hedera JSON-RPC Providers](https://docs.hedera.com/hedera/core-concepts/smart-contracts/json-rpc-relay#community-hosted-json-rpc-relays)
operate a software middlelayer that translates Ethereum JSON-RPC compatible API calls into
Hedera gRPC and REST API calls.

## Ethereum JSON-RPC vs. Hedera JSON-RPC vs. Hedera JSON-RPC Relay

When integrating, app developers can choose to use the Hedera native approach and send
transactions to wallets over the WalletConnect network using the JSON-RPC spec defined for
Hedera native transactions or use Ethereum JSON-RPC calls sent to a Hedera JSON-RPC Relay
provider which then communicates with Hedera consensus and mirror nodes.

On a high level, JSON-RPC is a type of API structure, such as SOAP, gRPC, REST, GraphQL, etc. In
the Hedera ecosystem, there are distinct concepts regarding JSON-RPC APIs to consider:

- Ethereum JSON-RPC spec defines how to interact with Ethereum compatible networks
- Hedera JSON-RPC Relay implements the Ethereum JSON-RPC spec for Hedera
- Wallets in the Hedera ecosystem also support a separate specification that defines how to send
  transactions and messages to wallets over the WalletConnect network without relying on a
  Hedera JSON-RPC Relay provider. This is a Hedera specific specification defined for utilizing
  the WalletConnect network distinct from other JSON-RPC specs such as the one defined by the
  Ethereum network.

For more information see:

- [Ethereum JSON-RPC Specification ](https://ethereum.github.io/execution-apis/api-documentation/)
- [Hedera JSON-RPC relay](https://docs.hedera.com/hedera/core-concepts/smart-contracts/json-rpc-relay)
- [Hedera Native JSON-RPC spec for WalletConnect](https://docs.reown.com/advanced/multichain/rpc-reference/hedera-rpc)
- [Hedera Javascript SDK](https://www.npmjs.com/package/@hashgraph/sdk)
- [Reown Docs](https://docs.reown.com/overview)
- [WalletConnect Network](https://walletconnect.network/)

# Getting started

In addition to choosing between the Hedera native JSON-RPC spec and the Ethereum JSON-RPC spec,
when building with javascript/typescript, there are 2 supported options to utilize the
WalletConnect network to send information from apps to wallets and back.

This README assumes an understanding of Hedera as well as the WalletConnect network and focusses
on how to send a payload to a wallet for processing and presentation to an end user that is a
Hedera account holder. We recommend reviewing the [Hedera Docs](https://docs.hedera.com/) and
first submitting transactions directly to the Hedera network without requiring interaction with
a [Wallet](#hedera-wallets) when integrating Hedera for the first time. We also recommend
reviewing the [Reown docs](https://docs.reown.com/overview).

## Using this library and underlying WalletConnect libraries directly

1. Add Hedera dependencies to your project:

```sh
npm install @hashgraph/hedera-wallet-connect @hashgraph/sdk @walletconnect/modal
```

2. Initialize dApp Connector

```typescript
import {
  HederaSessionEvent,
  HederaJsonRpcMethod,
  DAppConnector,
  HederaChainId,
} from '@hashgraph/hedera-wallet-connect'
import { LedgerId } from '@hashgraph/sdk'

const metadata = {
  name: 'Hedera Integration using Hedera DAppConnector - v1 approach',
  description: 'Hedera dAppConnector Example',
  url: 'https://example.com', // origin must match your domain & subdomain
  icons: ['https://avatars.githubusercontent.com/u/31002956'],
}

const dAppConnector = new DAppConnector(
  metadata,
  LedgerId.Mainnet,
  projectId,
  Object.values(HederaJsonRpcMethod),
  [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
  [HederaChainId.Mainnet, HederaChainId.Testnet],
)

await dAppConnector.init({ logger: 'error' })
```

3. Connect to a wallet

```typescript
await dAppConnector.openModal()
```

4. Handle sessions, events, and payloads.

- See: [DAppConnector](./src/lib/dapp/index.ts)

### Examples, demos, and tools

- [Hashgraph React Wallets by Buidler Labs](https://github.com/buidler-labs/hashgraph-react-wallets)
- [Hashgraph Online's WalletConnect SDK](https://github.com/hashgraph-online/hashinal-wc)
- <em>[Add an example, demo, or tool here](https://github.com/hashgraph/hedera-wallet-connect/pulls)</em>

## Using Reown's AppKit

1. Follow one of the quickstart instructions at
   https://docs.reown.com/appkit/overview#quickstart

2. Add Hedera dependencies to your project:

```sh
npm install @hashgraph/hedera-wallet-connect @hashgraph/sdk @walletconnect/universal-provider
```

3. Update `createAppKit` with adapters and a universal provider for Hedera. Note the
   HederaAdapter will need to come before the WagmiAdapter in the adapters array.

```typescript
import type UniversalProvider from '@walletconnect/universal-provider'

import {
  HederaProvider,
  HederaAdapter,
  HederaChainDefinition,
  hederaNamespace,
} from '@hashgraph/hedera-wallet-connect'

const metadata = {
  name: 'AppKit w/ Hedera',
  description: 'Hedera AppKit Example',
  url: 'https://example.com', // origin must match your domain & subdomain
  icons: ['https://avatars.githubusercontent.com/u/179229932']
}

const hederaEVMAdapter = new HederaAdapter({
  projectId,
  networks: [
    HederaChainDefinition.EVM.Mainnet,
    HederaChainDefinition.EVM.Testnet,
],
  namespace: 'eip155',
})

const universalProvider = (await HederaProvider.init({
  projectId: "YOUR_PROJECT_ID",
  metadata,
})) as unknown as UniversalProvider, // avoid type mismatch error due to missing of private properties in HederaProvider

// ...
createAppKit({
  adapters: [ hederaEVMAdapter ],
  //@ts-expect-error expected type error
  universalProvider,
  projectId,
  metadata,
  networks: [
    // EVM
    HederaChainDefinition.EVM.Mainnet,
    HederaChainDefinition.EVM.Testnet,
  ],
})

// ...
```

4. Recommended: Add Hedera Native WalletConnect Adapter

```typescript
import { HederaChainDefinition, hederaNamespace } from '@hashgraph/hedera-wallet-connect'

// ...

const hederaNativeAdapter = new HederaAdapter({
  projectId,
  networks: [HederaChainDefinition.Native.Mainnet, HederaChainDefinition.Native.Testnet],
  namespace: hederaNamespace, // 'hedera' as CaipNamespace,
})

// ...

createAppKit({
  adapters: [hederaEVMAdapter, hederaNativeAdapter],
  projectId,
  metadata,
  networks: [
    // EVM
    HederaChainDefinition.EVM.Mainnet,
    HederaChainDefinition.EVM.Testnet,
    // Native
    HederaChainDefinition.Native.Mainnet,
    HederaChainDefinition.Native.Testnet,
  ],
})
```

### Examples, demos, and tools

- [Hedera App Example by Hgraph](https://github.com/hgraph-io/hedera-app)
- [Hedera Wallet Example by Hgraph](https://github.com/hgraph-io/hedera-wallet)
- <em>[Add an example, demo, or tool here](https://github.com/hashgraph/hedera-wallet-connect/pulls)</em>

# Multi-Signature Transactions

Multi-signature (multi-sig) workflows allow multiple parties to sign a single transaction before it's executed on the Hedera network. This is commonly used for:

- Treasury operations requiring approval from multiple parties
- Escrow services
- Joint accounts
- Backend co-signing for additional security

## Using `hedera_signTransaction` for Multi-Sig Workflows

The `hedera_signTransaction` method allows you to collect a signature from a wallet without immediately executing the transaction. This signature can then be combined with additional signatures (such as from a backend service) before final execution.

### Example: Frontend Wallet Signature + Backend Co-Signature

This example demonstrates a common pattern where a user signs a transaction in their wallet, and then a backend service adds its signature before executing the transaction.

#### Step 1: Create and Sign Transaction on Frontend

```typescript
import { DAppConnector, HederaJsonRpcMethod } from '@hashgraph/hedera-wallet-connect'
import { TransferTransaction, Hbar, AccountId } from '@hashgraph/sdk'

// Initialize your DAppConnector (see Getting Started section)
const dAppConnector = new DAppConnector(/* ... */)

// Create a transaction
const transaction = new TransferTransaction()
  .addHbarTransfer(userAccountId, new Hbar(-10))
  .addHbarTransfer(recipientAccountId, new Hbar(10))
  .setTransactionMemo('Multi-sig transfer')

// Request signature from wallet (does NOT execute)
const signer = dAppConnector.getSigner(userAccountId)
const signedTransaction = await signer.signTransaction(transaction)

// Convert signed transaction to bytes for transmission to backend
const signedTransactionBytes = signedTransaction.toBytes()

// Send to backend
const response = await fetch('/api/execute-transaction', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    signedTransaction: Buffer.from(signedTransactionBytes).toString('base64'),
  }),
})

const result = await response.json()
console.log('Transaction executed:', result.transactionId)
```

#### Step 2: Add Backend Signature and Execute

On your backend, use the `addSignatureToTransaction` utility to add your server's signature:

```typescript
import { Transaction, PrivateKey, Client } from '@hashgraph/sdk'
import { addSignatureToTransaction } from '@hashgraph/hedera-wallet-connect'

// Backend API endpoint
app.post('/api/execute-transaction', async (req, res) => {
  try {
    // Reconstruct transaction from bytes
    const signedTransactionBytes = Buffer.from(req.body.signedTransaction, 'base64')
    const signedTransaction = Transaction.fromBytes(signedTransactionBytes)

    // Load your backend private key (store securely!)
    const backendPrivateKey = PrivateKey.fromStringED25519(process.env.BACKEND_PRIVATE_KEY)

    // Add backend signature to the transaction
    const fullySignedTransaction = await addSignatureToTransaction(
      signedTransaction,
      backendPrivateKey,
    )

    // Execute the fully signed transaction
    const client = Client.forTestnet() // or Client.forMainnet()
    client.setOperator(backendAccountId, backendPrivateKey)

    const txResponse = await fullySignedTransaction.execute(client)
    const receipt = await txResponse.getReceipt(client)

    res.json({
      success: true,
      transactionId: txResponse.transactionId.toString(),
      status: receipt.status.toString(),
    })
  } catch (error) {
    console.error('Error executing transaction:', error)
    res.status(500).json({ error: error.message })
  }
})
```

### Important Notes

1. **Transaction Must Be Frozen**: Before signing, ensure your transaction is frozen.

2. **Signature Order**: Signatures can be added in any order. Hedera validates that all required signatures are present when the transaction is executed.

3. **Security Considerations**:
   - Never expose backend private keys to the frontend
   - Validate transaction contents on the backend before adding your signature
   - Implement proper authentication and authorization
   - Consider implementing transaction limits and approval workflows

4. **Multiple Signatures**: You can add more than two signatures using the same pattern:

```typescript
// Add multiple signatures sequentially
let signedTx = await addSignatureToTransaction(transaction, privateKey1)
signedTx = await addSignatureToTransaction(signedTx, privateKey2)
signedTx = await addSignatureToTransaction(signedTx, privateKey3)

// Execute with all signatures
await signedTx.execute(client)
```

5. **Threshold Keys**: For accounts with threshold key structures, ensure you collect enough signatures to meet the threshold requirement before execution.

### Alternative: Using `hedera_signAndExecuteTransaction`

If you don't need backend co-signing and want the wallet to execute the transaction immediately:

```typescript
// This signs AND executes in one call
const result = await dAppConnector.signAndExecuteTransaction({
  signerAccountId: `hedera:testnet:${userAccountId}`,
  transactionList: transactionToBase64String(transaction),
})
```

Use `hedera_signTransaction` when you need to collect multiple signatures. Use `hedera_signAndExecuteTransaction` when the wallet's signature alone is sufficient to execute the transaction.

# Hedera Wallets

- [Hashpack](https://hashpack.app/)
- [Kabila](https://wallet.kabila.app/)
- [Dropp](https://dropp.cc/)

# Upgrading from v1 to v2

Upgrading from v1 to v2 should be fairly straightforward. We have maintained compatibility with
the v1 structure, while deprecating a few methods marked as deprecated. The v1 library did not
explicitly offer support for Ethereum JSON-RPC function calls, so the only breaking changes
refer to how to send transactions to wallets using the `hedera:(mainnet|testnet)` namespace.
While minimal, the main breaking changes are:

- remove WalletConnect v1 modals
  - these are very old, though in the spirit of semver, we kept the dependency until this
    library's v2 release

- remove setting node id's within this library for transactions
  - initially, a transaction created by the Hedera Javascript SDK needed to have one or more
    consensus node ids set to be able to serialize into bytes, sent over a network, and
    deserialized by the SDK
