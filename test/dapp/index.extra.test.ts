import { LedgerId, Transaction } from '@hashgraph/sdk'
import SignClient from '@walletconnect/sign-client'
import { DAppConnector } from '../../src'
import { dAppMetadata, projectId, testUserAccountId } from '../_helpers'
import { ExtensionData } from '../../src/lib/shared'

// Mock findExtensions to immediately report an extension
jest.mock('../../src/lib/shared/extensionController', () => {
  const actual = jest.requireActual('../../src/lib/shared/extensionController')
  return {
    ...actual,
    findExtensions: jest.fn((cb: (data: ExtensionData, isIframe: boolean) => void) => {
      cb({ id: 'ext', name: 'Ext' } as ExtensionData, false)
    }),
  }
})

// Mock @walletconnect/utils isOnline
jest.mock('@walletconnect/utils', () => {
  const actual = jest.requireActual('@walletconnect/utils')
  return {
    ...actual,
    getSdkError: jest.fn().mockReturnValue({}),
    isOnline: jest.fn().mockResolvedValue(true),
  }
})

const { findExtensions } = require('../../src/lib/shared/extensionController')

describe('DAppConnector additional coverage', () => {
  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ status: 500 } as any)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('constructor should push extensions discovered by findExtensions', () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    expect(findExtensions).toHaveBeenCalled()
    expect(connector.extensions[0]).toEqual({ id: 'ext', name: 'Ext', available: true, availableInIframe: false })
  })

  it('init should log error when projectId is missing', async () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, '' as any, undefined, undefined, undefined, 'off')
    const errorSpy = jest.spyOn((connector as any).logger, 'error')
    await connector.init()
    expect(errorSpy).toHaveBeenCalled()
    expect(connector.walletConnectClient).toBeUndefined()
    expect(connector.isInitializing).toBe(false)
  })

  it('init should create signers from existing sessions', async () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')

    const mockSession = { topic: 't', namespaces: { hedera: { accounts: [`hedera:testnet:${testUserAccountId}`], methods: [], events: [] } } } as any
    const mockClient = {
      session: { getAll: jest.fn().mockReturnValue([mockSession]) },
      core: {
        relayer: { on: jest.fn() },
        events: { on: jest.fn() },
        pairing: { events: { on: jest.fn() } },
        crypto: { randomSessionIdentifier: 'id' },
        storage: { setItem: jest.fn(), getItem: jest.fn() },
      },
      on: jest.fn(),
    } as unknown as SignClient

    jest.spyOn(SignClient, 'init').mockResolvedValue(mockClient)
    const createSpy = jest.spyOn<any, any>(connector as any, 'createSigners').mockReturnValue([{} as any])
    await connector.init({ logger: 'fatal' })
    expect(createSpy).toHaveBeenCalledWith(mockSession)
  })

  it('openModal should reject when user closes modal', async () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    connector.walletConnectClient = {} as any
    connector.walletConnectModal = {
      openModal: jest.fn(),
      closeModal: jest.fn(),
      subscribeModal: jest.fn((cb) => cb({ open: false })),
    } as any
    ;(connector as any).connectURI = jest.fn().mockResolvedValue({ uri: 'wc:1', approval: () => new Promise(() => {}) })
    await expect(connector.openModal(undefined, true)).rejects.toThrow('User rejected pairing')
    expect(connector.walletConnectModal.closeModal).toHaveBeenCalled()
  })

  it('connectExtension should omit extensionId when available in iframe', async () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    const extension = { id: 'iframeExt', available: true, availableInIframe: true, name: 'Iframe' }
    connector.extensions = [extension]
    const connectSpy = jest.spyOn(connector, 'connect').mockResolvedValue({} as any)
    await connector.connectExtension('iframeExt')
    expect(connectSpy).toHaveBeenCalled()
    expect(connectSpy.mock.calls[0][2]).toBeUndefined()
  })

  it('openModal rejects when approval fails', async () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    connector.walletConnectClient = {} as any
    connector.walletConnectModal = { openModal: jest.fn(), closeModal: jest.fn(), subscribeModal: jest.fn() } as any
    ;(connector as any).connectURI = jest.fn().mockResolvedValue({ uri: 'wc', approval: jest.fn().mockRejectedValue(new Error('fail')) })
    await expect(connector.openModal()).rejects.toThrow('fail')
  })

  it('abortableConnect should reject after timeout', async () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    const promise = (connector as any).abortableConnect(() => new Promise(() => {}))
    jest.advanceTimersByTime(480000)
    await expect(promise).rejects.toThrow('Connect timed out after 480000(ms)')
  })

  it('handleSessionUpdate replaces signer list', () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    connector.walletConnectClient = { session: { get: jest.fn().mockReturnValue({ topic: 'old' }) } } as any
    connector.signers = [{ topic: 'old' }] as any
    jest.spyOn(connector as any, 'createSigners').mockReturnValue([{ topic: 'old' } as any])
    ;(connector as any).handleSessionUpdate({ topic: 'old', params: { namespaces: {} as any } })
    expect(connector.signers.length).toBe(1)
    expect(connector.signers[0].topic).toBe('old')
  })

  it('onSessionConnected logs when same topic appears', async () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    connector.walletConnectClient = {} as any
    const signer = { getAccountId: () => testUserAccountId, extensionId: undefined, getMetadata: () => ({ name: 'A' }), topic: 'dup' } as any
    connector.signers = [signer]
    jest.spyOn(connector as any, 'createSigners').mockReturnValue([signer])
    const errSpy = jest.spyOn((connector as any).logger, 'error')
    await (connector as any).onSessionConnected({ topic: 'dup', namespaces: { hedera: { accounts: [`hedera:testnet:${testUserAccountId}`], methods: [], events: [] } } })
    expect(errSpy).toHaveBeenCalled()
  })

  it('signTransaction throws when transaction is null', async () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    const signer = { getAccountId: () => testUserAccountId, signTransaction: jest.fn() } as any
    connector.signers = [signer]
    const orig = (Transaction as any)[Symbol.hasInstance]
    Object.defineProperty(Transaction, Symbol.hasInstance, { value: () => true, configurable: true })
    await expect(connector.signTransaction({ signerAccountId: `hedera:testnet:${testUserAccountId}`, transactionBody: null as any })).rejects.toThrow('No transaction provided')
    Object.defineProperty(Transaction, Symbol.hasInstance, { value: orig, configurable: true })
  })

  it('disconnect returns false when client is undefined', async () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    const result = await connector.disconnect('topic')
    expect(result).toBe(false)
  })

  it('disconnectAll throws when client not initialized', async () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    await expect(connector.disconnectAll()).rejects.toThrow('WalletConnect is not initialized')
  })

  it('createSigners works with custom logger', () => {
    class CustomLogger { error(){} warn(){} info(){} debug(){} }
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    ;(connector as any).logger = new CustomLogger() as any
    connector.walletConnectClient = { } as any
    const session = { topic: 't', namespaces: { hedera: { accounts: [`hedera:testnet:${testUserAccountId}`], methods: [], events: [] } } } as any
    const signers = (connector as any).createSigners(session)
    expect(signers.length).toBe(1)
  })

  it('handleSessionDelete logs error when disconnect fails', () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    connector.walletConnectClient = {} as any
    connector.signers = [{ topic: 'x' }] as any
    jest.spyOn(connector, 'disconnect').mockImplementation(() => {
      throw new Error('fail')
    })
    const errSpy = jest.spyOn((connector as any).logger, 'error')
    ;(connector as any).handleSessionDelete({ topic: 'x' })
    expect(errSpy).toHaveBeenCalled()
  })

  it('handlePairingDelete logs error when disconnect fails', () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    connector.walletConnectClient = { core: { pairing: { } } } as any
    jest.spyOn(connector, 'disconnect').mockImplementation(() => {
      throw new Error('fail')
    })
    const errSpy = jest.spyOn((connector as any).logger, 'error')
    ;(connector as any).handlePairingDelete({ topic: 'x' })
    expect(errSpy).toHaveBeenCalled()
  })

  it('handleRelayConnected logs error when client missing', async () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    const spy = jest.spyOn((connector as any).logger, 'error')
    await (connector as any).handleRelayConnected()
    expect(spy).toHaveBeenCalledWith('walletConnectClient not found')
  })

  it('verifyLastConnectedInstance triggers reconnect when ids differ', async () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    const restartSpy = jest.fn()
    connector.walletConnectClient = {
      core: {
        crypto: { randomSessionIdentifier: 'curr' },
        storage: { getItem: jest.fn().mockResolvedValue('prev'), setItem: jest.fn() },
        relayer: { restartTransport: restartSpy },
      },
    } as any
    await (connector as any).verifyLastConnectedInstance()
    expect(restartSpy).toHaveBeenCalled()
  })
})
