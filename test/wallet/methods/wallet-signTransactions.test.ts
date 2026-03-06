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
  AccountId,
  TopicCreateTransaction,
  TransferTransaction,
  Hbar,
  PrivateKey,
} from '@hiero-ledger/sdk'
import { proto } from '@hiero-ledger/proto'
import {
  HederaChainId,
  HederaJsonRpcMethod,
  Wallet,
  transactionToTransactionBody,
  Uint8ArrayToBase64String,
} from '../../../src'
import {
  projectId,
  requestId,
  requestTopic,
  testPrivateKeyECDSA,
  testUserAccountId,
  walletMetadata,
} from '../../_helpers'

function makeSessionRequestEvent(
  method: string,
  params: Record<string, unknown> | undefined,
  chainId: HederaChainId = HederaChainId.Testnet,
  id: number = requestId,
  topic: string = requestTopic,
) {
  return {
    id,
    topic,
    params: { request: { method, params }, chainId },
  }
}

/** Encodes a TransferTransaction body with no nodeAccountID set, as per HIP-1190. */
function makeTransactionBodyBytes(): Uint8Array {
  const tx = new TransferTransaction()
    .setMaxTransactionFee(new Hbar(1))
    .addHbarTransfer('0.0.123', new Hbar(10))
    .addHbarTransfer('0.0.321', new Hbar(-10))
  const body = transactionToTransactionBody(tx, null)
  if (!body) throw new Error('Failed to build transaction body')
  return proto.TransactionBody.encode(body).finish()
}

/** Encodes a TransferTransaction body with nodeAccountID already set. */
function makeTransactionBodyBytesWithNode(nodeId: string = '0.0.3'): Uint8Array {
  const tx = new TransferTransaction()
    .setMaxTransactionFee(new Hbar(1))
    .addHbarTransfer('0.0.123', new Hbar(10))
    .addHbarTransfer('0.0.321', new Hbar(-10))
  const body = transactionToTransactionBody(tx, AccountId.fromString(nodeId))
  if (!body) throw new Error('Failed to build transaction body')
  return proto.TransactionBody.encode(body).finish()
}

