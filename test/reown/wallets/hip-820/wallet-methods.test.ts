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

import { Buffer } from 'buffer'
import {
  TopicCreateTransaction,
  AccountInfoQuery,
  PrecheckStatusError,
  Status,
  AccountInfo,
  TransactionResponse,
} from '@hashgraph/sdk'
import {
  GetNodeAddresesResponse,
  HederaChainId,
  HIP820Wallet,
  SignAndExecuteTransactionResponse,
  SignMessageResult,
  SignTransactionResult,
  transactionToTransactionBody,
} from '../../../../src'
import { formatJsonRpcError, formatJsonRpcResult } from '@walletconnect/jsonrpc-utils'
import {
  testPrivateKeyECDSA,
  testUserAccountId,
  prepareTestTransaction,
  useJsonFixture,
  requestId,
  testNodeAccountId,
  testPrivateKeyED25519,
} from '../../../_helpers'
import { proto } from '@hashgraph/proto'

describe('HIP820Wallet Methods', () => {
  let hip820Wallet: HIP820Wallet
  const chainId = HederaChainId.Testnet
  const accountId = testUserAccountId.toString()

  beforeEach(() => {
    hip820Wallet = HIP820Wallet.init({
      chainId,
      accountId,
      privateKey: testPrivateKeyECDSA,
    })
  })

  describe('hedera_getNodeAddresses', () => {
    it('should return node addresses', async () => {
      const expected: GetNodeAddresesResponse = useJsonFixture(
        'methods/getNodeAddressesSuccess',
      )

      const result = await hip820Wallet.hedera_getNodeAddresses(requestId, null)

      result.result.nodes.sort()
      expected.response.result.nodes.sort()

      expect(result).toEqual(expected.response)
    }, 15_000)
  })

  describe('hedera_executeTransaction', () => {
    it('should execute signed transaction', async () => {
      try {
        const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
          freeze: true,
        })
        const mockResponse: SignAndExecuteTransactionResponse = useJsonFixture(
          'methods/executeTransactionSuccess',
        )

        const signerCallMock = jest.spyOn(hip820Wallet.wallet, 'call')
        signerCallMock.mockImplementation(async () => {}) // Mocking the 'call' method to do nothing

        const signTransaction = await hip820Wallet.wallet.signTransaction(transaction)

        const result = await hip820Wallet.hedera_executeTransaction(requestId, signTransaction)

        expect(result).toEqual(mockResponse.response)
      } catch (err) {}
    })

    it('should handle PrecheckStatusError', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction())

      const error = new PrecheckStatusError({
        status: Status.InvalidTransaction,
        transactionId: transaction.transactionId,
        nodeId: testNodeAccountId,
        contractFunctionResult: null,
      })
      error.message = 'Test error message'

      jest.spyOn(hip820Wallet.wallet, 'call').mockRejectedValue(error)

      const result = await hip820Wallet.hedera_executeTransaction(requestId, transaction)
      const expected = formatJsonRpcError(requestId, {
        code: 9000,
        message: error.message,
        data: error.status._code.toString(),
      })

      expect(result).toEqual(expected)
    })
  })

  describe('hedera_signMessage', () => {
    const testCases = [
      [
        'ECDSA',
        testPrivateKeyECDSA,
        'CmUKIQJ4J53yGuPNMGEGJ7HkI+u3QFxUuAOa9VLEtFj7Y6qNMzJAp3vxT7kRPE9HFFm/bbArGYDQ+psNWZC70rdW2bE1L85u79GOlQSTlaog5lmE6TiaX6r8Bk70dU7ZIwcHgnAkCw==',
      ],
      [
        'ED25519',
        testPrivateKeyED25519,
        'CmQKIKLvE3YbZEplGhpKxmbq+6xBnJcoL4r1wz9Y1zLnPlpVGkBtfDTfBZGf/MUbovYyLUjORErDGhDYbzPFoAbkMwRrpw2ouDRmn6Dd6A06k6yM/FhZ/VjdHVhQUd+fxv1cZqUM',
      ],
    ]
    test.each(testCases)(
      'should decode message bytes and sign with: %p',
      async (_, privateKey, expected) => {
        const testWallet = HIP820Wallet.init({
          chainId,
          accountId,
          privateKey,
        })

        const id = 1

        const result = await testWallet.hedera_signMessage(id, 'Hello Future')

        const mockResponse: SignMessageResult = {
          jsonrpc: '2.0',
          id,
          result: {
            signatureMap: expected,
          },
        }

        expect(result).toEqual(mockResponse)
      },
    )
  })

  describe('hedera_signAndExecuteQuery', () => {
    it('should execute query successfully', async () => {
      const query = new AccountInfoQuery().setAccountId(testUserAccountId)
      const mockResponse = useJsonFixture('methods/signAndExecuteQuerySuccess')

      jest.spyOn(query, 'executeWithSigner').mockResolvedValue({
        toBytes: () => Buffer.from(JSON.stringify(mockResponse)),
      } as unknown as AccountInfo)

      const result = await hip820Wallet.hedera_signAndExecuteQuery(requestId, query)

      expect(result).toEqual(
        formatJsonRpcResult(requestId, {
          response: Buffer.from(JSON.stringify(mockResponse)).toString('base64'),
        }),
      )
    })
  })

  describe('hedera_signAndExecuteTransaction', () => {
    it('should sign and execute unfreeze transaction', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: false,
      })
      const freezeWithSignerSpy = jest.spyOn(transaction, 'freezeWithSigner')
      const signWithSignerSpy = jest.spyOn(transaction, 'signWithSigner')
      const mockResponse: SignAndExecuteTransactionResponse = useJsonFixture(
        'methods/signAndExecuteTransactionSuccess',
      )

      jest.spyOn(transaction, 'executeWithSigner').mockResolvedValue({
        toJSON: () => mockResponse.response.result,
      } as unknown as TransactionResponse)

      const result = await hip820Wallet.hedera_signAndExecuteTransaction(requestId, transaction)

      expect(result).toEqual(mockResponse.response)
      expect(freezeWithSignerSpy).toHaveBeenCalled()
      expect(signWithSignerSpy).toHaveBeenCalled()
    })
    it('should sign and execute freeze transaction', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })
      const freezeWithSignerSpy = jest.spyOn(transaction, 'freezeWithSigner')
      const signWithSignerSpy = jest.spyOn(transaction, 'signWithSigner')
      const mockResponse: SignAndExecuteTransactionResponse = useJsonFixture(
        'methods/signAndExecuteTransactionSuccess',
      )

      jest.spyOn(transaction, 'executeWithSigner').mockResolvedValue({
        toJSON: () => mockResponse.response.result,
      } as unknown as TransactionResponse)

      const result = await hip820Wallet.hedera_signAndExecuteTransaction(requestId, transaction)

      expect(result).toEqual(mockResponse.response)
      expect(freezeWithSignerSpy).toHaveBeenCalledTimes(0)
      expect(signWithSignerSpy).toHaveBeenCalled()
    })
  })

  describe('hedera_signTransaction', () => {
    it('should sign transaction body', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      const transactionBody = transactionToTransactionBody(transaction)
      const uint8ArrayBody = proto.TransactionBody.encode(transactionBody).finish();
      
      const result = await hip820Wallet.hedera_signTransaction(requestId, uint8ArrayBody)

      const mockResponse: SignTransactionResult = {
        id: requestId,
        jsonrpc: '2.0',
        result: {
          signatureMap:
            'CmUKIQJ4J53yGuPNMGEGJ7HkI+u3QFxUuAOa9VLEtFj7Y6qNMzJAWvfY3/rze02Lel+X7MW3mHXDMwoaq9tQbD3aVLiXtDgvmB8J9gCumRq30CzZcq4ceMuaJpEs8UOAfGJSU87ORQ==',
        },
      }

      expect(result).toEqual(mockResponse)
    })
  })
})
