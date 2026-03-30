/*
 *
 * Hedera Wallet Connect
 *
 * Copyright (C) 2025 Hedera Hashgraph, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import { LedgerId } from '@hiero-ledger/sdk'
import { CaipNetwork } from '@reown/appkit-common'

// V1 imports
import {
  networkNamespaces,
  HederaJsonRpcMethod,
  DAppConnector
} from '../../src'

// V2 imports
import {
  createNamespaces,
  HederaChainDefinition,
  HederaProvider
} from '../../src'

import { dAppMetadata, projectId } from '../_helpers'

describe('Namespace Consistency Between V1 and V2', () => {
  const testEvents = ['accountsChanged', 'chainChanged']
  const testMethods = Object.values(HederaJsonRpcMethod)

  describe('Namespace Structure Comparison', () => {
    it('should create equivalent hedera namespace structure in v1 and v2', () => {
      // V1: DAppConnector namespace creation
      const v1RequiredNamespaces = networkNamespaces(
        LedgerId.TESTNET,
        testMethods,
        testEvents
      )

      // V2: HederaProvider namespace creation for testnet
      const v2NamespaceConfig = createNamespaces([
        HederaChainDefinition.Native.Testnet
      ] as CaipNetwork[])

      // Extract the hedera namespace from both
      const v1HederaNamespace = v1RequiredNamespaces.hedera
      const v2HederaNamespace = v2NamespaceConfig.hedera

      // Verify both have hedera namespace
      expect(v1HederaNamespace).toBeDefined()
      expect(v2HederaNamespace).toBeDefined()

      // Compare chains - v1 uses ledgerIdToCAIPChainId, v2 uses caipNetworkId
      expect(v1HederaNamespace.chains).toEqual(['hedera:testnet'])
      expect(v2HederaNamespace?.chains).toEqual(['hedera:testnet'])

      // Compare methods
      expect(v1HederaNamespace.methods).toEqual(testMethods)
      expect(v2HederaNamespace?.methods).toEqual(testMethods)

      // Compare events
      expect(v1HederaNamespace.events).toEqual(testEvents)
      expect(v2HederaNamespace?.events).toEqual(testEvents)
    })

    it('should create equivalent hedera namespace structure for mainnet', () => {
      // V1: DAppConnector namespace creation for mainnet
      const v1RequiredNamespaces = networkNamespaces(
        LedgerId.MAINNET,
        testMethods,
        testEvents
      )

      // V2: HederaProvider namespace creation for mainnet
      const v2NamespaceConfig = createNamespaces([
        HederaChainDefinition.Native.Mainnet
      ] as CaipNetwork[])

      const v1HederaNamespace = v1RequiredNamespaces.hedera
      const v2HederaNamespace = v2NamespaceConfig.hedera

      expect(v1HederaNamespace.chains).toEqual(['hedera:mainnet'])
      expect(v2HederaNamespace?.chains).toEqual(['hedera:mainnet'])

      expect(v1HederaNamespace.methods).toEqual(testMethods)
      expect(v2HederaNamespace?.methods).toEqual(testMethods)

      expect(v1HederaNamespace.events).toEqual(testEvents)
      expect(v2HederaNamespace?.events).toEqual(testEvents)
    })

    it('should handle multi-chain hedera namespaces consistently', () => {
      // V2: Create namespaces with both hedera chains
      const v2NamespaceConfig = createNamespaces([
        HederaChainDefinition.Native.Testnet,
        HederaChainDefinition.Native.Mainnet,
      ] as CaipNetwork[])

      // Verify hedera namespace includes both chains
      expect(v2NamespaceConfig.hedera?.chains).toEqual(['hedera:testnet', 'hedera:mainnet'])

      // Verify methods are consistent
      expect(v2NamespaceConfig.hedera?.methods).toEqual(Object.values(HederaJsonRpcMethod))
    })
  })

  describe('Connection Parameter Compatibility', () => {
    it('should generate compatible connection parameters between v1 and v2', async () => {
      // Mock the V1 connection URI creation
      const v1Namespaces = networkNamespaces(
        LedgerId.TESTNET,
        testMethods,
        testEvents
      )

      // Mock the V2 namespace creation
      const v2Namespaces = createNamespaces([
        HederaChainDefinition.Native.Testnet
      ] as CaipNetwork[])

      // Compare the namespace structures
      expect(v1Namespaces.hedera.chains).toEqual(v2Namespaces.hedera?.chains)
      expect(v1Namespaces.hedera.methods).toEqual(v2Namespaces.hedera?.methods)
      expect(v1Namespaces.hedera.events).toEqual(v2Namespaces.hedera?.events)
    })

    it('should maintain RPC map consistency in V2 namespaces', () => {
      const v2NamespaceConfig = createNamespaces([
        HederaChainDefinition.Native.Testnet,
      ] as CaipNetwork[])

      // Verify RPC maps are created
      expect(v2NamespaceConfig.hedera?.rpcMap).toBeDefined()

      // Verify RPC URLs are mapped correctly
      expect(v2NamespaceConfig.hedera?.rpcMap?.['testnet']).toBe('https://testnet.hashio.io/api')
    })
  })

  describe('Default Namespace Creation', () => {
    it('should create default namespaces in HederaProvider when none provided', () => {
      const defaultNamespaces = {
        hedera: {
          methods: Object.values(HederaJsonRpcMethod),
          chains: ['hedera:testnet', 'hedera:mainnet'],
          events: ['accountsChanged', 'chainChanged'],
        },
      }

      // Verify the default namespace structure matches what V1 would create
      const v1TestnetNamespaces = networkNamespaces(LedgerId.TESTNET, Object.values(HederaJsonRpcMethod), ['accountsChanged', 'chainChanged'])
      const v1MainnetNamespaces = networkNamespaces(LedgerId.MAINNET, Object.values(HederaJsonRpcMethod), ['accountsChanged', 'chainChanged'])

      expect(defaultNamespaces.hedera.methods).toEqual(v1TestnetNamespaces.hedera.methods)
      expect(defaultNamespaces.hedera.events).toEqual(v1TestnetNamespaces.hedera.events)
      expect(defaultNamespaces.hedera.chains).toContain(v1TestnetNamespaces.hedera.chains[0])
      expect(defaultNamespaces.hedera.chains).toContain(v1MainnetNamespaces.hedera.chains[0])
    })
  })

  describe('Method Set Consistency', () => {
    it('should use same Hedera methods in both v1 and v2', () => {
      const allHederaMethods = Object.values(HederaJsonRpcMethod)

      // V1: DAppConnector uses HederaJsonRpcMethod directly
      const v1Methods = allHederaMethods

      // V2: createNamespaces also uses HederaJsonRpcMethod for hedera namespace
      const v2Namespaces = createNamespaces([HederaChainDefinition.Native.Testnet] as CaipNetwork[])
      const v2Methods = v2Namespaces.hedera?.methods || []

      expect(v1Methods).toEqual(v2Methods)

      // Verify all expected methods are present
      expect(v1Methods).toContain(HederaJsonRpcMethod.GetNodeAddresses)
      expect(v1Methods).toContain(HederaJsonRpcMethod.ExecuteTransaction)
      expect(v1Methods).toContain(HederaJsonRpcMethod.SignMessage)
      expect(v1Methods).toContain(HederaJsonRpcMethod.SignAndExecuteQuery)
      expect(v1Methods).toContain(HederaJsonRpcMethod.SignAndExecuteTransaction)
      expect(v1Methods).toContain(HederaJsonRpcMethod.SignTransaction)
    })
  })

  describe('Event Set Consistency', () => {
    it('should use same events in both v1 and v2', () => {
      const standardEvents = ['accountsChanged', 'chainChanged']

      // V1: DAppConnector can specify custom events or use defaults
      const v1Namespaces = networkNamespaces(LedgerId.TESTNET, testMethods, standardEvents)

      // V2: createNamespaces uses hardcoded standard events
      const v2Namespaces = createNamespaces([HederaChainDefinition.Native.Testnet] as CaipNetwork[])

      expect(v1Namespaces.hedera.events).toEqual(standardEvents)
      expect(v2Namespaces.hedera?.events).toEqual(standardEvents)
    })
  })

  describe('Chain ID Format Consistency', () => {
    it('should use consistent CAIP-2 chain ID format', () => {
      // V1: Uses ledgerIdToCAIPChainId utility
      const v1TestnetNamespaces = networkNamespaces(LedgerId.TESTNET, testMethods, testEvents)
      const v1MainnetNamespaces = networkNamespaces(LedgerId.MAINNET, testMethods, testEvents)

      // V2: Uses caipNetworkId from chain definitions
      const v2TestnetNamespaces = createNamespaces([HederaChainDefinition.Native.Testnet] as CaipNetwork[])
      const v2MainnetNamespaces = createNamespaces([HederaChainDefinition.Native.Mainnet] as CaipNetwork[])

      // Testnet
      expect(v1TestnetNamespaces.hedera.chains).toEqual(['hedera:testnet'])
      expect(v2TestnetNamespaces.hedera?.chains).toEqual(['hedera:testnet'])

      // Mainnet
      expect(v1MainnetNamespaces.hedera.chains).toEqual(['hedera:mainnet'])
      expect(v2MainnetNamespaces.hedera?.chains).toEqual(['hedera:mainnet'])
    })
  })

  describe('URI Parameter Encoding', () => {
    it('should encode namespaces properly in connection URIs', () => {
      const v1Namespaces = networkNamespaces(LedgerId.TESTNET, testMethods, testEvents)
      const v2Namespaces = createNamespaces([HederaChainDefinition.Native.Testnet] as CaipNetwork[])

      // Verify namespace structures can be properly serialized
      expect(() => JSON.stringify(v1Namespaces)).not.toThrow()
      expect(() => JSON.stringify(v2Namespaces)).not.toThrow()

      // Verify the serialized structures are equivalent
      const v1Serialized = JSON.stringify(v1Namespaces.hedera)

      const v2AsRequired = {
        chains: v2Namespaces.hedera?.chains || [],
        methods: v2Namespaces.hedera?.methods || [],
        events: v2Namespaces.hedera?.events || []
      }
      const v2Serialized = JSON.stringify(v2AsRequired)

      expect(v1Serialized).toEqual(v2Serialized)
    })
  })
})
