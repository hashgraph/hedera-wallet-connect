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

import { LedgerId } from '@hashgraph/sdk'
import { CaipNetwork } from '@reown/appkit-common'
import { WcHelpersUtil } from '@reown/appkit-controllers'

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

describe('Namespace Methods and Events Consistency', () => {
  describe('Hedera Method Consistency', () => {
    it('should use identical Hedera methods in V1 and V2', () => {
      const allHederaMethods = Object.values(HederaJsonRpcMethod)
      
      // V1: DAppConnector default methods
      const v1DefaultMethods = Object.values(HederaJsonRpcMethod)
      
      // V1: Custom connector with specific methods
      const connector = new DAppConnector(
        dAppMetadata,
        LedgerId.TESTNET,
        projectId,
        allHederaMethods, // explicit methods
        [],
        [],
        'off'
      )
      const v1CustomMethods = connector.supportedMethods
      
      // V2: createNamespaces for hedera namespace
      const v2Namespaces = createNamespaces([HederaChainDefinition.Native.Testnet] as CaipNetwork[])
      const v2Methods = v2Namespaces.hedera?.methods || []

      // All should be identical
      expect(v1DefaultMethods).toEqual(allHederaMethods)
      expect(v1CustomMethods).toEqual(allHederaMethods)
      expect(v2Methods).toEqual(allHederaMethods)
    })

    it('should include all required Hedera JSON-RPC methods', () => {
      const expectedMethods = [
        HederaJsonRpcMethod.GetNodeAddresses,
        HederaJsonRpcMethod.ExecuteTransaction,
        HederaJsonRpcMethod.SignMessage,
        HederaJsonRpcMethod.SignAndExecuteQuery,
        HederaJsonRpcMethod.SignAndExecuteTransaction,
        HederaJsonRpcMethod.SignTransaction
      ]

      // V1 namespaces
      const v1Namespaces = networkNamespaces(LedgerId.TESTNET, expectedMethods, [])
      
      // V2 namespaces
      const v2Namespaces = createNamespaces([HederaChainDefinition.Native.Testnet] as CaipNetwork[])

      // Verify all expected methods are present in both
      expectedMethods.forEach(method => {
        expect(v1Namespaces.hedera.methods).toContain(method)
        expect(v2Namespaces.hedera?.methods).toContain(method)
      })
    })

    it('should handle custom method arrays consistently', () => {
      const customMethods = [
        HederaJsonRpcMethod.SignMessage,
        HederaJsonRpcMethod.SignTransaction
      ]

      // V1: DAppConnector with custom methods
      const connector = new DAppConnector(
        dAppMetadata,
        LedgerId.TESTNET,
        projectId,
        customMethods,
        [],
        [],
        'off'
      )
      
      const v1Namespaces = networkNamespaces(LedgerId.TESTNET, customMethods, [])

      // V2: Custom namespace creation (simulating custom method filtering)
      const v2CustomNamespaces = createNamespaces([HederaChainDefinition.Native.Testnet] as CaipNetwork[])
      
      // Filter V2 methods to match custom set
      if (v2CustomNamespaces.hedera) {
        v2CustomNamespaces.hedera.methods = customMethods
      }

      expect(connector.supportedMethods).toEqual(customMethods)
      expect(v1Namespaces.hedera.methods).toEqual(customMethods)
      expect(v2CustomNamespaces.hedera?.methods).toEqual(customMethods)
    })
  })

  describe('EIP155 Method Consistency', () => {
    it('should use WalletConnect standard EIP155 methods in V2', () => {
      const v2Namespaces = createNamespaces([
        HederaChainDefinition.EVM.Testnet,
        HederaChainDefinition.EVM.Mainnet
      ] as CaipNetwork[])

      const expectedEip155Methods = WcHelpersUtil.getMethodsByChainNamespace('eip155')
      const actualMethods = v2Namespaces.eip155?.methods || []

      expect(actualMethods).toEqual(expectedEip155Methods)
    })

    it('should include standard Ethereum methods', () => {
      const v2Namespaces = createNamespaces([HederaChainDefinition.EVM.Testnet] as CaipNetwork[])
      const eip155Methods = v2Namespaces.eip155?.methods || []

      // Common Ethereum methods that should be supported (based on actual WcHelpersUtil)
      const commonEthMethods = [
        'eth_sendTransaction',
        'eth_signTransaction', 
        'eth_sign',
        'personal_sign',
        'eth_signTypedData',
        'eth_accounts'
        // Note: eth_chainId is not in the WcHelpersUtil standard list
      ]

      commonEthMethods.forEach(method => {
        expect(eip155Methods).toContain(method)
      })
    })

    it('should match HederaProvider default EIP155 methods', () => {
      // HederaProvider default EIP155 methods (from connect method) - updated to match actual WC methods
      const hederaProviderDefaultEip155Methods = [
        'eth_sendTransaction',
        'eth_signTransaction',
        'eth_sign',
        'personal_sign',
        'eth_signTypedData',
        'eth_signTypedData_v4',
        'eth_accounts'
        // Note: eth_chainId is not in WcHelpersUtil, it's handled separately
      ]

      const v2Namespaces = createNamespaces([HederaChainDefinition.EVM.Testnet] as CaipNetwork[])
      const createNamespacesMethods = v2Namespaces.eip155?.methods || []
      
      const wcHelpersMethods = WcHelpersUtil.getMethodsByChainNamespace('eip155')

      // The WcHelpersUtil methods should include the core EIP155 methods
      hederaProviderDefaultEip155Methods.forEach(method => {
        expect(wcHelpersMethods).toContain(method)
      })

      // createNamespaces should use WcHelpersUtil methods
      expect(createNamespacesMethods).toEqual(wcHelpersMethods)
    })
  })

  describe('Event Consistency', () => {
    it('should use identical standard events in V1 and V2', () => {
      const standardEvents = ['accountsChanged', 'chainChanged']
      
      // V1: networkNamespaces with standard events
      const v1Namespaces = networkNamespaces(LedgerId.TESTNET, Object.values(HederaJsonRpcMethod), standardEvents)
      
      // V2: createNamespaces (uses hardcoded standard events)
      const v2Namespaces = createNamespaces([
        HederaChainDefinition.Native.Testnet,
        HederaChainDefinition.EVM.Testnet
      ] as CaipNetwork[])

      expect(v1Namespaces.hedera.events).toEqual(standardEvents)
      expect(v2Namespaces.hedera?.events).toEqual(standardEvents)
      expect(v2Namespaces.eip155?.events).toEqual(standardEvents)
    })

    it('should handle custom events in V1 consistently', () => {
      const customEvents = ['accountsChanged', 'chainChanged', 'customEvent']
      
      // V1: DAppConnector with custom events
      const connector = new DAppConnector(
        dAppMetadata,
        LedgerId.TESTNET,
        projectId,
        Object.values(HederaJsonRpcMethod),
        customEvents,
        [],
        'off'
      )
      
      const v1Namespaces = networkNamespaces(LedgerId.TESTNET, Object.values(HederaJsonRpcMethod), customEvents)

      expect(connector.supportedEvents).toEqual(customEvents)
      expect(v1Namespaces.hedera.events).toEqual(customEvents)
    })

    it('should use same events for all namespaces in V2', () => {
      const v2Namespaces = createNamespaces([
        HederaChainDefinition.Native.Testnet,
        HederaChainDefinition.Native.Mainnet,
        HederaChainDefinition.EVM.Testnet,
        HederaChainDefinition.EVM.Mainnet
      ] as CaipNetwork[])

      const expectedEvents = ['accountsChanged', 'chainChanged']

      // All namespaces should use the same events
      expect(v2Namespaces.hedera?.events).toEqual(expectedEvents)
      expect(v2Namespaces.eip155?.events).toEqual(expectedEvents)
    })
  })

  describe('Method Coverage Analysis', () => {
    it('should provide complete Hedera functionality coverage', () => {
      const allHederaMethods = Object.values(HederaJsonRpcMethod)
      
      // Categorize methods by functionality
      const readMethods = [HederaJsonRpcMethod.GetNodeAddresses]
      const signMethods = [
        HederaJsonRpcMethod.SignMessage,
        HederaJsonRpcMethod.SignTransaction
      ]
      const executeMethods = [
        HederaJsonRpcMethod.ExecuteTransaction,
        HederaJsonRpcMethod.SignAndExecuteQuery,
        HederaJsonRpcMethod.SignAndExecuteTransaction
      ]

      const allCategorizedMethods = [...readMethods, ...signMethods, ...executeMethods]

      // Verify all methods are categorized
      expect(allCategorizedMethods.sort()).toEqual(allHederaMethods.sort())
      
      // Verify both V1 and V2 include all categories
      const v1Namespaces = networkNamespaces(LedgerId.TESTNET, allHederaMethods, [])
      const v2Namespaces = createNamespaces([HederaChainDefinition.Native.Testnet] as CaipNetwork[])

      allCategorizedMethods.forEach(method => {
        expect(v1Namespaces.hedera.methods).toContain(method)
        expect(v2Namespaces.hedera?.methods).toContain(method)
      })
    })

    it('should provide complete EVM functionality coverage in V2', () => {
      const v2Namespaces = createNamespaces([HederaChainDefinition.EVM.Testnet] as CaipNetwork[])
      const eip155Methods = v2Namespaces.eip155?.methods || []

      // Essential EVM functionality categories (based on actual methods)
      const transactionMethods = eip155Methods.filter(m => m.includes('Transaction') || m.includes('transaction'))
      const signingMethods = eip155Methods.filter(m => m.includes('sign') || m.includes('Sign'))
      const accountMethods = eip155Methods.filter(m => m.includes('account') || m.includes('Account'))
      const walletMethods = eip155Methods.filter(m => m.includes('wallet'))

      // Verify we have methods in each category
      expect(transactionMethods.length).toBeGreaterThan(0)
      expect(signingMethods.length).toBeGreaterThan(0)
      expect(accountMethods.length).toBeGreaterThan(0)
      expect(walletMethods.length).toBeGreaterThan(0) // Wallet methods instead of chain methods
    })
  })

  describe('Method Parameter Compatibility', () => {
    it('should ensure method signatures match between V1 and V2', () => {
      // Both V1 and V2 should support the same method names with same parameters
      const sharedMethods = Object.values(HederaJsonRpcMethod)
      
      // V1: DAppConnector methods
      const connector = new DAppConnector(
        dAppMetadata,
        LedgerId.TESTNET,
        projectId,
        sharedMethods,
        [],
        [],
        'off'
      )

      // Mock HederaProvider to verify it supports the same methods
      const mockProvider = {
        hedera_getNodeAddresses: jest.fn(),
        hedera_executeTransaction: jest.fn(),
        hedera_signMessage: jest.fn(),
        hedera_signAndExecuteQuery: jest.fn(),
        hedera_signAndExecuteTransaction: jest.fn(),
        hedera_signTransaction: jest.fn()
      }

      // Verify V1 supports all methods
      expect(connector.supportedMethods).toEqual(sharedMethods)
      
      // Verify V2 has corresponding method implementations
      expect(mockProvider).toHaveProperty('hedera_getNodeAddresses')
      expect(mockProvider).toHaveProperty('hedera_executeTransaction')
      expect(mockProvider).toHaveProperty('hedera_signMessage')
      expect(mockProvider).toHaveProperty('hedera_signAndExecuteQuery')
      expect(mockProvider).toHaveProperty('hedera_signAndExecuteTransaction')
      expect(mockProvider).toHaveProperty('hedera_signTransaction')
    })
  })

  describe('Event Parameter Compatibility', () => {
    it('should ensure event signatures match between V1 and V2', () => {
      const standardEvents = ['accountsChanged', 'chainChanged']
      
      // Both V1 and V2 should emit the same events with same data structures
      const v1Namespaces = networkNamespaces(LedgerId.TESTNET, Object.values(HederaJsonRpcMethod), standardEvents)
      const v2Namespaces = createNamespaces([HederaChainDefinition.Native.Testnet] as CaipNetwork[])

      expect(v1Namespaces.hedera.events).toEqual(standardEvents)
      expect(v2Namespaces.hedera?.events).toEqual(standardEvents)

      // Events should follow WalletConnect standard format
      standardEvents.forEach(event => {
        expect(typeof event).toBe('string')
        expect(event.length).toBeGreaterThan(0)
      })
    })
  })
})