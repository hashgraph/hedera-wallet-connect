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
  AccountInfoQuery,
  LedgerId,
  TopicCreateTransaction,
  PublicKey,
  PrivateKey,
  Client,
} from '@hashgraph/sdk'
import {
  DAppConnector,
  ExecuteTransactionParams,
  HederaJsonRpcMethod,
  HederaSessionEvent,
  SignAndExecuteTransactionParams,
  SignMessageParams,
  SignAndExecuteQueryParams,
  SignTransactionParams,
  queryToBase64String,
  transactionToBase64String,
  DAppSigner,
  ledgerIdToCAIPChainId,
  base64StringToUint8Array,
  Uint8ArrayToBase64String,
  extractFirstSignature,
} from '../../src'
import {
  projectId,
  dAppMetadata,
  useJsonFixture,
  prepareTestTransaction,
  testUserAccountId,
} from '../_helpers'
import { SignClient } from '@walletconnect/sign-client'
import { ISignClient, SessionTypes } from '@walletconnect/types'
import { networkNamespaces } from '../../src/lib/shared'
import * as nacl from 'tweetnacl'
import { proto } from '@hashgraph/proto'

describe('DAppConnector', () => {
  let connector: DAppConnector
  let mockSignClient: SignClient
  const fakeSession = useJsonFixture('fakeSession') as SessionTypes.Struct
  const mockTopic = '1234567890abcdef'

  beforeEach(async () => {
    connector = new DAppConnector(
      dAppMetadata,
      LedgerId.TESTNET,
      projectId,
      Object.values(HederaJsonRpcMethod),
      [],
      [],
      'off',
    )
    mockSignClient = await SignClient.init({
      logger: 'error',
      relayUrl: 'wss://relay.walletconnect.com',
      projectId: projectId,
      metadata: dAppMetadata,
    })

    const mockSession = {
      ...fakeSession,
      topic: mockTopic,
      namespaces: {
        hedera: {
          accounts: [`hedera:testnet:${testUserAccountId.toString()}`],
          methods: Object.values(HederaJsonRpcMethod),
          events: [],
        },
      },
    }

    jest.spyOn(mockSignClient.session, 'get').mockReturnValue(mockSession)
  })

  afterEach(() => {
    global.gc && global.gc()
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create a valid class object', () => {
      const methods = ['hedera_testMethod', 'any_testMethod']
      const events = [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged]

      connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, methods, events)

      expect(connector.dAppMetadata).toBe(dAppMetadata)
      expect(connector.network).toBe(LedgerId.TESTNET)
      expect(connector.projectId).toBe(projectId)
      expect(connector.supportedMethods).toEqual(methods)
      expect(connector.supportedEvents).toEqual(events)
    })

    it('should create a valid class object without passing of methods and events', () => {
      connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId)

      expect(connector.dAppMetadata).toBe(dAppMetadata)
      expect(connector.network).toBe(LedgerId.TESTNET)
      expect(connector.projectId).toBe(projectId)
      expect(connector.supportedMethods).toEqual(Object.values(HederaJsonRpcMethod))
      expect(connector.supportedEvents).toEqual([])
    })
  })

  describe('init', () => {
    it('should init SignClient correctly', async () => {
      await connector.init({ logger: 'error' })

      expect(connector.walletConnectClient).toBeInstanceOf(SignClient)
      expect(connector.walletConnectClient?.metadata).toBe(dAppMetadata)
      expect(connector.walletConnectClient?.core.projectId).toBe(projectId)
      expect(connector.walletConnectClient?.core.relayUrl).toBe('wss://relay.walletconnect.com')
    })

    it('should create signers if there are persisted sessions', async () => {
      const mockInit = jest.spyOn(connector, 'init' as any)
      const mockSignClient = new SignClient({
        logger: 'error',
        relayUrl: 'wss://relay.walletconnect.com',
        projectId: projectId,
        metadata: dAppMetadata,
      })
      mockInit.mockImplementation(async () => {
        connector.signers = [
          new DAppSigner(
            testUserAccountId,
            mockSignClient,
            fakeSession.topic,
            LedgerId.TESTNET,
          ),
        ]
      })

      await connector.init({ logger: 'error' })

      expect(connector.signers.length).toBeGreaterThan(0)

      mockInit.mockRestore()
    })
  })

  describe('disconnect', () => {
    it('should disconnect Client from topic', async () => {
      connector.walletConnectClient = new SignClient({
        logger: 'error',
        relayUrl: 'wss://relay.walletconnect.com',
        projectId: projectId,
        metadata: dAppMetadata,
      })

      const walletConnectDisconnectSpy = jest.spyOn(
        connector.walletConnectClient as any,
        'disconnect',
      )
      walletConnectDisconnectSpy.mockImplementation(async () => {})

      connector.disconnect(fakeSession.topic)

      expect(walletConnectDisconnectSpy).toHaveBeenCalled()
      expect(walletConnectDisconnectSpy).toHaveBeenCalledTimes(1)
      expect(walletConnectDisconnectSpy).toHaveBeenCalledWith(
        expect.objectContaining({ topic: fakeSession.topic }),
      )

      walletConnectDisconnectSpy.mockRestore()
    })
  })

  describe('requests', () => {
    let lastSignerRequestMock: jest.SpyInstance
    // @ts-ignore
    let mockSignClient: SignClient

    beforeEach(async () => {
      mockSignClient = new SignClient({
        logger: 'error',
        relayUrl: 'wss://relay.walletconnect.com',
        projectId: projectId,
        metadata: dAppMetadata,
      })

      connector.signers = [
        new DAppSigner(
          testUserAccountId,
          mockSignClient,
          fakeSession.topic,
          LedgerId.TESTNET,
          'off',
        ),
      ]

      lastSignerRequestMock = jest.spyOn(connector.signers[0], 'request')
      lastSignerRequestMock.mockImplementation(() => {})
    })

    afterEach(() => {
      if (lastSignerRequestMock) {
        lastSignerRequestMock.mockRestore()
      }
    })

    describe('getNodeAddresses', () => {
      it('should throw an error if there is no active signer', async () => {
        connector.signers = []
        await expect(connector.getNodeAddresses()).rejects.toThrow(
          'There is no active session. Connect to the wallet at first.',
        )
      })

      it('should invoke last signer request with correct params', async () => {
        await connector.getNodeAddresses()
        expect(lastSignerRequestMock).toHaveBeenCalledWith({
          method: HederaJsonRpcMethod.GetNodeAddresses,
          params: undefined,
        })
      })
    })

    describe('signMessage', () => {
      const params: SignMessageParams = {
        message: 'test message',
        signerAccountId: `hedera:testnet:${testUserAccountId.toString()}`,
      }

      it('should throw an error if there are no signers', async () => {
        connector.signers = []
        await expect(connector.signMessage(params)).rejects.toThrow(
          'Signer not found for account ID: hedera:testnet:0.0.12345. Did you use the correct format? e.g hedera:<network>:<address>',
        )
      })

      it('should invoke last signer request with correct params', async () => {
        await connector.signMessage(params)
        expect(lastSignerRequestMock).toHaveBeenCalledWith({
          method: HederaJsonRpcMethod.SignMessage,
          params,
        })
      })
    })

    describe('executeTransaction', () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), { freeze: true })
      const params: ExecuteTransactionParams = {
        transactionList: transactionToBase64String(transaction),
      }

      it('should throw an error if there are no signers', async () => {
        connector.signers = []
        await expect(connector.executeTransaction(params)).rejects.toThrow(
          'There is no active session. Connect to the wallet at first.',
        )
      })

      it('should invoke last signer request with correct params', async () => {
        await connector.executeTransaction(params)
        expect(lastSignerRequestMock).toHaveBeenCalledWith({
          method: HederaJsonRpcMethod.ExecuteTransaction,
          params,
        })
      })
    })

    describe('signAndExecuteQuery', () => {
      const query = new AccountInfoQuery().setAccountId(testUserAccountId.toString())
      const params: SignAndExecuteQueryParams = {
        signerAccountId: testUserAccountId.toString(),
        query: queryToBase64String(query),
      }

      it('should throw an error if there is no any signer', async () => {
        connector.signers = []
        await expect(connector.signAndExecuteQuery(params)).rejects.toThrow(
          'Signer not found for account ID: 0.0.12345. Did you use the correct format? e.g hedera:<network>:<address>',
        )
      })

      it('should invoke last signer request with correct params', async () => {
        await connector.signAndExecuteQuery(params)
        expect(lastSignerRequestMock).toHaveBeenCalledWith({
          method: HederaJsonRpcMethod.SignAndExecuteQuery,
          params,
        })
      })
    })

    describe('signAndExecuteTransaction', () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), { freeze: true })
      const params: SignAndExecuteTransactionParams = {
        signerAccountId: testUserAccountId.toString(),
        transactionList: transactionToBase64String(transaction),
      }

      it('should throw an error if there is no any signer', async () => {
        connector.signers = []
        await expect(connector.signAndExecuteTransaction(params)).rejects.toThrow(
          'Signer not found for account ID: 0.0.12345. Did you use the correct format? e.g hedera:<network>:<address>',
        )
      })

      it('should invoke last signer request with correct params', async () => {
        await connector.signAndExecuteTransaction(params)
        expect(lastSignerRequestMock).toHaveBeenCalledWith({
          method: HederaJsonRpcMethod.SignAndExecuteTransaction,
          params,
        })
      })
    })

    describe('signTransaction', () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), { freeze: true })
      const params: SignTransactionParams = {
        signerAccountId: `hedera:testnet:${testUserAccountId.toString()}`,
        transactionBody: transaction,
      }

      it('should throw an error if there is no signer', async () => {
        connector.signers = []
        await expect(connector.signTransaction(params)).rejects.toThrow(
          `No signer found for account ${testUserAccountId.toString()}`,
        )
      })

      it('should throw an error if no transaction is provided', async () => {
        // @ts-ignore
        const invalidParams = {
          signerAccountId: `hedera:testnet:${testUserAccountId.toString()}`,
          transactionBody: undefined,
        } as SignTransactionParams

        await expect(connector.signTransaction(invalidParams)).rejects.toThrow(
          'Transaction sent in incorrect format. Ensure transaction body is either a base64 transaction body or Transaction object.',
        )
      })

      it('should throw an error if signerAccountId is malformed', async () => {
        const invalidParams = {
          signerAccountId: undefined,
          transactionBody: transaction,
        }

        await expect(connector.signTransaction(invalidParams)).rejects.toThrow(
          'No signer found for account undefined',
        )
      })

      it('should invoke signer.signTransaction with the transaction', async () => {
        const mockSigner = {
          getAccountId: () => testUserAccountId,
          signTransaction: jest.fn().mockResolvedValue({
            _signedTransactions: new Map([
              [0, { sigMap: { sigPair: [{ ed25519: new Uint8Array([1, 2, 3]) }] } }],
            ]),
          }),
        }
        connector.signers = [mockSigner as any]

        await connector.signTransaction(params)
        expect(mockSigner.signTransaction).toHaveBeenCalledWith(transaction)
      })

      it('should return a signed transaction with valid signature map', async () => {
        const mockSignedTransaction = {
          _signedTransactions: new Map([
            [0, { sigMap: { sigPair: [{ ed25519: new Uint8Array([1, 2, 3]) }] } }],
          ]),
        }
        const mockSigner = {
          getAccountId: () => testUserAccountId,
          signTransaction: jest.fn().mockResolvedValue(mockSignedTransaction),
        }
        connector.signers = [mockSigner as any]

        const result = await connector.signTransaction(params)
        const sigMap = result._signedTransactions.get(0)?.sigMap
        expect(sigMap).toBeDefined()
        expect(sigMap.sigPair[0].ed25519).toEqual(new Uint8Array([1, 2, 3]))
      })

      it('should handle base64 string transaction body', async () => {
        const mockRequest = jest
          .fn()
          .mockResolvedValue({ signedTransaction: 'mocked-signed-transaction' })
        // @ts-ignore - accessing private method for testing
        connector.request = mockRequest

        const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
          freeze: true,
        })
        const base64Body = transactionToBase64String(transaction)
        const base64Params = {
          signerAccountId: `hedera:testnet:${testUserAccountId.toString()}`,
          transactionBody: base64Body,
        }

        const result = await connector.signTransaction(base64Params)
        expect(result).toEqual({ signedTransaction: 'mocked-signed-transaction' })
        expect(mockRequest).toHaveBeenCalledWith({
          method: HederaJsonRpcMethod.SignTransaction,
          params: base64Params,
        })
      })

      it('should throw an error if transaction body is neither string nor Transaction', async () => {
        const invalidParams = {
          signerAccountId: `hedera:testnet:${testUserAccountId.toString()}`,
          transactionBody: 123, // number instead of string or Transaction
        } as unknown as SignTransactionParams

        await expect(connector.signTransaction(invalidParams)).rejects.toThrow(
          'Transaction sent in incorrect format. Ensure transaction body is either a base64 transaction body or Transaction object.',
        )
      })
    })
  })

  describe('signature verification', () => {
    let mockSigner: DAppSigner
    const privateKey = PrivateKey.generateED25519()
    const publicKey = privateKey.publicKey

    beforeEach(() => {
      // Create a real signer that can actually sign transactions
      mockSigner = new DAppSigner(
        testUserAccountId,
        mockSignClient,
        fakeSession.topic,
        LedgerId.TESTNET,
      )

      // Mock the request method to simulate actual signing with our private key
      jest
        .spyOn(mockSigner as any, 'request')
        .mockImplementation(async ({ method, params }) => {
          if (method === HederaJsonRpcMethod.SignTransaction) {
            // Convert the base64 transaction body back to bytes
            const bodyBytes = base64StringToUint8Array(params.transactionBody)

            // Create a signature using our private key
            const signature = privateKey.sign(bodyBytes)

            // Create a signature map
            const signatureMap = {
              sigPair: [
                {
                  pubKeyPrefix: publicKey.toBytes(),
                  ed25519: signature,
                },
              ],
            }

            return {
              signatureMap: Uint8ArrayToBase64String(
                proto.SignatureMap.encode(signatureMap).finish(),
              ),
            }
          }
          return {}
        })

      connector.signers = [mockSigner]
    })

    it('should verify signatures using real signing', async () => {
      // Create a test transaction
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), { freeze: true })

      // Sign with connector
      const connectorParams: SignTransactionParams = {
        signerAccountId: `hedera:testnet:${testUserAccountId.toString()}`,
        transactionBody: transaction,
      }

      const connectorSigned = await connector.signTransaction(connectorParams)
      const connectorSigMap = connectorSigned._signedTransactions.get(0)!.sigMap
      const connectorSignature = extractFirstSignature(connectorSigMap)
      const bytesToVerify = connectorSigned._signedTransactions.get(0)!.bodyBytes!

      // Sign directly with private key for comparison
      const directSigned = await transaction.sign(privateKey)
      const directSigMap = directSigned._signedTransactions.get(0)!.sigMap
      const directSignature = extractFirstSignature(directSigMap)

      // Verify both signatures with real verification
      const publicKeyBytes = publicKey.toBytes()

      const connectorVerified = nacl.sign.detached.verify(
        bytesToVerify,
        connectorSignature,
        publicKeyBytes,
      )

      const directVerified = nacl.sign.detached.verify(
        bytesToVerify,
        directSignature,
        publicKeyBytes,
      )

      expect(connectorVerified).toBe(true)
      expect(directVerified).toBe(true)

      // Both signatures should be identical since they're signed with the same key
      expect(Buffer.from(connectorSignature)).toEqual(Buffer.from(directSignature))
    })

    it('should fail verification with wrong public key', async () => {
      // Create a test transaction
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), { freeze: true })

      const params: SignTransactionParams = {
        signerAccountId: `hedera:testnet:${testUserAccountId.toString()}`,
        transactionBody: transaction,
      }

      const signed = await connector.signTransaction(params)
      const sigMap = signed._signedTransactions.get(0)!.sigMap
      const signature = extractFirstSignature(sigMap)
      const bytesToVerify = signed._signedTransactions.get(0)!.bodyBytes!

      // Use a different key for verification
      const wrongKey = PrivateKey.generateED25519().publicKey
      const wrongKeyBytes = wrongKey.toBytes()

      const verified = nacl.sign.detached.verify(bytesToVerify, signature, wrongKeyBytes)

      expect(verified).toBe(false)
    })
  })

  describe('setLogLevel', () => {
    it('should set the log level correctly', () => {
      connector.setLogLevel('error')
      // @ts-ignore - accessing private property for testing
      expect(connector.logger.logLevel).toBe('error')

      connector.setLogLevel('debug')
      // @ts-ignore - accessing private property for testing
      expect(connector.logger.logLevel).toBe('debug')
    })
  })

  describe('getSigner', () => {
    it('should throw error when initializing', () => {
      // @ts-ignore - accessing private property for testing
      connector.isInitializing = true
      expect(() => connector.getSigner(testUserAccountId)).toThrow(
        'DAppConnector is not initialized yet. Try again later.',
      )
    })

    it('should throw error when signer not found', () => {
      expect(() => connector.getSigner(testUserAccountId)).toThrow(
        'Signer is not found for this accountId',
      )
    })

    it('should return correct signer', () => {
      const mockSigner = new DAppSigner(
        testUserAccountId,
        mockSignClient,
        fakeSession.topic,
        LedgerId.TESTNET,
      )
      connector.signers = [mockSigner]
      expect(connector.getSigner(testUserAccountId)).toBe(mockSigner)
    })
  })

  describe('event handlers', () => {
    beforeEach(() => {
      connector = new DAppConnector(
        dAppMetadata,
        LedgerId.TESTNET,
        projectId,
        undefined,
        undefined,
        undefined,
        'off',
      )
      connector.walletConnectClient = mockSignClient
    })

    it('should handle session event', () => {
      const validateAndRefreshSignersSpy = jest.spyOn(
        connector as any,
        'validateAndRefreshSigners',
      )
      validateAndRefreshSignersSpy.mockImplementation(() => {})

      // Call handler directly
      connector['handleSessionEvent']({
        id: 1,
        topic: mockTopic,
        params: {
          event: { name: 'chainChanged', data: {} },
          chainId: ledgerIdToCAIPChainId(LedgerId.TESTNET).toString(),
        },
      })

      expect(validateAndRefreshSignersSpy).toHaveBeenCalled()
    })

    it('should handle session update', () => {
      // Initial state
      connector.signers = []

      // Call handler directly
      connector['handleSessionUpdate']({
        topic: mockTopic,
        params: {
          namespaces: {
            hedera: {
              accounts: [`hedera:testnet:${testUserAccountId.toString()}`],
              methods: Object.values(HederaJsonRpcMethod),
              events: [],
            },
          },
        },
      })

      expect(connector.signers.length).toBe(1)
      expect(connector.signers[0].topic).toBe(mockTopic)
    })

    it('should handle session delete', () => {
      const disconnectSpy = jest.spyOn(connector, 'disconnect')
      disconnectSpy.mockImplementation(async () => true)

      // Add initial signer
      connector.signers = [
        new DAppSigner(testUserAccountId, mockSignClient, mockTopic, LedgerId.TESTNET, 'off'),
      ]

      // Call handler directly
      connector['handleSessionDelete']({ topic: mockTopic })

      expect(disconnectSpy).toHaveBeenCalledWith(mockTopic)
      expect(connector.signers.length).toBe(0)
    })

    it('should handle pairing delete', () => {
      // Setup
      const disconnectSpy = jest.spyOn(connector, 'disconnect')
      disconnectSpy.mockImplementation(async () => {
        connector.signers = []
        return true
      })

      // Add initial signer
      connector.signers = [
        new DAppSigner(
          testUserAccountId,
          mockSignClient,
          mockTopic,
          LedgerId.TESTNET,
          undefined,
          'off',
        ),
      ]

      // Call handler directly
      connector['handlePairingDelete']({ topic: mockTopic })

      expect(disconnectSpy).toHaveBeenCalledWith(mockTopic)
      expect(connector.signers.length).toBe(0)
    })

    it('should handle empty signers array', () => {
      connector.signers = []
      expect(connector.signers.length).toBe(0)

      // @ts-ignore
      connector.handlePairingDelete({ topic: mockTopic })

      expect(connector.signers.length).toBe(0)
    })

    it('should handle undefined topic gracefully', () => {
      connector.signers = [
        new DAppSigner(
          testUserAccountId,
          mockSignClient,
          mockTopic,
          LedgerId.TESTNET,
          undefined,
          'off',
        ),
      ]
      expect(connector.signers.length).toBe(1)

      // @ts-ignore
      connector.handlePairingDelete({ topic: undefined as any })

      expect(connector.signers.length).toBe(1)
    })

    it('should handle null topic gracefully', () => {
      connector.signers = [
        new DAppSigner(
          testUserAccountId,
          mockSignClient,
          mockTopic,
          LedgerId.TESTNET,
          undefined,
          'off',
        ),
      ]
      expect(connector.signers.length).toBe(1)

      // @ts-ignore
      connector.handlePairingDelete({ topic: null as any })

      expect(connector.signers.length).toBe(1)
    })

    it('should handle empty string topic gracefully', () => {
      connector.signers = [
        new DAppSigner(
          testUserAccountId,
          mockSignClient,
          mockTopic,
          LedgerId.TESTNET,
          undefined,
          'off',
        ),
      ]
      expect(connector.signers.length).toBe(1)

      // @ts-ignore
      connector.handlePairingDelete({ topic: '' })

      expect(connector.signers.length).toBe(1)
    })
  })

  describe('validateSession', () => {
    beforeEach(() => {
      const getMock = jest.fn() as jest.MockedFunction<typeof mockSignClient.session.get>
      mockSignClient = {
        session: {
          get: getMock,
        },
      } as unknown as ISignClient

      connector = new DAppConnector(
        dAppMetadata,
        LedgerId.TESTNET,
        projectId,
        undefined,
        undefined,
        undefined,
        'off',
      )
      connector.walletConnectClient = mockSignClient
    })

    it('should return false when walletConnectClient is not initialized', () => {
      connector.walletConnectClient = undefined
      // @ts-ignore
      expect(connector.validateSession(mockTopic)).toBe(false)
    })

    it('should return false when session.get throws error', () => {
      mockSignClient.session.get.mockImplementation(() => {
        throw new Error('Session error')
      })
      // @ts-ignore
      expect(connector.validateSession(mockTopic)).toBe(false)
    })

    it('should return false when session does not exist', () => {
      mockSignClient.session.get.mockReturnValue(null)
      // @ts-ignore
      expect(connector.validateSession(mockTopic)).toBe(false)
    })

    it('should return false when session exists but topic does not match', () => {
      mockSignClient.session.get.mockReturnValue({
        topic: 'different-topic',
      } as SessionTypes.Struct)
      // @ts-ignore
      expect(connector.validateSession(mockTopic)).toBe(false)
    })

    it('should return true when session exists with matching topic', () => {
      mockSignClient.session.get.mockReturnValue({
        topic: mockTopic,
      } as SessionTypes.Struct)
      connector.signers = [
        new DAppSigner(
          testUserAccountId,
          mockSignClient,
          mockTopic,
          LedgerId.TESTNET,
          undefined,
          'off',
        ),
      ]
      // @ts-ignore
      expect(connector.validateSession(mockTopic)).toBe(true)
    })

    it('should return false when topic is undefined', () => {
      // @ts-ignore
      expect(connector.validateSession(undefined as any)).toBe(false)
    })

    it('should return false when topic is null', () => {
      // @ts-ignore
      expect(connector.validateSession(null as any)).toBe(false)
    })

    it('should return false when topic is empty string', () => {
      // @ts-ignore
      expect(connector.validateSession('')).toBe(false)
    })

    it('should return false when session exists but no signer', () => {
      mockSignClient.session.get.mockReturnValue({
        topic: mockTopic,
      } as SessionTypes.Struct)
      connector.signers = []
      // @ts-ignore
      expect(connector.validateSession(mockTopic)).toBe(false)
    })

    it('should return true when session and signer exist', () => {
      mockSignClient.session.get.mockReturnValue({
        topic: mockTopic,
      } as SessionTypes.Struct)
      connector.signers = [
        new DAppSigner(
          testUserAccountId,
          mockSignClient,
          mockTopic,
          LedgerId.TESTNET,
          undefined,
          'off',
        ),
      ]
      // @ts-ignore
      expect(connector.validateSession(mockTopic)).toBe(true)
    })

    it('should call handleSessionDelete when session does not exist but signer exists', () => {
      // Mock session.get to return null (session doesn't exist)
      mockSignClient.session.get.mockReturnValue(null)

      // Create a signer with the topic
      const topic = 'non-existent-session-topic'
      connector.signers = [
        new DAppSigner(
          testUserAccountId,
          mockSignClient,
          topic,
          LedgerId.TESTNET,
          undefined,
          'off',
        ),
      ]

      // Spy on handleSessionDelete
      const handleSessionDeleteSpy = jest.spyOn(connector as any, 'handleSessionDelete')

      // Call validateSession
      // @ts-ignore
      expect(connector.validateSession(topic)).toBe(false)

      // Verify handleSessionDelete was called with correct topic
      expect(handleSessionDeleteSpy).toHaveBeenCalledWith({ topic })
      expect(handleSessionDeleteSpy).toHaveBeenCalledTimes(1)

      // Verify signer was removed
      expect(connector.signers.length).toBe(0)
    })
  })

  describe('handleSessionDelete', () => {
    beforeEach(() => {
      connector = new DAppConnector(
        dAppMetadata,
        LedgerId.TESTNET,
        projectId,
        undefined,
        undefined,
        undefined,
        'off',
      )
      connector.walletConnectClient = mockSignClient
      connector.signers = [
        new DAppSigner(
          testUserAccountId,
          mockSignClient,
          mockTopic,
          LedgerId.TESTNET,
          undefined,
          'off',
        ),
      ]
    })

    it('should remove signer when session is deleted', () => {
      expect(connector.signers.length).toBe(1)

      // @ts-ignore
      connector.handleSessionDelete({ topic: mockTopic })

      expect(connector.signers.length).toBe(0)
    })

    it('should ignore session deletion for different topic', () => {
      expect(connector.signers.length).toBe(1)

      // @ts-ignore
      connector.handleSessionDelete({ topic: 'different-topic' })

      expect(connector.signers.length).toBe(1)
    })

    it('should handle session deletion when no signers exist', () => {
      connector.signers = []
      expect(connector.signers.length).toBe(0)

      // @ts-ignore
      connector.handleSessionDelete({ topic: mockTopic })

      expect(connector.signers.length).toBe(0)
    })

    it('should handle undefined topic gracefully', () => {
      expect(connector.signers.length).toBe(1)

      // @ts-ignore
      connector.handleSessionDelete({ topic: undefined as any })

      expect(connector.signers.length).toBe(1)
    })

    it('should handle null topic gracefully', () => {
      expect(connector.signers.length).toBe(1)

      // @ts-ignore
      connector.handleSessionDelete({ topic: null as any })

      expect(connector.signers.length).toBe(1)
    })

    it('should handle empty topic string gracefully', () => {
      expect(connector.signers.length).toBe(1)

      // @ts-ignore
      connector.handleSessionDelete({ topic: '' })

      expect(connector.signers.length).toBe(1)
    })
  })

  describe('handlePairingDelete', () => {
    beforeEach(() => {
      connector = new DAppConnector(
        dAppMetadata,
        LedgerId.TESTNET,
        projectId,
        undefined,
        undefined,
        undefined,
        'off',
      )
      connector.walletConnectClient = mockSignClient
    })

    it('should handle pairing deletion when topic matches', () => {
      connector.signers = [
        new DAppSigner(
          testUserAccountId,
          mockSignClient,
          mockTopic,
          LedgerId.TESTNET,
          undefined,
          'off',
        ),
      ]
      expect(connector.signers.length).toBe(1)

      // @ts-ignore
      connector.handlePairingDelete({ topic: mockTopic })

      expect(connector.signers.length).toBe(0)
    })

    it('should ignore pairing deletion for different topic', () => {
      connector.signers = [
        new DAppSigner(
          testUserAccountId,
          mockSignClient,
          mockTopic,
          LedgerId.TESTNET,
          undefined,
          'off',
        ),
      ]
      expect(connector.signers.length).toBe(1)

      // @ts-ignore
      connector.handlePairingDelete({ topic: 'different-topic' })

      expect(connector.signers.length).toBe(1)
    })

    it('should handle empty signers array', () => {
      connector.signers = []
      expect(connector.signers.length).toBe(0)

      // @ts-ignore
      connector.handlePairingDelete({ topic: mockTopic })

      expect(connector.signers.length).toBe(0)
    })

    it('should handle undefined topic gracefully', () => {
      connector.signers = [
        new DAppSigner(
          testUserAccountId,
          mockSignClient,
          mockTopic,
          LedgerId.TESTNET,
          undefined,
          'off',
        ),
      ]
      expect(connector.signers.length).toBe(1)

      // @ts-ignore
      connector.handlePairingDelete({ topic: undefined as any })

      expect(connector.signers.length).toBe(1)
    })

    it('should handle null topic gracefully', () => {
      connector.signers = [
        new DAppSigner(
          testUserAccountId,
          mockSignClient,
          mockTopic,
          LedgerId.TESTNET,
          undefined,
          'off',
        ),
      ]
      expect(connector.signers.length).toBe(1)

      // @ts-ignore
      connector.handlePairingDelete({ topic: null as any })

      expect(connector.signers.length).toBe(1)
    })

    it('should handle empty string topic gracefully', () => {
      connector.signers = [
        new DAppSigner(
          testUserAccountId,
          mockSignClient,
          mockTopic,
          LedgerId.TESTNET,
          undefined,
          'off',
        ),
      ]
      expect(connector.signers.length).toBe(1)

      // @ts-ignore
      connector.handlePairingDelete({ topic: '' })

      expect(connector.signers.length).toBe(1)
    })
  })

  describe('connect and connectExtension', () => {
    it('should connect using URI and handle extension ID', async () => {
      const mockUri = 'wc:1234...'
      const extensionId = 'test-extension'
      const mockSession = {
        topic: mockTopic,
        namespaces: {
          hedera: {
            accounts: [`hedera:testnet:${testUserAccountId.toString()}`],
            methods: Object.values(HederaJsonRpcMethod),
            events: [],
          },
        },
        sessionProperties: { extensionId },
      } as unknown as SessionTypes.Struct
      // Initialize walletConnectClient
      connector.walletConnectClient = mockSignClient

      // Mock connectURI
      jest.spyOn(connector as any, 'connectURI').mockResolvedValue({
        uri: mockUri,
        approval: jest.fn().mockResolvedValue(mockSession),
      })

      // Mock session.update
      const updateSpy = jest.fn().mockResolvedValue(undefined)
      mockSignClient.session.update = updateSpy

      const launchCallback = jest.fn()
      await connector.connect(launchCallback, undefined, 'test-extension')

      expect(launchCallback).toHaveBeenCalledWith(mockUri)
      expect(updateSpy).toHaveBeenCalledWith(mockTopic, {
        sessionProperties: { extensionId: 'test-extension' },
      })
    })

    it('should throw error if URI is undefined', async () => {
      jest.spyOn(connector as any, 'connectURI').mockResolvedValue({
        uri: undefined,
        approval: jest.fn(),
      })

      const launchCallback = jest.fn()
      await expect(connector.connect(launchCallback)).rejects.toThrow('URI is not defined')
    })

    it('should connect using extension', async () => {
      const extensionId = 'test-extension'
      connector.extensions = [
        {
          id: extensionId,
          available: true,
          availableInIframe: false,
          name: 'Test Extension',
        },
      ]

      const connectSpy = jest
        .spyOn(connector, 'connect')
        .mockResolvedValue({} as SessionTypes.Struct)

      await connector.connectExtension(extensionId)

      expect(connectSpy).toHaveBeenCalled()
    })

    it('should throw error if extension is not available', async () => {
      const extensionId = 'non-existent'
      await expect(connector.connectExtension(extensionId)).rejects.toThrow(
        'Extension is not available',
      )
    })
  })

  describe('disconnectAll', () => {
    beforeEach(() => {
      connector.walletConnectClient = mockSignClient
    })

    it('should disconnect all sessions and pairings', async () => {
      const mockSessions = [{ topic: 'topic1' }, { topic: 'topic2' }]
      const mockPairings = [{ topic: 'pairing1' }, { topic: 'pairing2' }]

      mockSignClient.session.getAll = jest.fn().mockReturnValue(mockSessions)
      mockSignClient.core.pairing.getPairings = jest.fn().mockReturnValue(mockPairings)

      const disconnectSpy = jest.spyOn(connector, 'disconnect').mockResolvedValue(true)

      await connector.disconnectAll()

      expect(disconnectSpy).toHaveBeenCalledTimes(4)
      expect(connector.signers).toHaveLength(0)
    })

    it('should throw error if no active sessions or pairings', async () => {
      mockSignClient.session.getAll = jest.fn().mockReturnValue([])
      mockSignClient.core.pairing.getPairings = jest.fn().mockReturnValue([])

      await expect(connector.disconnectAll()).rejects.toThrow(
        'There is no active session/pairing. Connect to the wallet at first.',
      )
    })
  })

  describe('onSessionConnected', () => {
    it('should handle duplicate signers and clean them up', async () => {
      const existingSigner = new DAppSigner(
        testUserAccountId,
        mockSignClient,
        'existing-topic',
        LedgerId.TESTNET,
      )

      const newSession = {
        topic: 'new-topic',
        namespaces: {
          hedera: {
            accounts: [`hedera:testnet:${testUserAccountId.toString()}`],
            methods: Object.values(HederaJsonRpcMethod),
            events: [],
          },
        },
      } as unknown as SessionTypes.Struct

      connector.signers = [existingSigner]
      connector.walletConnectClient = mockSignClient

      const disconnectSpy = jest.spyOn(connector, 'disconnect').mockResolvedValue(true)

      await connector['onSessionConnected'](newSession)

      expect(disconnectSpy).toHaveBeenCalledWith('existing-topic')
      expect(connector.signers.length).toBeGreaterThan(0)
      expect(connector.signers[0].topic).toBe('new-topic')
    })
  })

  describe('checkIframeConnect', () => {
    it('should connect using iframe extension if available', async () => {
      const extensionId = 'iframe-ext'
      const mockSession = {} as SessionTypes.Struct

      connector.extensions = [
        {
          id: extensionId,
          available: true,
          availableInIframe: true,
          name: 'Iframe Extension',
        },
      ]

      const connectExtensionSpy = jest
        .spyOn(connector, 'connectExtension')
        .mockResolvedValue(mockSession)

      const onSessionCreatedCallback = jest.fn()
      connector.onSessionIframeCreated = onSessionCreatedCallback

      await connector['checkIframeConnect']()

      expect(connectExtensionSpy).toHaveBeenCalledWith(extensionId)
      expect(onSessionCreatedCallback).toHaveBeenCalledWith(mockSession)
    })
  })

  describe('connectURI', () => {
    beforeEach(() => {
      connector.walletConnectClient = mockSignClient
    })

    it('should connect with required namespaces and no pairing topic', async () => {
      const mockNamespaces = networkNamespaces(
        LedgerId.TESTNET,
        connector.supportedMethods,
        connector.supportedEvents,
      )

      const mockApproval = jest.fn().mockResolvedValue({
        topic: mockTopic,
        namespaces: {
          hedera: {
            accounts: [`hedera:testnet:${testUserAccountId.toString()}`],
            methods: connector.supportedMethods,
            events: connector.supportedEvents,
          },
        },
      })

      jest.spyOn(mockSignClient, 'connect').mockResolvedValue({
        uri: 'mock:uri',
        approval: mockApproval,
      })

      const result = await connector['connectURI']()

      expect(result.uri).toBe('mock:uri')
      expect(mockSignClient.connect).toHaveBeenCalledWith({
        requiredNamespaces: mockNamespaces,
        pairingTopic: undefined,
      })
    })

    it('should connect with provided pairing topic', async () => {
      const pairingTopic = 'test-pairing-topic'

      jest.spyOn(mockSignClient, 'connect').mockResolvedValue({
        uri: 'mock:uri',
        approval: jest.fn(),
      })

      await connector['connectURI'](pairingTopic)

      expect(mockSignClient.connect).toHaveBeenCalledWith({
        requiredNamespaces: expect.any(Object),
        pairingTopic,
      })
    })

    it('should throw error if WalletConnect is not initialized', async () => {
      connector.walletConnectClient = undefined
      await expect(connector['connectURI']()).rejects.toThrow(
        'WalletConnect is not initialized',
      )
    })
  })

  describe('openModal', () => {
    beforeEach(() => {
      connector.walletConnectClient = mockSignClient
    })

    it('should open modal and handle successful connection', async () => {
      const mockUri = 'mock:uri'
      const mockSession = {
        topic: mockTopic,
        namespaces: {
          hedera: {
            accounts: [`hedera:testnet:${testUserAccountId.toString()}`],
            methods: Object.values(HederaJsonRpcMethod),
            events: [],
          },
        },
      }

      jest.spyOn(connector as any, 'connectURI').mockResolvedValue({
        uri: mockUri,
        approval: jest.fn().mockResolvedValue(mockSession),
      })

      const openModalSpy = jest.spyOn(connector.walletConnectModal, 'openModal')
      const closeModalSpy = jest.spyOn(connector.walletConnectModal, 'closeModal')
      const onSessionConnectedSpy = jest
        .spyOn(connector as any, 'onSessionConnected')
        .mockResolvedValue()

      const result = await connector.openModal()

      expect(openModalSpy).toHaveBeenCalledWith({ uri: mockUri })
      expect(onSessionConnectedSpy).toHaveBeenCalledWith(mockSession)
      expect(closeModalSpy).toHaveBeenCalled()
      expect(result).toBe(mockSession)
    })

    it('should handle connection error and close modal', async () => {
      const error = new Error('Connection failed')
      jest.spyOn(connector as any, 'connectURI').mockRejectedValue(error)

      const closeModalSpy = jest.spyOn(connector.walletConnectModal, 'closeModal')

      await expect(connector.openModal()).rejects.toThrow('Connection failed')
      expect(closeModalSpy).toHaveBeenCalled()
    })

    it('should use provided pairing topic', async () => {
      const pairingTopic = 'test-pairing'
      const mockSession = {
        topic: mockTopic,
        namespaces: {
          hedera: {
            accounts: [`hedera:testnet:${testUserAccountId.toString()}`],
            methods: Object.values(HederaJsonRpcMethod),
            events: [],
          },
        },
      }

      const connectURISpy = jest.spyOn(connector as any, 'connectURI').mockResolvedValue({
        uri: 'mock:uri',
        approval: jest.fn().mockResolvedValue(mockSession),
      })

      await connector.openModal(pairingTopic)

      expect(connectURISpy).toHaveBeenCalledWith(pairingTopic)
    })
  })

  describe('validateAndRefreshSigners', () => {
    beforeEach(() => {
      mockSignClient = {
        session: {
          get: jest.fn(),
        },
      } as unknown as ISignClient

      connector = new DAppConnector(
        dAppMetadata,
        LedgerId.TESTNET,
        projectId,
        undefined,
        undefined,
        undefined,
        'off',
      )
      connector.walletConnectClient = mockSignClient
    })

    it('should remove signers with invalid sessions', () => {
      // Create two signers with different topics
      const validTopic = 'valid-topic'
      const invalidTopic = 'invalid-topic'

      // Mock session.get to return valid session for one topic and null for the other
      mockSignClient.session.get.mockImplementation((topic: string) => {
        if (topic === validTopic) {
          return { topic: validTopic } as SessionTypes.Struct
        }
        return null
      })

      // Set up signers
      connector.signers = [
        new DAppSigner(
          testUserAccountId,
          mockSignClient,
          validTopic,
          LedgerId.TESTNET,
          undefined,
          'off',
        ),
        new DAppSigner(
          testUserAccountId,
          mockSignClient,
          invalidTopic,
          LedgerId.TESTNET,
          undefined,
          'off',
        ),
      ]

      // Call private method
      // @ts-ignore - accessing private method for testing
      connector.validateAndRefreshSigners()

      // Verify only valid signer remains
      expect(connector.signers.length).toBe(1)
      expect(connector.signers[0].topic).toBe(validTopic)
    })

    it('should keep all signers when all sessions are valid', () => {
      // Create multiple signers with valid topics
      const topic1 = 'topic-1'
      const topic2 = 'topic-2'

      // Mock session.get to return valid sessions for all topics
      mockSignClient.session.get.mockReturnValue({ topic: 'valid' } as SessionTypes.Struct)

      // Set up signers
      const signers = [
        new DAppSigner(
          testUserAccountId,
          mockSignClient,
          topic1,
          LedgerId.TESTNET,
          undefined,
          'off',
        ),
        new DAppSigner(
          testUserAccountId,
          mockSignClient,
          topic2,
          LedgerId.TESTNET,
          undefined,
          'off',
        ),
      ]
      connector.signers = signers

      // Call private method
      // @ts-ignore - accessing private method for testing
      connector.validateAndRefreshSigners()

      // Verify all signers remain
      expect(connector.signers.length).toBe(2)
      expect(connector.signers).toEqual(signers)
    })

    it('should remove all signers when all sessions are invalid', () => {
      // Mock session.get to return null for all topics
      mockSignClient.session.get.mockReturnValue(null)

      // Set up signers
      connector.signers = [
        new DAppSigner(
          testUserAccountId,
          mockSignClient,
          'topic1',
          LedgerId.TESTNET,
          undefined,
          'off',
        ),
        new DAppSigner(
          testUserAccountId,
          mockSignClient,
          'topic2',
          LedgerId.TESTNET,
          undefined,
          'off',
        ),
      ]

      // Call private method
      // @ts-ignore - accessing private method for testing
      connector.validateAndRefreshSigners()

      // Verify all signers are removed
      expect(connector.signers.length).toBe(0)
    })

    it('should handle empty signers array', () => {
      // Set up empty signers array
      connector.signers = []

      // Call private method
      // @ts-ignore - accessing private method for testing
      connector.validateAndRefreshSigners()

      // Verify no errors and signers remain empty
      expect(connector.signers.length).toBe(0)
    })

    it('should handle errors in session validation', () => {
      // Mock session.get to throw an error
      mockSignClient.session.get.mockImplementation(() => {
        throw new Error('Session validation error')
      })

      // Set up signers
      connector.signers = [
        new DAppSigner(
          testUserAccountId,
          mockSignClient,
          'topic1',
          LedgerId.TESTNET,
          undefined,
          'off',
        ),
      ]

      // Call private method
      // @ts-ignore - accessing private method for testing
      connector.validateAndRefreshSigners()

      // Verify signer is removed due to validation error
      expect(connector.signers.length).toBe(0)
    })
  })
})
