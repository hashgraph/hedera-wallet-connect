import { LedgerId } from '@hashgraph/sdk'
import { SessionTypes } from '@walletconnect/types'
import { DAppConnector } from '../../src/lib/dapp'
import { dAppMetadata, projectId } from '../_helpers'

/** Additional branch coverage for DAppConnector */
describe('DAppConnector branch coverage', () => {
  it('setLogLevel is noop with custom logger', () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    const customLogger = { setLogLevel: jest.fn() }
    ;(connector as any).logger = customLogger as any
    connector.setLogLevel('error')
    expect(customLogger.setLogLevel).not.toHaveBeenCalled()
  })

  it('openModal resolves when modal stays open', async () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    const session = {
      topic: 't',
      namespaces: { hedera: { accounts: ['hedera:testnet:0.0.1'], methods: [], events: [] } },
    } as SessionTypes.Struct
    connector.walletConnectClient = {} as any
    connector.walletConnectModal = {
      openModal: jest.fn(),
      closeModal: jest.fn(),
      subscribeModal: jest.fn(cb => cb({ open: true })),
    } as any
    jest.spyOn(connector as any, 'connectURI').mockResolvedValue({ uri: 'wc:1', approval: jest.fn().mockResolvedValue(session) })
    const result = await connector.openModal(undefined, true)
    expect(result).toBe(session)
    expect(connector.walletConnectModal.closeModal).toHaveBeenCalled()
  })

  it('connect skips update when extensionId missing', async () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    const session = {
      topic: 'x',
      namespaces: { hedera: { accounts: ['hedera:testnet:0.0.1'], methods: [], events: [] } },
    } as SessionTypes.Struct
    connector.walletConnectClient = { session: { update: jest.fn() } } as any
    jest.spyOn(connector as any, 'connectURI').mockResolvedValue({ uri: 'wc', approval: jest.fn().mockResolvedValue(session) })
    const launch = jest.fn()
    const result = await connector.connect(launch)
    expect(launch).toHaveBeenCalledWith('wc')
    expect((connector.walletConnectClient as any).session.update).not.toHaveBeenCalled()
    expect(result).toBe(session)
  })

  it('checkIframeConnect does nothing when no iframe extension', async () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    const spy = jest.spyOn(connector, 'connectExtension')
    await (connector as any).checkIframeConnect()
    expect(spy).not.toHaveBeenCalled()
  })
})
