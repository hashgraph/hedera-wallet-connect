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
the [Ethereum JSON-RPC](https://ethereum.org/en/developers/docs/apis/json-rpc/). To acheive
compatibility with this API,
[Hedera JSON-RPC Providers](https://docs.hedera.com/hedera/core-concepts/smart-contracts/json-rpc-relay#community-hosted-json-rpc-relays)
operate a software middlelayer that translates Ethereum JSON-RPC compatible API calls into
Hedera gRPC and REST API calls.

## Ethereum JSON-RPC vs. Hedera JSON-RPC vs. Hedera JSON-RPC Relay

When integrating, app developers can choose to use the Hedera native approach and send
transactions to wallets over the WalletConnect network using the JSON-RPC spec defined for
Hedera native transactions or use Ethereum JSON-RPC calls sent to a Hedera JSON-RPC Relay
provider which then communicates with Hedera consensus and mirror nodes.

On a high level, JSON-RPC is a type of API stucture, such as SOAP, gRPC, REST, GraphQL, etc. In
the Hedera ecosystem, there are distinct concepts regarding JSON-RPC APIs to consider:

- Ethereum JSON-RPC spec defines how to interact with Ethereum compatible networks
- Hedera JSON-RPC Relay implements the Ethereum JSON-RPC spec for Hedera
- Wallets in the Hedera ecosystem also support a separate specification that defines how to send
  transactions and messages to wallets over the WalletConnect network without relying on a
  Hedera JSON-RPC Relay provider. This is a Hedera specific specification defined for utilizing
  the WalletConnect network distict from other JSON-RPC specs such as the one defined by the
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
npm install @hashgraph/hedera-wallet-connect@2.0.0-canary.811af2f.0 @hashgraph/sdk @walletconnect/modal
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
npm install @hashgraph/hedera-wallet-connect@2.0.1-canary.24fffa7.0 @hashgraph/sdk @walletconnect/universal-provider
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
  projectId: "YOUR_PROJECT_ID"
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

# Hedera Wallets

- [Hashpack](https://hashpack.app/)
- [Kabila](https://wallet.kabila.app/)
- [Blade](https://bladewallet.io/)
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
