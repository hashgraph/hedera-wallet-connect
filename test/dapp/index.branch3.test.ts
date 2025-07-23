import { LedgerId, TopicCreateTransaction } from '@hashgraph/sdk'
import { SessionTypes } from '@walletconnect/types'
import { DAppConnector } from '../../src/lib/dapp'
import { dAppMetadata, projectId } from '../_helpers'

/** Additional branch coverage part 3 */
describe('DAppConnector branch coverage 3', () => {
  it('connect handles missing walletConnectClient gracefully', async () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    const session: SessionTypes.Struct = {
      topic: 't',
      namespaces: { hedera: { accounts: ['hedera:testnet:0.0.1'], methods: [], events: [] } },
    } as any
    connector.walletConnectClient = { session: { update: jest.fn() } } as any
    jest.spyOn(connector as any, 'connectURI').mockResolvedValue({
      uri: 'wc',
      approval: jest.fn().mockImplementation(() => {
        connector.walletConnectClient = undefined
        return Promise.resolve(session)
      }),
    })
    const launch = jest.fn()
    const result = await connector.connect(launch, undefined, 'ext')
    expect(result).toBe(session)
    expect(launch).toHaveBeenCalledWith('wc')
  })

  it('checkIframeConnect skips callback when not provided', async () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    const session = {} as SessionTypes.Struct
    connector.extensions = [
      { id: 'iframe', available: true, availableInIframe: true, name: 'IframeExt' },
    ]
    const connectSpy = jest.spyOn(connector, 'connectExtension').mockResolvedValue(session)
    await (connector as any).checkIframeConnect()
    expect(connectSpy).toHaveBeenCalledWith('iframe')
  })

  it('verifyLastConnectedInstance does nothing when ids match', async () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    const restartSpy = jest.fn()
    connector.walletConnectClient = {
      core: {
        crypto: { randomSessionIdentifier: 'id' },
        storage: { getItem: jest.fn().mockResolvedValue('id'), setItem: jest.fn() },
        relayer: { restartTransport: restartSpy },
      },
    } as any
    await (connector as any).verifyLastConnectedInstance()
    expect(restartSpy).not.toHaveBeenCalled()
  })

  it('disconnectAll handles undefined session lists', async () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    const wcClient = {
      session: { getAll: jest.fn().mockReturnValue(undefined) },
      core: { pairing: { getPairings: jest.fn().mockReturnValue(undefined) } },
    }
    connector.walletConnectClient = wcClient as any
    await expect(connector.disconnectAll()).rejects.toThrow(
      'There is no active session/pairing. Connect to the wallet at first.'
    )
  })

  it('onSessionConnected ignores non-matching signer', async () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    const existingSigner = {
      getAccountId: () => ({ toString: () => '0.0.1' }),
      extensionId: undefined,
      getMetadata: () => ({ name: 'A' }),
      topic: 'old',
    }
    connector.signers = [existingSigner as any]
    connector.walletConnectClient = {} as any
    const disconnectSpy = jest.spyOn(connector, 'disconnect').mockResolvedValue(true)
    const newSession = {
      topic: 'new',
      namespaces: { hedera: { accounts: ['hedera:testnet:0.0.2'], methods: [], events: [] } },
    } as SessionTypes.Struct
    await (connector as any).onSessionConnected(newSession)
    expect(disconnectSpy).not.toHaveBeenCalled()
  })

  it('onSessionConnected ignores different extension and metadata', async () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    const existingSigner = {
      getAccountId: () => ({ toString: () => '0.0.1' }),
      extensionId: 'ext1',
      getMetadata: () => ({ name: 'A' }),
      topic: 'old',
    }
    connector.signers = [existingSigner as any]
    connector.walletConnectClient = {} as any
    const disconnectSpy = jest.spyOn(connector, 'disconnect').mockResolvedValue(true)
    const newSession = {
      topic: 'new',
      namespaces: { hedera: { accounts: ['hedera:testnet:0.0.1'], methods: [], events: [] } },
      sessionProperties: { extensionId: 'ext2' },
    } as any
    await (connector as any).onSessionConnected(newSession)
    expect(disconnectSpy).not.toHaveBeenCalled()
  })

  it('request throws when no signers and signerId omitted', async () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    connector.signers = []
    await expect(connector.request({ method: 'm' as any, params: {} } as any)).rejects.toThrow(
      'There is no active session. Connect to the wallet at first.'
    )
  })

  it('request throws when signer id not found among existing signers', async () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    const signer = { getAccountId: () => ({ toString: () => '0.0.1' }), request: jest.fn() }
    connector.signers = [signer as any]
    await expect(
      connector.request({ method: 'test' as any, params: { signerAccountId: 'hedera:testnet:0.0.2' } })
    ).rejects.toThrow('Signer not found for account ID: hedera:testnet:0.0.2. Did you use the correct format? e.g hedera:<network>:<address> ')
  })

  it('signTransaction fails when signer id does not match', async () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    connector.signers = [{ getAccountId: () => ({ toString: () => '0.0.1' }) } as any]
    const transaction = new TopicCreateTransaction()
    await expect(
      connector.signTransaction({ signerAccountId: 'hedera:testnet:0.0.2', transactionBody: transaction })
    ).rejects.toThrow('No signer found for account 0.0.2')
  })

  it('signTransaction errors when params missing', async () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    await expect(connector.signTransaction(undefined as any)).rejects.toThrow(
      'Transaction sent in incorrect format. Ensure transaction body is either a base64 transaction body or Transaction object.'
    )
  })
})
