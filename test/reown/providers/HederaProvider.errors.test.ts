import { TopicCreateTransaction } from '@hiero-ledger/sdk'
import { HederaProvider } from '../../../src'
import { testUserAccountId, requestTopic } from '../../_helpers'

describe('HederaProvider signTransaction errors', () => {
  let provider: HederaProvider

  beforeEach(async () => {
    provider = await HederaProvider.init({ projectId: 'pid', logger: 'error' })
    provider.namespaces = { hedera: { chains: ['hedera:testnet'], accounts: [], methods: [], events: [], rpcMap: {} } } as any
    provider.client = {} as any
  })

  it('throws when session not initialized', async () => {
    await expect(
      provider.hedera_signTransaction({
        signerAccountId: testUserAccountId.toString(),
        transactionBody: new TopicCreateTransaction(),
      } as any),
    ).rejects.toThrow('Session not initialized')
  })

  it('throws when nativeProvider not set', async () => {
    provider.session = { topic: requestTopic, namespaces: { hedera: { accounts: [`hedera:testnet:${testUserAccountId}`] } } } as any
    await expect(
      provider.hedera_signTransaction({
        signerAccountId: testUserAccountId.toString(),
        transactionBody: new TopicCreateTransaction(),
      } as any),
    ).rejects.toThrow('nativeProvider not initialized')
  })

  it('throws for invalid transaction format', async () => {
    provider.session = { topic: requestTopic, namespaces: { hedera: { accounts: [`hedera:testnet:${testUserAccountId}`] } } } as any
    provider.nativeProvider = { requestAccounts: () => [testUserAccountId.toString()] } as any
    await expect(
      provider.hedera_signTransaction({
        signerAccountId: testUserAccountId.toString(),
        transactionBody: {} as any,
      }),
    ).rejects.toThrow('Transaction sent in incorrect format')
  })

  it('throws when signer not found', async () => {
    provider.session = { topic: requestTopic, namespaces: { hedera: { accounts: [`hedera:testnet:${testUserAccountId}`] } } } as any
    provider.nativeProvider = { requestAccounts: () => ['0.0.999'] } as any
    await expect(
      provider.hedera_signTransaction({
        signerAccountId: testUserAccountId.toString(),
        transactionBody: new TopicCreateTransaction(),
      }),
    ).rejects.toThrow('Signer not found')
  })
})
