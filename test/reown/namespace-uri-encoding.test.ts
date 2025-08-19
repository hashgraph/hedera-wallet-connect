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
import { ProposalTypes } from '@walletconnect/types'

// V1 imports
import { 
  networkNamespaces, 
  HederaJsonRpcMethod, 
  DAppConnector 
} from '../../src'

// V2 imports
import { 
  createNamespaces, 
  HederaChainDefinition
} from '../../src'
import { HederaConnector } from '../../src/reown/connectors/HederaConnector'

import { dAppMetadata, projectId } from '../_helpers'

describe('Namespace URI Parameter Encoding', () => {
  const testEvents = ['accountsChanged', 'chainChanged']
  const testMethods = Object.values(HederaJsonRpcMethod)

  describe('JSON Serialization Compatibility', () => {
    it('should serialize V1 requiredNamespaces without errors', () => {
      const v1Namespaces = networkNamespaces(
        LedgerId.TESTNET,
        testMethods,
        testEvents
      )

      const connectionParams = {
        pairingTopic: 'test-topic',
        requiredNamespaces: v1Namespaces
      }

      // Should serialize without throwing
      expect(() => JSON.stringify(connectionParams)).not.toThrow()
      
      // Verify serialized structure
      const serialized = JSON.stringify(connectionParams)
      const parsed = JSON.parse(serialized)
      
      expect(parsed.requiredNamespaces.hedera).toEqual(v1Namespaces.hedera)
    })

    it('should serialize V2 optionalNamespaces without errors', () => {
      const v2Namespaces = createNamespaces([
        HederaChainDefinition.Native.Testnet,
        HederaChainDefinition.EVM.Testnet
      ] as CaipNetwork[])

      const connectionParams = {
        pairingTopic: 'test-topic',
        optionalNamespaces: v2Namespaces
      }

      // Should serialize without throwing
      expect(() => JSON.stringify(connectionParams)).not.toThrow()
      
      // Verify serialized structure
      const serialized = JSON.stringify(connectionParams)
      const parsed = JSON.parse(serialized)
      
      expect(parsed.optionalNamespaces.hedera).toEqual(v2Namespaces.hedera)
      expect(parsed.optionalNamespaces.eip155).toEqual(v2Namespaces.eip155)
    })

    it('should handle special characters in namespace data', () => {
      const customMethods = [
        HederaJsonRpcMethod.SignMessage,
        'custom:method_with_special:characters'
      ]
      
      const customEvents = [
        'accountsChanged',
        'custom:event_with_special:characters'
      ]

      const v1Namespaces = networkNamespaces(
        LedgerId.TESTNET,
        customMethods,
        customEvents
      )

      // Should handle special characters in serialization
      expect(() => JSON.stringify(v1Namespaces)).not.toThrow()
      
      const serialized = JSON.stringify(v1Namespaces)
      const parsed = JSON.parse(serialized)
      
      expect(parsed.hedera.methods).toEqual(customMethods)
      expect(parsed.hedera.events).toEqual(customEvents)
    })
  })

  describe('URI Parameter Structure', () => {
    it('should create valid WalletConnect URI parameters for V1', () => {
      const v1Namespaces = networkNamespaces(
        LedgerId.TESTNET,
        testMethods,
        testEvents
      )

      // Simulate WalletConnect URI parameter creation
      const uriParams = new URLSearchParams()
      uriParams.set('requiredNamespaces', JSON.stringify(v1Namespaces))
      
      // Should create valid URI parameters
      expect(uriParams.get('requiredNamespaces')).toBeTruthy()
      
      // Should be able to parse back the namespace data
      const decodedNamespaces = JSON.parse(uriParams.get('requiredNamespaces')!)
      expect(decodedNamespaces.hedera).toEqual(v1Namespaces.hedera)
    })

    it('should create valid WalletConnect URI parameters for V2', () => {
      const v2Namespaces = createNamespaces([
        HederaChainDefinition.Native.Testnet
      ] as CaipNetwork[])

      // Simulate WalletConnect URI parameter creation
      const uriParams = new URLSearchParams()
      uriParams.set('optionalNamespaces', JSON.stringify(v2Namespaces))
      
      // Should create valid URI parameters
      expect(uriParams.get('optionalNamespaces')).toBeTruthy()
      
      // Should be able to parse back the namespace data
      const decodedNamespaces = JSON.parse(uriParams.get('optionalNamespaces')!)
      expect(decodedNamespaces.hedera).toEqual(v2Namespaces.hedera)
    })

    it('should handle URL encoding of namespace data', () => {
      const v1Namespaces = networkNamespaces(
        LedgerId.TESTNET,
        testMethods,
        testEvents
      )

      const jsonString = JSON.stringify(v1Namespaces)
      const encoded = encodeURIComponent(jsonString)
      const decoded = decodeURIComponent(encoded)
      const parsed = JSON.parse(decoded)

      expect(parsed.hedera).toEqual(v1Namespaces.hedera)
    })
  })

  describe('Cross-Version URI Compatibility', () => {
    it('should produce equivalent namespace content when encoded in URIs', () => {
      // V1 approach
      const v1Namespaces = networkNamespaces(
        LedgerId.TESTNET,
        testMethods,
        testEvents
      )
      
      // V2 approach
      const v2Namespaces = createNamespaces([
        HederaChainDefinition.Native.Testnet
      ] as CaipNetwork[])

      // Encode both in URI format
      const v1Encoded = encodeURIComponent(JSON.stringify(v1Namespaces))
      const v2Encoded = encodeURIComponent(JSON.stringify(v2Namespaces))

      // Decode and compare the hedera namespace content
      const v1Decoded = JSON.parse(decodeURIComponent(v1Encoded))
      const v2Decoded = JSON.parse(decodeURIComponent(v2Encoded))

      // Extract comparable content (excluding V2-specific fields like rpcMap)
      const v1HederaContent = {
        chains: v1Decoded.hedera.chains,
        methods: v1Decoded.hedera.methods,
        events: v1Decoded.hedera.events
      }

      const v2HederaContent = {
        chains: v2Decoded.hedera.chains,
        methods: v2Decoded.hedera.methods,
        events: v2Decoded.hedera.events
      }

      expect(v1HederaContent).toEqual(v2HederaContent)
    })

    it('should handle mixed namespace parameters in URIs', () => {
      const requiredNamespaces = networkNamespaces(
        LedgerId.TESTNET,
        testMethods.slice(0, 2), // Only first 2 methods required
        testEvents
      )

      const optionalNamespaces = createNamespaces([
        HederaChainDefinition.Native.Testnet,
        HederaChainDefinition.Native.Mainnet,
        HederaChainDefinition.EVM.Testnet
      ] as CaipNetwork[])

      const mixedParams = {
        requiredNamespaces,
        optionalNamespaces
      }

      // Should serialize mixed parameters
      expect(() => JSON.stringify(mixedParams)).not.toThrow()
      
      const encoded = encodeURIComponent(JSON.stringify(mixedParams))
      const decoded = JSON.parse(decodeURIComponent(encoded))

      expect(decoded.requiredNamespaces.hedera.methods).toHaveLength(2)
      expect(decoded.optionalNamespaces.hedera.methods).toEqual(testMethods)
    })
  })

  describe('Real-World URI Scenarios', () => {
    it('should handle DAppConnector connection URI creation', async () => {
      const connector = new DAppConnector(
        dAppMetadata,
        LedgerId.TESTNET,
        projectId,
        testMethods,
        testEvents,
        [],
        'off'
      )

      // Mock the WalletConnect client
      const mockConnect = jest.fn().mockResolvedValue({
        uri: 'wc:test@1?bridge=https%3A%2F%2Fbridge.walletconnect.org&key=test',
        approval: jest.fn()
      })

      connector.walletConnectClient = {
        connect: mockConnect
      } as any

      // Simulate connectURI call
      const privateConnectURI = connector['connectURI'].bind(connector)
      await privateConnectURI()

      // Verify connect was called with properly formatted namespaces
      expect(mockConnect).toHaveBeenCalledWith({
        requiredNamespaces: expect.objectContaining({
          hedera: expect.objectContaining({
            chains: ['hedera:testnet'],
            methods: testMethods,
            events: testEvents
          })
        })
      })
    })

    it('should handle HederaConnector connection URI creation', async () => {
      const mockProvider = {
        connect: jest.fn().mockResolvedValue({}),
        session: null,
        client: { core: { crypto: { getClientId: jest.fn().mockResolvedValue('test-id') } } }
      }

      const connector = new HederaConnector({
        provider: mockProvider as any,
        caipNetworks: [HederaChainDefinition.Native.Testnet] as CaipNetwork[],
        namespace: 'hedera'
      })

      // Mock authenticate to force connection flow
      connector.authenticate = jest.fn().mockResolvedValue(false)

      await connector.connectWalletConnect()

      // Verify connect was called with properly formatted optional namespaces
      expect(mockProvider.connect).toHaveBeenCalledWith({
        optionalNamespaces: expect.objectContaining({
          hedera: expect.objectContaining({
            chains: ['hedera:testnet'],
            methods: testMethods,
            events: testEvents,
            rpcMap: expect.any(Object)
          })
        })
      })
    })

    it('should create URIs that are wallet-compatible', () => {
      // Test that namespace structures conform to WalletConnect standards
      
      // V1 structure
      const v1Structure = networkNamespaces(LedgerId.TESTNET, testMethods, testEvents)
      
      // Verify V1 follows ProposalTypes.RequiredNamespaces format
      const validateRequiredNamespace = (ns: any) => {
        expect(ns).toHaveProperty('chains')
        expect(ns).toHaveProperty('methods')
        expect(ns).toHaveProperty('events')
        expect(Array.isArray(ns.chains)).toBe(true)
        expect(Array.isArray(ns.methods)).toBe(true)
        expect(Array.isArray(ns.events)).toBe(true)
      }

      validateRequiredNamespace(v1Structure.hedera)

      // V2 structure
      const v2Structure = createNamespaces([HederaChainDefinition.Native.Testnet] as CaipNetwork[])
      
      // Verify V2 follows NamespaceConfig format
      const validateNamespaceConfig = (ns: any) => {
        expect(ns).toHaveProperty('chains')
        expect(ns).toHaveProperty('methods')
        expect(ns).toHaveProperty('events')
        expect(ns).toHaveProperty('rpcMap')
        expect(Array.isArray(ns.chains)).toBe(true)
        expect(Array.isArray(ns.methods)).toBe(true)
        expect(Array.isArray(ns.events)).toBe(true)
        expect(typeof ns.rpcMap).toBe('object')
      }

      validateNamespaceConfig(v2Structure.hedera)
    })
  })

  describe('Error Handling in URI Encoding', () => {
    it('should handle malformed namespace data gracefully', () => {
      const malformedNamespaces = {
        hedera: {
          chains: null, // Invalid: should be array
          methods: testMethods,
          events: testEvents
        }
      }

      // Should not throw during serialization
      expect(() => JSON.stringify(malformedNamespaces)).not.toThrow()
      
      // But should be detectable after parsing
      const serialized = JSON.stringify(malformedNamespaces)
      const parsed = JSON.parse(serialized)
      
      expect(parsed.hedera.chains).toBeNull()
      expect(Array.isArray(parsed.hedera.chains)).toBe(false)
    })

    it('should handle empty namespace structures', () => {
      const emptyV1 = networkNamespaces(LedgerId.TESTNET, [], [])
      const emptyV2 = createNamespaces([] as CaipNetwork[])

      // Should serialize empty structures
      expect(() => JSON.stringify(emptyV1)).not.toThrow()
      expect(() => JSON.stringify(emptyV2)).not.toThrow()
      
      expect(emptyV1.hedera.methods).toEqual([])
      expect(emptyV1.hedera.events).toEqual([])
      expect(Object.keys(emptyV2)).toEqual([])
    })

    it('should preserve data integrity through encode/decode cycles', () => {
      const originalV1 = networkNamespaces(LedgerId.MAINNET, testMethods, testEvents)
      const originalV2 = createNamespaces([
        HederaChainDefinition.Native.Mainnet,
        HederaChainDefinition.EVM.Mainnet
      ] as CaipNetwork[])

      // Multiple encode/decode cycles
      let v1Data = originalV1
      let v2Data = originalV2

      for (let i = 0; i < 3; i++) {
        const v1Encoded = encodeURIComponent(JSON.stringify(v1Data))
        v1Data = JSON.parse(decodeURIComponent(v1Encoded))

        const v2Encoded = encodeURIComponent(JSON.stringify(v2Data))
        v2Data = JSON.parse(decodeURIComponent(v2Encoded))
      }

      // Data should remain identical
      expect(v1Data).toEqual(originalV1)
      expect(v2Data).toEqual(originalV2)
    })
  })
})