describe(Wallet.name, () => {
  let wallet: Wallet

  beforeAll(async () => {
    wallet = await Wallet.create(projectId, walletMetadata)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('hedera_signTransactions', () => {
    describe('parseSessionRequest', () => {
      it('accepts hedera_signTransactions without throwing', () => {
        const event = makeSessionRequestEvent(HederaJsonRpcMethod.SignTransactions, {
          signerAccountId: `${HederaChainId.Testnet}:${testUserAccountId.toString()}`,
          transactionBody: Uint8ArrayToBase64String(makeTransactionBodyBytes()),
          nodeCount: 3,
        })

        expect(() => wallet.parseSessionRequest(event as any)).not.toThrow()
      })

      it('returns the correct method, id, topic, and accountId', () => {
        const event = makeSessionRequestEvent(HederaJsonRpcMethod.SignTransactions, {
          signerAccountId: `${HederaChainId.Testnet}:${testUserAccountId.toString()}`,
          transactionBody: Uint8ArrayToBase64String(makeTransactionBodyBytes()),
          nodeCount: 2,
        })

        const result = wallet.parseSessionRequest(event as any)

        expect(result.method).toBe(HederaJsonRpcMethod.SignTransactions)
        expect(result.id).toBe(requestId)
        expect(result.topic).toBe(requestTopic)
        expect(result.accountId?.toString()).toBe(testUserAccountId.toString())
      })

      it('attaches nodeCount to the body buffer', () => {
        const event = makeSessionRequestEvent(HederaJsonRpcMethod.SignTransactions, {
          signerAccountId: `${HederaChainId.Testnet}:${testUserAccountId.toString()}`,
          transactionBody: Uint8ArrayToBase64String(makeTransactionBodyBytes()),
          nodeCount: 7,
        })

        const { body } = wallet.parseSessionRequest(event as any)

        expect((body as any).__nodeCount).toBe(7)
      })

      it('defaults nodeCount to 5 when not provided', () => {
        const event = makeSessionRequestEvent(HederaJsonRpcMethod.SignTransactions, {
          signerAccountId: `${HederaChainId.Testnet}:${testUserAccountId.toString()}`,
          transactionBody: Uint8ArrayToBase64String(makeTransactionBodyBytes()),
        })

        const { body } = wallet.parseSessionRequest(event as any)

        expect((body as any).__nodeCount).toBe(5)
      })

      it('throws when signerAccountId is missing', () => {
        const event = makeSessionRequestEvent(HederaJsonRpcMethod.SignTransactions, {
          transactionBody: Uint8ArrayToBase64String(makeTransactionBodyBytes()),
        })

        expect(() => wallet.parseSessionRequest(event as any)).toThrow()
      })

      it('throws when transactionBody is missing', () => {
        const event = makeSessionRequestEvent(HederaJsonRpcMethod.SignTransactions, {
          signerAccountId: `${HederaChainId.Testnet}:${testUserAccountId.toString()}`,
        })

        expect(() => wallet.parseSessionRequest(event as any)).toThrow()
      })

      it('throws when nodeCount is provided but is not a number', () => {
        const event = makeSessionRequestEvent(HederaJsonRpcMethod.SignTransactions, {
          signerAccountId: `${HederaChainId.Testnet}:${testUserAccountId.toString()}`,
          transactionBody: Uint8ArrayToBase64String(makeTransactionBodyBytes()),
          nodeCount: 'not-a-number',
        })

        expect(() => wallet.parseSessionRequest(event as any)).toThrow()
      })
    })

    describe('executeSessionRequest', () => {
      it('routes to the handler with the nodeCount from the event params', async () => {
        const nodeCount = 4
        const event = makeSessionRequestEvent(HederaJsonRpcMethod.SignTransactions, {
          signerAccountId: `${HederaChainId.Testnet}:${testUserAccountId.toString()}`,
          transactionBody: Uint8ArrayToBase64String(makeTransactionBodyBytes()),
          nodeCount,
        })
        const hederaWallet = wallet.getHederaWallet(
          HederaChainId.Testnet,
          testUserAccountId.toString(),
          testPrivateKeyECDSA,
        )
        const handlerSpy = jest
          .spyOn(wallet, 'hedera_signTransactions')
          .mockResolvedValue(undefined)

        await wallet.executeSessionRequest(event as any, hederaWallet)

        expect(handlerSpy).toHaveBeenCalledWith(
          requestId,
          requestTopic,
          expect.any(Buffer),
          hederaWallet,
          nodeCount,
        )
      })

      it('defaults to nodeCount 5 when not specified in the event', async () => {
        const event = makeSessionRequestEvent(HederaJsonRpcMethod.SignTransactions, {
          signerAccountId: `${HederaChainId.Testnet}:${testUserAccountId.toString()}`,
          transactionBody: Uint8ArrayToBase64String(makeTransactionBodyBytes()),
        })
        const hederaWallet = wallet.getHederaWallet(
          HederaChainId.Testnet,
          testUserAccountId.toString(),
          testPrivateKeyECDSA,
        )
        const handlerSpy = jest
          .spyOn(wallet, 'hedera_signTransactions')
          .mockResolvedValue(undefined)

        await wallet.executeSessionRequest(event as any, hederaWallet)

        expect(handlerSpy).toHaveBeenCalledWith(
          requestId,
          requestTopic,
          expect.any(Buffer),
          hederaWallet,
          5,
        )
      })
    })

    describe('handler', () => {
      it('should return signatureMaps and nodeAccountIds for each requested node', async () => {
        const hederaWallet = wallet.getHederaWallet(
          HederaChainId.Testnet,
          testUserAccountId.toString(),
          testPrivateKeyECDSA,
        )
        jest.spyOn(hederaWallet, 'getNetwork').mockReturnValue({
          'node3:50211': AccountId.fromString('0.0.3'),
          'node4:50211': AccountId.fromString('0.0.4'),
          'node5:50211': AccountId.fromString('0.0.5'),
        } as any)
        // Use a real PrivateKey so the returned publicKey carries _toProtobufSignature
        const signingKey = PrivateKey.generateED25519()
        jest.spyOn(hederaWallet, 'sign').mockImplementation(async (messages) => [
          { publicKey: signingKey.publicKey, signature: signingKey.sign(messages[0]) },
        ] as any)
        const respondSpy = jest
          .spyOn(wallet, 'respondSessionRequest')
          .mockResolvedValue(undefined as any)

        await wallet.hedera_signTransactions(
          requestId,
          requestTopic,
          makeTransactionBodyBytes(),
          hederaWallet,
          3,
        )

        expect(respondSpy).toHaveBeenCalledTimes(1)
        const { response, topic } = respondSpy.mock.calls[0][0] as any
        expect(topic).toBe(requestTopic)
        expect(response.id).toBe(requestId)
        expect(response.jsonrpc).toBe('2.0')
        expect(response.result.signatureMaps).toHaveLength(3)
        expect(response.result.nodeAccountIds).toHaveLength(3)
        expect(response.error).toBeUndefined()
      })

      it('should return each nodeAccountId in shard.realm.num format', async () => {
        const hederaWallet = wallet.getHederaWallet(
          HederaChainId.Testnet,
          testUserAccountId.toString(),
          testPrivateKeyECDSA,
        )
        jest.spyOn(hederaWallet, 'getNetwork').mockReturnValue({
          'node3:50211': AccountId.fromString('0.0.3'),
          'node4:50211': AccountId.fromString('0.0.4'),
        } as any)
        const signingKey = PrivateKey.generateED25519()
        jest.spyOn(hederaWallet, 'sign').mockImplementation(async (messages) => [
          { publicKey: signingKey.publicKey, signature: signingKey.sign(messages[0]) },
        ] as any)
        const respondSpy = jest
          .spyOn(wallet, 'respondSessionRequest')
          .mockResolvedValue(undefined as any)

        await wallet.hedera_signTransactions(
          requestId,
          requestTopic,
          makeTransactionBodyBytes(),
          hederaWallet,
          2,
        )

        const { nodeAccountIds } = (respondSpy.mock.calls[0][0] as any).response.result
        nodeAccountIds.forEach((id: string) => {
          expect(id).toMatch(/^\d+\.\d+\.\d+$/)
        })
      })

      it('should return signatureMaps as non-empty base64 strings', async () => {
        const hederaWallet = wallet.getHederaWallet(
          HederaChainId.Testnet,
          testUserAccountId.toString(),
          testPrivateKeyECDSA,
        )
        jest.spyOn(hederaWallet, 'getNetwork').mockReturnValue({
          'node3:50211': AccountId.fromString('0.0.3'),
        } as any)
        const signingKey = PrivateKey.generateED25519()
        jest.spyOn(hederaWallet, 'sign').mockImplementation(async (messages) => [
          { publicKey: signingKey.publicKey, signature: signingKey.sign(messages[0]) },
        ] as any)
        const respondSpy = jest
          .spyOn(wallet, 'respondSessionRequest')
          .mockResolvedValue(undefined as any)

        await wallet.hedera_signTransactions(
          requestId,
          requestTopic,
          makeTransactionBodyBytes(),
          hederaWallet,
          1,
        )

        const { signatureMaps } = (respondSpy.mock.calls[0][0] as any).response.result
        signatureMaps.forEach((sigMap: string) => {
          expect(typeof sigMap).toBe('string')
          expect(sigMap.length).toBeGreaterThan(0)
          expect(() => Buffer.from(sigMap, 'base64')).not.toThrow()
        })
      })

      it('should reject a transaction body that already has nodeAccountID set', async () => {
        const hederaWallet = wallet.getHederaWallet(
          HederaChainId.Testnet,
          testUserAccountId.toString(),
          testPrivateKeyECDSA,
        )
        const respondSpy = jest
          .spyOn(wallet, 'respondSessionRequest')
          .mockResolvedValue(undefined as any)

        await wallet.hedera_signTransactions(
          requestId,
          requestTopic,
          makeTransactionBodyBytesWithNode('0.0.3'),
          hederaWallet,
          1,
        )

        const { error, result } = (respondSpy.mock.calls[0][0] as any).response
        expect(error).toBeDefined()
        expect(error.code).toBe(-32602)
        expect(error.message).toMatch(/nodeAccountId/)
        expect(result).toBeUndefined()
      })

      it('should return an error response for an undecodable transaction body', async () => {
        const hederaWallet = wallet.getHederaWallet(
          HederaChainId.Testnet,
          testUserAccountId.toString(),
          testPrivateKeyECDSA,
        )
        // Bytes that form an invalid protobuf varint
        const invalidBody = Buffer.from([
          0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
        ])
        const respondSpy = jest
          .spyOn(wallet, 'respondSessionRequest')
          .mockResolvedValue(undefined as any)

        await wallet.hedera_signTransactions(
          requestId,
          requestTopic,
          invalidBody,
          hederaWallet,
          1,
        )

        const { error } = (respondSpy.mock.calls[0][0] as any).response
        expect(error).toBeDefined()
        expect(error.code).toBe(-32602)
        expect(error.message).toMatch(/Failed to decode/)
      })

      it('should return an error response when fewer nodes are available than requested', async () => {
        const hederaWallet = wallet.getHederaWallet(
          HederaChainId.Testnet,
          testUserAccountId.toString(),
          testPrivateKeyECDSA,
        )
        jest.spyOn(hederaWallet, 'getNetwork').mockReturnValue({
          'node3:50211': AccountId.fromString('0.0.3'),
        } as any)
        const respondSpy = jest
          .spyOn(wallet, 'respondSessionRequest')
          .mockResolvedValue(undefined as any)

        // only 1 node available, requesting 10
        await wallet.hedera_signTransactions(
          requestId,
          requestTopic,
          makeTransactionBodyBytes(),
          hederaWallet,
          10,
        )

        const { error } = (respondSpy.mock.calls[0][0] as any).response
        expect(error).toBeDefined()
        expect(error.code).toBe(-32603)
        expect(error.message).toMatch(/Node selection failed/)
      })

      it('should return an error response when signing fails', async () => {
        const hederaWallet = wallet.getHederaWallet(
          HederaChainId.Testnet,
          testUserAccountId.toString(),
          testPrivateKeyECDSA,
        )
        jest.spyOn(hederaWallet, 'getNetwork').mockReturnValue({
          'node3:50211': AccountId.fromString('0.0.3'),
        } as any)
        jest.spyOn(hederaWallet, 'sign').mockRejectedValue(new Error('Key not available'))
        const respondSpy = jest
          .spyOn(wallet, 'respondSessionRequest')
          .mockResolvedValue(undefined as any)

        await wallet.hedera_signTransactions(
          requestId,
          requestTopic,
          makeTransactionBodyBytes(),
          hederaWallet,
          1,
        )

        const { error } = (respondSpy.mock.calls[0][0] as any).response
        expect(error).toBeDefined()
        expect(error.code).toBe(-32603)
        expect(error.message).toMatch(/Signing failed/)
      })

      it('should propagate nodeCount from event params through to the handler', async () => {
        const expectedNodeCount = 6
        const event = makeSessionRequestEvent(HederaJsonRpcMethod.SignTransactions, {
          signerAccountId: `${HederaChainId.Testnet}:${testUserAccountId.toString()}`,
          transactionBody: Uint8ArrayToBase64String(makeTransactionBodyBytes()),
          nodeCount: expectedNodeCount,
        })
        const hederaWallet = wallet.getHederaWallet(
          HederaChainId.Testnet,
          testUserAccountId.toString(),
          testPrivateKeyECDSA,
        )
        const handlerSpy = jest
          .spyOn(wallet, 'hedera_signTransactions')
          .mockResolvedValue(undefined)

        await wallet.executeSessionRequest(event as any, hederaWallet)

        expect(handlerSpy).toHaveBeenCalledWith(
          requestId,
          requestTopic,
          expect.any(Buffer),
          hederaWallet,
          expectedNodeCount,
        )
      })

      it('should work with a TopicCreateTransaction body', async () => {
        const hederaWallet = wallet.getHederaWallet(
          HederaChainId.Testnet,
          testUserAccountId.toString(),
          testPrivateKeyECDSA,
        )
        jest.spyOn(hederaWallet, 'getNetwork').mockReturnValue({
          'node3:50211': AccountId.fromString('0.0.3'),
        } as any)
        const signingKey = PrivateKey.generateED25519()
        jest.spyOn(hederaWallet, 'sign').mockImplementation(async (messages) => [
          { publicKey: signingKey.publicKey, signature: signingKey.sign(messages[0]) },
        ] as any)
        const respondSpy = jest
          .spyOn(wallet, 'respondSessionRequest')
          .mockResolvedValue(undefined as any)

        const tx = new TopicCreateTransaction().setTopicMemo('hip-1190-test')
        const body = transactionToTransactionBody(tx, null)
        if (!body) throw new Error('Failed to build body')
        const bodyBytes = proto.TransactionBody.encode(body).finish()

        await wallet.hedera_signTransactions(requestId, requestTopic, bodyBytes, hederaWallet, 1)

        const { result } = (respondSpy.mock.calls[0][0] as any).response
        expect(result.signatureMaps).toHaveLength(1)
        expect(result.nodeAccountIds).toHaveLength(1)
      })
    })
  })
})
