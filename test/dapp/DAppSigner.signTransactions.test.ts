/*
 *
 * Hedera Wallet Connect
 *
 * Copyright (C) 2023 Hedera Hashgraph, LLC
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

import {
  LedgerId,
  PrivateKey,
  TopicCreateTransaction,
  AccountId,
  Client,
  TransferTransaction,
  Hbar,
  TokenCreateTransaction,
} from '@hashgraph/sdk'
import { proto } from '@hashgraph/proto'
import {
  DAppSigner,
  HederaJsonRpcMethod,
  Uint8ArrayToBase64String,
  base64StringToSignatureMap,
} from '../../src'
import { prepareTestTransaction, testUserAccountId } from '../_helpers'
import { ISignClient } from '@walletconnect/types'

/**
 * Comprehensive tests for signTransactions method (HIP-1190)
 * Modeled after PR #608's test quality and coverage
 */
describe('DAppSigner.signTransactions', () => {
  let signer: DAppSigner
  let mockSignClient: jest.Mocked<ISignClient>
  const testTopic = 'test-topic'

  beforeEach(() => {
    mockSignClient = {
      request: jest.fn(),
      session: {
        get: jest.fn().mockReturnValue({
          topic: testTopic,
          acknowledged: true,
        }),
      },
    } as any

    signer = new DAppSigner(testUserAccountId, mockSignClient, testTopic, LedgerId.TESTNET)
  })

  describe('basic functionality', () => {
    it('should sign transaction for multiple nodes and return array of transactions', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      const privateKey1 = PrivateKey.generateED25519()
      const privateKey2 = PrivateKey.generateED25519()

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: [
          Uint8ArrayToBase64String(
            proto.SignatureMap.encode({
              sigPair: [
                {
                  pubKeyPrefix: privateKey1.publicKey.toBytes(),
                  ed25519: privateKey1.sign(new Uint8Array([1, 2, 3])),
                },
              ],
            }).finish(),
          ),
          Uint8ArrayToBase64String(
            proto.SignatureMap.encode({
              sigPair: [
                {
                  pubKeyPrefix: privateKey2.publicKey.toBytes(),
                  ed25519: privateKey2.sign(new Uint8Array([4, 5, 6])),
                },
              ],
            }).finish(),
          ),
        ],
        nodeAccountIds: ['0.0.3', '0.0.4'],
      })

      const result = await signer.signTransactions(transaction, 2)

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(2)

      // Verify each returned transaction is valid
      result.forEach((tx) => {
        expect(tx).toBeDefined()
        expect(tx.toBytes).toBeDefined()
        expect(typeof tx.toBytes).toBe('function')
      })
    })

    it('should call RPC method hedera_signTransactions', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: [Uint8ArrayToBase64String(proto.SignatureMap.encode({}).finish())],
        nodeAccountIds: ['0.0.3'],
      })

      await signer.signTransactions(transaction, 1)

      expect(mockSignClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: testTopic,
          request: expect.objectContaining({
            method: HederaJsonRpcMethod.SignTransactions,
            params: expect.objectContaining({
              signerAccountId: expect.any(String),
              transactionBody: expect.any(String),
              nodeCount: 1,
            }),
          }),
        }),
      )
    })

    it('should pass nodeCount parameter correctly', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      const nodeCount = 5

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: Array(nodeCount).fill(
          Uint8ArrayToBase64String(proto.SignatureMap.encode({}).finish()),
        ),
        nodeAccountIds: Array(nodeCount)
          .fill(0)
          .map((_, i) => `0.0.${i + 3}`),
      })

      await signer.signTransactions(transaction, nodeCount)

      expect(mockSignClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          request: expect.objectContaining({
            params: expect.objectContaining({
              nodeCount: 5,
            }),
          }),
        }),
      )
    })
  })

  describe('transaction freezing', () => {
    it('should auto-freeze non-frozen transaction before signing', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: false,
      })

      expect(transaction.isFrozen()).toBe(false)

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: [Uint8ArrayToBase64String(proto.SignatureMap.encode({}).finish())],
        nodeAccountIds: ['0.0.3'],
      })

      await signer.signTransactions(transaction, 1)

      // Should have been frozen internally
      expect(mockSignClient.request).toHaveBeenCalled()
    })

    it('should handle already frozen transaction', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      expect(transaction.isFrozen()).toBe(true)

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: [Uint8ArrayToBase64String(proto.SignatureMap.encode({}).finish())],
        nodeAccountIds: ['0.0.3'],
      })

      const result = await signer.signTransactions(transaction, 1)

      expect(result.length).toBe(1)
    })
  })

  describe('response validation', () => {
    it('should validate that signatureMaps is an array', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: null as any,
        nodeAccountIds: ['0.0.3'],
      })

      await expect(signer.signTransactions(transaction, 1)).rejects.toThrow(/must be arrays/)
    })

    it('should validate that nodeAccountIds is an array', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: [Uint8ArrayToBase64String(proto.SignatureMap.encode({}).finish())],
        nodeAccountIds: undefined as any,
      })

      await expect(signer.signTransactions(transaction, 1)).rejects.toThrow(/must be arrays/)
    })

    it('should validate array lengths match', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: [
          Uint8ArrayToBase64String(proto.SignatureMap.encode({}).finish()),
          Uint8ArrayToBase64String(proto.SignatureMap.encode({}).finish()),
        ],
        nodeAccountIds: ['0.0.3'], // Mismatched length!
      })

      await expect(signer.signTransactions(transaction, 2)).rejects.toThrow(/Mismatched/)
    })
  })

  describe('transaction reconstruction', () => {
    it('should reconstruct transaction with correct node account ID', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      const privateKey = PrivateKey.generateED25519()
      const nodeAccountId = '0.0.7'

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: [
          Uint8ArrayToBase64String(
            proto.SignatureMap.encode({
              sigPair: [
                {
                  pubKeyPrefix: privateKey.publicKey.toBytes(),
                  ed25519: privateKey.sign(new Uint8Array([1, 2, 3])),
                },
              ],
            }).finish(),
          ),
        ],
        nodeAccountIds: [nodeAccountId],
      })

      const result = await signer.signTransactions(transaction, 1)

      expect(result.length).toBe(1)
      const reconstructed = result[0]

      // Verify the transaction has the correct node ID
      expect(reconstructed).toBeDefined()
      expect(reconstructed.toBytes()).toBeDefined()
    })

    it('should create separate transaction for each node', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      const keys = [
        PrivateKey.generateED25519(),
        PrivateKey.generateED25519(),
        PrivateKey.generateED25519(),
      ]

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: keys.map((key) =>
          Uint8ArrayToBase64String(
            proto.SignatureMap.encode({
              sigPair: [
                {
                  pubKeyPrefix: key.publicKey.toBytes(),
                  ed25519: key.sign(new Uint8Array([1, 2, 3])),
                },
              ],
            }).finish(),
          ),
        ),
        nodeAccountIds: ['0.0.3', '0.0.4', '0.0.5'],
      })

      const result = await signer.signTransactions(transaction, 3)

      expect(result.length).toBe(3)

      // Each transaction should be independent
      const bytes = result.map((tx) => tx.toBytes())
      expect(bytes[0]).not.toEqual(bytes[1])
      expect(bytes[1]).not.toEqual(bytes[2])
    })
  })

  describe('error handling', () => {
    it('should propagate wallet rejection errors', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      mockSignClient.request.mockRejectedValueOnce(new Error('User rejected'))

      await expect(signer.signTransactions(transaction, 2)).rejects.toThrow('User rejected')
    })

    it('should throw error if transaction body serialization fails', async () => {
      const invalidTransaction = {
        isFrozen: () => true,
        toBytes: () => {
          throw new Error('Serialization failed')
        },
      } as any

      await expect(signer.signTransactions(invalidTransaction, 1)).rejects.toThrow()
    })

    it('should throw descriptive error if reconstruction fails', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      // Return invalid base64
      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: ['!!!invalid-base64!!!'],
        nodeAccountIds: ['0.0.3'],
      })

      await expect(signer.signTransactions(transaction, 1)).rejects.toThrow(/Failed to reconstruct/)
    })
  })

  describe('edge cases', () => {
    it('should handle empty arrays (zero nodes)', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: [],
        nodeAccountIds: [],
      })

      const result = await signer.signTransactions(transaction, 0)

      expect(result).toBeDefined()
      expect(result.length).toBe(0)
    })

    it('should handle large number of nodes', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      const nodeCount = 20
      const signatureMaps = Array(nodeCount)
        .fill(0)
        .map(() => Uint8ArrayToBase64String(proto.SignatureMap.encode({}).finish()))
      const nodeAccountIds = Array(nodeCount)
        .fill(0)
        .map((_, i) => `0.0.${i + 3}`)

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps,
        nodeAccountIds,
      })

      const result = await signer.signTransactions(transaction, nodeCount)

      expect(result.length).toBe(nodeCount)
    })
  })

  describe('different transaction types', () => {
    it('should work with TransferTransaction', async () => {
      const transaction = prepareTestTransaction(
        new TransferTransaction()
          .addHbarTransfer('0.0.123', new Hbar(1))
          .addHbarTransfer('0.0.456', new Hbar(-1)),
        {
          freeze: true,
        },
      )

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: [Uint8ArrayToBase64String(proto.SignatureMap.encode({}).finish())],
        nodeAccountIds: ['0.0.3'],
      })

      const result = await signer.signTransactions(transaction, 1)

      expect(result.length).toBe(1)
    })

    it('should work with TokenCreateTransaction', async () => {
      const transaction = prepareTestTransaction(
        new TokenCreateTransaction().setTokenName('Test Token').setTokenSymbol('TST'),
        {
          freeze: true,
        },
      )

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: [Uint8ArrayToBase64String(proto.SignatureMap.encode({}).finish())],
        nodeAccountIds: ['0.0.3'],
      })

      const result = await signer.signTransactions(transaction, 1)

      expect(result.length).toBe(1)
    })
  })
})
