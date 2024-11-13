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

import { AccountId, AccountInfoQuery, LedgerId, TopicCreateTransaction } from '@hashgraph/sdk'
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
  transactionToTransactionBody,
  transactionBodyToBase64String,
  DAppSigner,
} from '../../src'
import {
  projectId,
  dAppMetadata,
  useJsonFixture,
  prepareTestTransaction,
  testUserAccountId,
} from '../_helpers'
import Client, { SignClient } from '@walletconnect/sign-client'
import { SessionTypes } from '@walletconnect/types'
import { networkNamespaces } from '../../src/lib/shared'

describe('DAppConnector', () => {
  let connector: DAppConnector
  let mockSignClient: Client
  const fakeSession = useJsonFixture('fakeSession') as SessionTypes.Struct
  const mockTopic = '1234567890abcdef'

  beforeEach(async () => {
    connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId)
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

      expect(connector.walletConnectClient).toBeInstanceOf(Client)
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
        new DAppSigner(testUserAccountId, mockSignClient, fakeSession.topic, LedgerId.TESTNET),
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
        signerAccountId: testUserAccountId.toString(),
        transactionBody: transactionBodyToBase64String(
          transactionToTransactionBody(transaction, AccountId.fromString('0.0.3'))!,
        ),
      }

      it('should throw an error if there is no any signer', async () => {
        connector.signers = []
        await expect(connector.signTransaction(params)).rejects.toThrow(
          'Signer not found for account ID: 0.0.12345. Did you use the correct format? e.g hedera:<network>:<address>',
        )
      })

      it('should invoke last signer request with correct params', async () => {
        await connector.signTransaction(params)
        expect(lastSignerRequestMock).toHaveBeenCalledWith({
          method: HederaJsonRpcMethod.SignTransaction,
          params,
        })
      })
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
    beforeEach(async () => {
      connector.walletConnectClient = mockSignClient

      // Mock session.get to return a valid session
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

      // Mock createSigners to return a valid signer
      jest
        .spyOn(connector as any, 'createSigners')
        .mockReturnValue([
          new DAppSigner(testUserAccountId, mockSignClient, mockTopic, LedgerId.TESTNET),
        ])
    })

    it('should handle session event', () => {
      const validateAndRefreshSignersSpy = jest.spyOn(
        connector as any,
        'validateAndRefreshSigners',
      )
      validateAndRefreshSignersSpy.mockImplementation(() => {})

      // Call handler directly
      connector['handleSessionEvent']({
        topic: mockTopic,
        params: {
          event: { name: 'chainChanged', data: {} },
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
        new DAppSigner(testUserAccountId, mockSignClient, mockTopic, LedgerId.TESTNET),
      ]

      // Call handler directly
      connector['handleSessionDelete']({ topic: mockTopic })

      expect(disconnectSpy).toHaveBeenCalledWith(mockTopic)
      expect(connector.signers.length).toBe(0)
    })

    it('should handle pairing delete', () => {
      const disconnectSpy = jest.spyOn(connector, 'disconnect')
      disconnectSpy.mockImplementation(async () => true)

      // Add initial signer
      connector.signers = [
        new DAppSigner(testUserAccountId, mockSignClient, mockTopic, LedgerId.TESTNET),
      ]

      // Call handler directly
      connector['handlePairingDelete']({ topic: mockTopic })

      expect(disconnectSpy).toHaveBeenCalledWith(mockTopic)
      expect(connector.signers.length).toBe(0)
    })
  })

  describe('validateSession', () => {
    it('should return false when walletConnectClient is not initialized', () => {
      connector.walletConnectClient = undefined
      // @ts-ignore - accessing private method for testing
      expect(connector.validateSession(mockTopic)).toBe(false)
    })

    it('should return false when session does not exist', () => {
      connector.walletConnectClient = mockSignClient
      jest.spyOn(connector.walletConnectClient.session, 'get').mockImplementation(() => {
        throw new Error('Session not found')
      })
      // @ts-ignore - accessing private method for testing
      expect(connector.validateSession(mockTopic)).toBe(false)
    })

    it('should return true when session exists', () => {
      connector.walletConnectClient = mockSignClient
      // @ts-ignore - accessing private method for testing
      expect(connector.validateSession(mockTopic)).toBe(true)
    })
  })

  describe('validateAndRefreshSigners', () => {
    it('should remove invalid signers', () => {
      const validTopic = 'valid-topic'
      const invalidTopic = 'invalid-topic'

      connector.signers = [
        new DAppSigner(testUserAccountId, mockSignClient, validTopic, LedgerId.TESTNET),
        new DAppSigner(testUserAccountId, mockSignClient, invalidTopic, LedgerId.TESTNET),
      ]

      // Mock validateSession to return true for validTopic and false for invalidTopic
      // @ts-ignore - accessing private method for testing
      jest
        .spyOn(connector, 'validateSession')
        .mockImplementation((topic) => topic === validTopic)

      // @ts-ignore - accessing private method for testing
      connector.validateAndRefreshSigners()

      expect(connector.signers.length).toBe(1)
      expect(connector.signers[0].topic).toBe(validTopic)
    })
  })

  describe('connect and connectExtension', () => {
    it('should connect using URI and handle extension ID', async () => {
      const mockUri = 'wc:1234...'
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
      const extensionId = 'test-extension'

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
      await connector.connect(launchCallback, undefined, extensionId)

      expect(launchCallback).toHaveBeenCalledWith(mockUri)
      expect(updateSpy).toHaveBeenCalledWith(mockTopic, {
        sessionProperties: { extensionId },
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
        'ext1',
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
        sessionProperties: { extensionId: 'ext1' },
      } as SessionTypes.Struct

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
})
