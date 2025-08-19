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
  HederaJsonRpcMethod 
} from '../../src'

// V2 imports
import { 
  createNamespaces, 
  HederaChainDefinition, 
  HederaProvider
} from '../../src'
import { HederaConnector } from '../../src/reown/connectors/HederaConnector'

import { dAppMetadata, projectId } from '../_helpers'

describe('Namespace Modes: Required vs Optional', () => {
  const testEvents = ['accountsChanged', 'chainChanged']
  const testMethods = Object.values(HederaJsonRpcMethod)

  describe('V1 Required Namespaces Behavior', () => {
    it('should create requiredNamespaces structure for DAppConnector', () => {
      const requiredNamespaces = networkNamespaces(
        LedgerId.TESTNET,
        testMethods,
        testEvents
      )

      // V1 always creates required namespaces
      expect(requiredNamespaces).toHaveProperty('hedera')
      expect(requiredNamespaces.hedera).toHaveProperty('chains')
      expect(requiredNamespaces.hedera).toHaveProperty('methods')
      expect(requiredNamespaces.hedera).toHaveProperty('events')

      // Verify structure matches ProposalTypes.RequiredNamespaces
      const hedera = requiredNamespaces.hedera
      expect(Array.isArray(hedera.chains)).toBe(true)
      expect(Array.isArray(hedera.methods)).toBe(true)
      expect(Array.isArray(hedera.events)).toBe(true)
    })

    it('should pass requiredNamespaces to WalletConnect connection', () => {
      const mockConnectURI = jest.fn().mockResolvedValue({
        uri: 'wc:test-uri',
        approval: jest.fn().mockResolvedValue({ topic: 'test-topic' })
      })

      // Mock the WalletConnect client
      const mockWalletConnectClient = {
        connect: mockConnectURI,
        session: { getAll: () => [] },
        on: jest.fn(),
        core: { 
          events: { on: jest.fn() },
          pairing: { events: { on: jest.fn() } }
        }
      }

      const connector = new (class extends Object {
        walletConnectClient = mockWalletConnectClient
        network = LedgerId.TESTNET
        supportedMethods = testMethods
        supportedEvents = testEvents
        logger = { debug: jest.fn() }

        async connectURI() {
          const requiredNamespaces = networkNamespaces(
            this.network,
            this.supportedMethods,
            this.supportedEvents,
          )

          return this.walletConnectClient.connect({
            requiredNamespaces,
          })
        }
      })()

      connector.connectURI()

      // Verify that connect was called with requiredNamespaces
      expect(mockConnectURI).toHaveBeenCalledWith({
        requiredNamespaces: {
          hedera: {
            chains: ['hedera:testnet'],
            methods: testMethods,
            events: testEvents,
          }
        }
      })
    })
  })

  describe('V2 Optional Namespaces Behavior', () => {
    it('should create optionalNamespaces structure for HederaConnector', () => {
      const namespaces = createNamespaces([
        HederaChainDefinition.Native.Testnet,
        HederaChainDefinition.EVM.Testnet
      ] as CaipNetwork[])

      // V2 creates namespace config that can be used as optional namespaces
      expect(namespaces).toHaveProperty('hedera')
      expect(namespaces).toHaveProperty('eip155')

      // Verify hedera namespace structure
      const hedera = namespaces.hedera
      expect(hedera).toHaveProperty('chains')
      expect(hedera).toHaveProperty('methods')
      expect(hedera).toHaveProperty('events')
      expect(hedera).toHaveProperty('rpcMap')

      // Verify eip155 namespace structure
      const eip155 = namespaces.eip155
      expect(eip155).toHaveProperty('chains')
      expect(eip155).toHaveProperty('methods')
      expect(eip155).toHaveProperty('events')
      expect(eip155).toHaveProperty('rpcMap')
    })

    it('should use optionalNamespaces in HederaConnector.connectWalletConnect', async () => {
      const mockProvider = {
        connect: jest.fn().mockResolvedValue({}),
        session: null,
        client: { core: { crypto: { getClientId: jest.fn().mockResolvedValue('test-client-id') } } }
      }

      const caipNetworks = [
        HederaChainDefinition.Native.Testnet,
        HederaChainDefinition.EVM.Testnet
      ] as CaipNetwork[]

      const connector = new HederaConnector({
        provider: mockProvider as any,
        caipNetworks,
        namespace: 'hedera'
      })

      // Mock authenticate to return false so it goes through the connection flow
      connector.authenticate = jest.fn().mockResolvedValue(false)

      await connector.connectWalletConnect()

      // Verify that connect was called with optionalNamespaces
      expect(mockProvider.connect).toHaveBeenCalledWith({
        optionalNamespaces: expect.objectContaining({
          hedera: expect.objectContaining({
            chains: ['hedera:testnet'],
            methods: testMethods,
            events: testEvents,
            rpcMap: expect.any(Object)
          }),
          eip155: expect.objectContaining({
            chains: ['eip155:296'],
            methods: expect.any(Array),
            events: testEvents,
            rpcMap: expect.any(Object)
          })
        })
      })
    })

    it('should create default requiredNamespaces in HederaProvider when none provided', async () => {
      const mockConnect = jest.fn().mockResolvedValue({})
      
      // Create a mock that extends the actual HederaProvider structure
      const provider = new HederaProvider({
        projectId: 'test',
        logger: 'error'
      })

      // Mock the parent connect method
      const originalConnect = Object.getPrototypeOf(Object.getPrototypeOf(provider)).connect
      Object.getPrototypeOf(Object.getPrototypeOf(provider)).connect = mockConnect

      // Mock initProviders
      provider['initProviders'] = jest.fn()

      // Call connect without parameters - should create default namespaces
      await provider.connect()

      // Verify that connect was called with default requiredNamespaces
      expect(mockConnect).toHaveBeenCalledWith({
        requiredNamespaces: {
          hedera: {
            methods: Object.values(HederaJsonRpcMethod),
            chains: ['hedera:testnet', 'hedera:mainnet'],
            events: ['accountsChanged', 'chainChanged'],
          },
          eip155: {
            methods: [
              'eth_sendTransaction',
              'eth_signTransaction',
              'eth_sign',
              'personal_sign',
              'eth_signTypedData',
              'eth_signTypedData_v4',
              'eth_accounts',
              'eth_chainId',
            ],
            chains: ['eip155:296', 'eip155:295'],
            events: ['accountsChanged', 'chainChanged'],
          },
        },
      })

      // Restore original method
      Object.getPrototypeOf(Object.getPrototypeOf(provider)).connect = originalConnect
    })
  })

  describe('Namespace Conversion Between Modes', () => {
    it('should be able to convert V2 optionalNamespaces to V1 requiredNamespaces format', () => {
      const v2Namespaces = createNamespaces([
        HederaChainDefinition.Native.Testnet,
        HederaChainDefinition.EVM.Testnet
      ] as CaipNetwork[])

      // Convert V2 namespace config to ProposalTypes.RequiredNamespaces format
      const convertedToRequired: ProposalTypes.RequiredNamespaces = {}
      
      Object.entries(v2Namespaces).forEach(([namespace, config]) => {
        convertedToRequired[namespace] = {
          chains: config.chains || [],
          methods: config.methods || [],
          events: config.events || []
        }
      })

      // Verify the converted structure matches V1 format
      expect(convertedToRequired.hedera).toEqual({
        chains: ['hedera:testnet'],
        methods: testMethods,
        events: testEvents
      })

      expect(convertedToRequired.eip155).toEqual({
        chains: ['eip155:296'],
        methods: expect.any(Array),
        events: testEvents
      })
    })

    it('should be able to convert V1 requiredNamespaces to V2 optionalNamespaces format', () => {
      const v1RequiredNamespaces = networkNamespaces(
        LedgerId.TESTNET,
        testMethods,
        testEvents
      )

      // Convert V1 required namespaces to V2 namespace config format
      const convertedToOptional: any = {}
      
      Object.entries(v1RequiredNamespaces).forEach(([namespace, config]) => {
        convertedToOptional[namespace] = {
          chains: config.chains,
          methods: config.methods,
          events: config.events,
          rpcMap: {} // V2 includes rpcMap
        }
      })

      // Verify the converted structure matches V2 format
      expect(convertedToOptional.hedera).toEqual({
        chains: ['hedera:testnet'],
        methods: testMethods,
        events: testEvents,
        rpcMap: {}
      })
    })
  })

  describe('Connection Parameter Behavior', () => {
    it('should show difference between required and optional namespace usage', () => {
      // V1 approach: Always uses requiredNamespaces
      const v1ConnectionParams = {
        requiredNamespaces: networkNamespaces(LedgerId.TESTNET, testMethods, testEvents)
      }

      // V2 approach: Uses optionalNamespaces by default in HederaConnector
      const v2ConnectionParams = {
        optionalNamespaces: createNamespaces([HederaChainDefinition.Native.Testnet] as CaipNetwork[])
      }

      // Verify different parameter names are used
      expect(v1ConnectionParams).toHaveProperty('requiredNamespaces')
      expect(v1ConnectionParams).not.toHaveProperty('optionalNamespaces')

      expect(v2ConnectionParams).toHaveProperty('optionalNamespaces')
      expect(v2ConnectionParams).not.toHaveProperty('requiredNamespaces')

      // But the actual namespace content should be equivalent
      const v1Hedera = v1ConnectionParams.requiredNamespaces.hedera
      const v2Hedera = v2ConnectionParams.optionalNamespaces.hedera

      expect(v1Hedera.chains).toEqual(v2Hedera?.chains)
      expect(v1Hedera.methods).toEqual(v2Hedera?.methods)
      expect(v1Hedera.events).toEqual(v2Hedera?.events)
    })

    it('should handle mixed required and optional namespaces in V2', () => {
      // V2 can use both required and optional namespaces
      const requiredNamespaces = {
        hedera: {
          chains: ['hedera:testnet'],
          methods: testMethods.slice(0, 3), // Only some methods required
          events: testEvents
        }
      }

      const optionalNamespaces = createNamespaces([
        HederaChainDefinition.Native.Testnet,
        HederaChainDefinition.Native.Mainnet,
        HederaChainDefinition.EVM.Testnet
      ] as CaipNetwork[])

      const mixedConnectionParams = {
        requiredNamespaces,
        optionalNamespaces
      }

      // Verify both are present and properly structured
      expect(mixedConnectionParams.requiredNamespaces.hedera.methods).toHaveLength(3)
      expect(mixedConnectionParams.optionalNamespaces.hedera?.methods).toEqual(testMethods)
      expect(mixedConnectionParams.optionalNamespaces.hedera?.chains).toEqual(['hedera:testnet', 'hedera:mainnet'])
      expect(mixedConnectionParams.optionalNamespaces.eip155?.chains).toEqual(['eip155:296'])
    })
  })

  describe('URI Encoding Consistency', () => {
    it('should encode required and optional namespaces consistently in URIs', () => {
      const v1Params = {
        requiredNamespaces: networkNamespaces(LedgerId.TESTNET, testMethods, testEvents)
      }

      const v2Params = {
        optionalNamespaces: createNamespaces([HederaChainDefinition.Native.Testnet] as CaipNetwork[])
      }

      // Test serialization of both parameter sets
      expect(() => JSON.stringify(v1Params)).not.toThrow()
      expect(() => JSON.stringify(v2Params)).not.toThrow()

      // Extract and compare the hedera namespace content
      const v1HederaSerialized = JSON.stringify(v1Params.requiredNamespaces.hedera)
      
      const v2HederaAsRequired = {
        chains: v2Params.optionalNamespaces.hedera?.chains || [],
        methods: v2Params.optionalNamespaces.hedera?.methods || [],
        events: v2Params.optionalNamespaces.hedera?.events || []
      }
      const v2HederaSerialized = JSON.stringify(v2HederaAsRequired)

      expect(v1HederaSerialized).toEqual(v2HederaSerialized)
    })
  })
})