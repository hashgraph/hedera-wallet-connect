# Overview

Hedera is a public distributed ledger that is EVM compatible. This library provides tools to
integrate Hedera using Reown's AppKit and WalletKit.

There are 2 distict paths to integrate Hedera. Hedera natively operates using a gRPC based API
for write transactions and a REST API for read transactions. To acheive EVM compatibility, there
is a software middlelayer called the Hedera JSON-RPC Relay that translates Ethereum JSON-RPC
compatible API calls into the Hedera gRPC and REST API calls.

When integrating, app developers can choose to use the Hedera native approach and send
transactions to wallets over the WalletConnect relays using the JSON-RPC spec defined for Hedera
native transactions or use Ethereum JSON-RPC calls sent to a Hedera JSON-RPC provider which then
communicates with Hedera consensus and mirror nodes.

In short, JSON-RPC is a type of API stucture, such as SOAP, gRPC, REST, GraphQL, etc. In the
Hedera ecosystem, there are distinct concepts regarding JSON-RPC APIs to consider:

- Ethereum JSON-RPC spec defines how to interact with Ethereum compatible networks
- Hedera JSON-RPC Relay implements the Ethereum JSON-RPC spec for Hedera
- Wallets in the Hedera ecosystem support a separate JSON-RPC spec that defines how to send
  transactions to wallets over the WalletConnect relays. This is a Hedera specific spec that is
  not compatible with the Ethereum JSON-RPC spec, rather is used to interact with the Hedera
  network without the JSON-RPC Relay.

For more information see:

- [Ethereum JSON-RPC Specification ](https://ethereum.github.io/execution-apis/api-documentation/)
- [Hedera EVM: JSON-RPC relay](https://docs.hedera.com/hedera/core-concepts/smart-contracts/json-rpc-relay)
- [Hedera Native: JSON-RPC spec](https://docs.reown.com/advanced/multichain/rpc-reference/hedera-rpc).
- [@hashgraph/sdk](https://www.npmjs.com/package/@hashgraph/sdk)

## Getting started

1. Follow one of the quickstart instructions at
   https://docs.reown.com/appkit/overview#quickstart

2. Add Hedera dependencies to your project:

```sh
npm install file:../../hedera-wallet-connect @hashgraph/sdk @walletconnect/universal-provider
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

## Examples and Demos

- [Example App by Hgraph](https://github.com/hgraph-io/hedera-app)
- [Example Wallet by Hgraph](https://github.com/hgraph-io/hedera-wallet)
- [Hashgraph React Wallets by Buidler Labs](https://github.com/buidler-labs/hashgraph-react-wallets)
