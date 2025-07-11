import { buildApprovedNamespaces } from '@walletconnect/utils'
import { HederaChainId, HederaJsonRpcMethod, Wallet } from '../../src'
import { projectId, walletMetadata, defaultAccountNumber } from '../_helpers'

function createProposal() {
  return {
    id: 1,
    params: {
      relays: [],
      proposer: { publicKey: '0x', metadata: walletMetadata },
      requiredNamespaces: {
        hedera: {
          chains: [HederaChainId.Testnet],
          methods: [HederaJsonRpcMethod.GetNodeAddresses],
          events: [],
        },
      },
      optionalNamespaces: {},
      sessionProperties: {},
      scopedProperties: {},
      expiryTimestamp: Date.now(),
      pairingTopic: 'topic',
    },
  } as any
}

describe(Wallet.name + ' buildAndApproveSession', () => {
  it('builds namespaces and calls approveSession', async () => {
    const wallet = await Wallet.create(projectId, walletMetadata)

    const accounts = [`hedera:testnet:0.0.${defaultAccountNumber}`]
    const proposal = createProposal()
    const approveSessionSpy = jest
      .spyOn(wallet, 'approveSession')
      .mockResolvedValue('session' as any)

    const result = await wallet.buildAndApproveSession(accounts, proposal)

    const expectedNamespaces = buildApprovedNamespaces({
      proposal: proposal.params,
      supportedNamespaces: {
        hedera: {
          chains: ['hedera:testnet'],
          methods: wallet.methods,
          events: wallet.sessionEvents,
          accounts,
        },
      },
    })

    expect(approveSessionSpy).toHaveBeenCalledWith({
      id: proposal.id,
      namespaces: expectedNamespaces,
    })
    expect(result).toBe('session')
  })
})
