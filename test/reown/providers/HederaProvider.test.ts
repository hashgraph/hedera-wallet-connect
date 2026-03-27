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
import { BrowserProvider, JsonRpcSigner, Contract } from 'ethers'
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
import { CaipNetwork, SendTransactionArgs, WriteContractArgs } from '@reown/appkit'
import { TopicCreateTransaction } from '@hiero-ledger/sdk'

jest.mock('ethers')
jest.mock('@walletconnect/universal-provider')
jest.mock('../../../src/reown/providers/HIP820Provider')
jest.mock('../../../src/reown/providers/EIP155Provider')

describe('HederaProvider', () => {
  let provider: HederaProvider
  const mockRequest = jest.fn()
  const mockAddress = '0x9De4Efe3636E5578406f4a81d91A6Bb5EBa8828c'
  const mockTx = '0x1937a387400d5e3873fe6beb76969efe5166a9e2d5d5d1c8e4a8f59c8034d67b'
  const mockContractData = {
    fromAddress: '0x321',
    chainNamespace: 'eip155',
    tokenAddress: '0x1234',
    abi: ['function transfer()'],
    method: 'transfer',
    args: ['0x1', '100'],
  } as WriteContractArgs
  const mockInitProviders = jest.fn()
  const mockSession = {
    topic: requestTopic,
    namespaces: {
      hedera: {
        accounts: [`hedera:testnet:${testUserAccountId.toString()}`],
      },
      eip155: {
        accounts: [`eip155:296:${mockAddress}`],
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
      HederaChainDefinition.EVM.Testnet,
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

  describe('EVM Methods', () => {
    const mockTxHash = '0xc168ac969428eb39611aedb9d180963444ed196524509fc1c2c6f34e81480461'
    const mockSignature = '0xtestsig'
    const message = 'test'
    const mockData = {
      to: '0x...',
      value: BigInt(1),
      chainNamespace: 'eip155',
      address: mockAddress,
      data: '0x...',
    } as SendTransactionArgs

    it('should sign EVM messages', async () => {
      mockRequest.mockResolvedValue(mockSignature)

      const result = await provider.eth_signMessage(message, mockAddress)
      expect(result).toBe(mockSignature)
    })

    it('should send transactions', async () => {
      const mockWait = jest.fn().mockResolvedValue({ hash: mockTxHash })
      const mockSendTransaction = jest.fn().mockResolvedValue({ wait: mockWait })
      const mockSigner = { sendTransaction: mockSendTransaction }
      const mockGetSigner = jest.fn().mockReturnValue(mockSigner)

      jest.spyOn(BrowserProvider.prototype, 'getSigner').mockImplementation(mockGetSigner)
      jest
        .spyOn(JsonRpcSigner.prototype, 'sendTransaction')
        .mockImplementation(mockSendTransaction)

      const result = await provider.eth_sendTransaction(mockData, mockAddress, 296)
      expect(result).toBe(mockTxHash)
    })

    it('should estimate gas', async () => {
      const mockEstimate = BigInt(1000)
      jest.spyOn(JsonRpcSigner.prototype, 'estimateGas').mockResolvedValue(mockEstimate)

      const result = await provider.eth_estimateGas(mockData, mockAddress, 296)
      expect(result.toString()).toBe(mockEstimate.toString())
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
      expect(addresses).toEqual([testUserAccountId.toString(), mockAddress])
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid chain namespace', async () => {
      await expect(provider.eth_estimateGas({} as any, '0x...', 123)).rejects.toThrow(
        'chainNamespace is not eip155',
      )
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

  describe('Contract Interactions', () => {
    it('should write to contracts', async () => {
      ;(Contract as unknown as jest.Mock).mockImplementation(() => ({
        [mockContractData.method]: jest.fn().mockResolvedValue(mockTx),
      }))
      const result = await provider.eth_writeContract(mockContractData, '0x...', 296)
      expect(result).toBe(mockTx)
    })

    it('should handle missing methods', async () => {
      await expect(
        provider.eth_writeContract(
          { ...mockContractData, method: 'invalid' as any },
          '0x9De4Efe3636E5578406f4a81d91A6Bb5EBa8828c',
          296,
        ),
      ).rejects.toThrow('Contract method is undefined')
    })
  })
})
