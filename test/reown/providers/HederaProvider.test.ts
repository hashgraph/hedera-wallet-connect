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

import { UniversalProvider } from '@walletconnect/universal-provider'
import {
  createNamespaces,
  ExecuteTransactionParams,
  HederaChainDefinition,
  HederaJsonRpcMethod,
  HederaProvider,
  SignAndExecuteQueryParams,
  SignAndExecuteTransactionParams,
  SignMessageParams,
  SignTransactionParams,
} from '../../../src'
import {
  useJsonFixture,
  testUserAccountId,
  prepareTestTransaction,
  requestTopic,
} from '../../_helpers'
import { CaipNetwork } from '@reown/appkit'
import { TopicCreateTransaction } from '@hiero-ledger/sdk'

jest.mock('@walletconnect/universal-provider')
jest.mock('../../../src/reown/providers/HIP820Provider')

describe('HederaProvider', () => {
  let provider: HederaProvider
  const mockRequest = jest.fn()
  const mockInitProviders = jest.fn()
  const mockSession = {
    topic: requestTopic,
    namespaces: {
      hedera: {
        accounts: [`hedera:testnet:${testUserAccountId.toString()}`],
      },
    },
  } as any

  beforeEach(async () => {
    mockRequest.mockReset()
    provider = await HederaProvider.init({
      projectId: 'test',
      logger: 'error',
      session: mockSession,
    })
    provider.namespaces = createNamespaces([
      HederaChainDefinition.Native.Testnet,
    ] as CaipNetwork[])

    provider['initProviders'] = mockInitProviders
    provider.session = mockSession
    provider.request = mockRequest
    provider.client = {} as any
  })

  describe('Initialization', () => {
    it('should initialize with correct providers', async () => {
      expect(provider).toBeInstanceOf(HederaProvider)
      expect(UniversalProvider).toHaveBeenCalled()
    })
  })

  describe('Core Methods', () => {
    it('should handle Hedera requests', async () => {
      const mockNodes = useJsonFixture('methods/getNodeAddressesSuccess')
      mockRequest.mockResolvedValue(mockNodes)

      const result = await provider.hedera_getNodeAddresses()
      expect(result).toEqual(mockNodes)
      expect(mockRequest).toHaveBeenCalledWith({
        method: HederaJsonRpcMethod.GetNodeAddresses,
        params: undefined,
      })
    })

    it('should execute transactions', async () => {
      const txParams = {} as ExecuteTransactionParams
      const mockResponse = useJsonFixture('methods/executeTransactionSuccess')
      mockRequest.mockResolvedValue(mockResponse)

      const result = await provider.hedera_executeTransaction(txParams)
      expect(result).toEqual(mockResponse)
    })

    it('should sign and execute query', async () => {
      const txParams = {} as SignAndExecuteQueryParams
      const mockResponse = useJsonFixture('methods/signAndExecuteQuerySuccess')
      mockRequest.mockResolvedValue(mockResponse)

      const result = await provider.hedera_signAndExecuteQuery(txParams)
      expect(result).toEqual(mockResponse)
    })

    it('should sign and execute transaction', async () => {
      const txParams = {} as SignAndExecuteTransactionParams
      const mockResponse = useJsonFixture('methods/signAndExecuteTransactionSuccess')
      mockRequest.mockResolvedValue(mockResponse)

      const result = await provider.hedera_signAndExecuteTransaction(txParams)
      expect(result).toEqual(mockResponse)
    })

    it('should sign transaction', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })
      const mockResponse = useJsonFixture('methods/signAndExecuteTransactionSuccess')
      const signTransaction = jest.fn().mockResolvedValue(mockResponse)
      const requestAccounts = jest.fn().mockReturnValue([testUserAccountId.toString()])
      provider.nativeProvider = {
        requestAccounts,
        signTransaction,
      } as any

      const txParams = {
        signerAccountId: testUserAccountId.toString(),
        transactionBody: transaction,
      } as SignTransactionParams

      await provider.hedera_signTransaction(txParams)
      expect(requestAccounts).toHaveBeenCalled()
    })

    it('should sign messages', async () => {
      const params: SignMessageParams = {
        signerAccountId: testUserAccountId.toString(),
        message: 'Hello World',
      }
      const mockSig = { signatureMap: 'CmUKIQJ4J==' }
      mockRequest.mockResolvedValue(mockSig)

      const result = await provider.hedera_signMessage(params)
      expect(result.signatureMap).toBe(mockSig.signatureMap)
    })
  })

  describe('Session Management', () => {
    it('should pair correctly', async () => {
      const pairingTopic = 'test-topic'
      const session = await provider.pair(pairingTopic)
      expect(mockInitProviders).toHaveBeenCalled()
    })

    it('should get account addresses', () => {
      const addresses = provider.getAccountAddresses()
      expect(addresses).toEqual([testUserAccountId.toString()])
    })
  })

  describe('Blockchain Queries', () => {
    it('should get block number', async () => {
      const mockBlock = '0x1234'
      mockRequest.mockResolvedValue(mockBlock)

      const result = await provider.eth_blockNumber()
      expect(result).toBe(mockBlock)
    })

    it('should get transaction receipt', async () => {
      const mockReceipt = {
        blockHash: '0x...',
        status: '0x1',
      }
      mockRequest.mockResolvedValue(mockReceipt)

      const result = await provider.eth_getTransactionReceipt('0x...')
      expect(result).toEqual(mockReceipt)
    })
  })
})
