import { RequestType, TopicCreateTransaction } from '@hashgraph/sdk'
import { HederaWallet } from '../../src'
import {
  defaultAccountNumber,
  prepareTestTransaction,
  testPrivateKeyECDSA,
  useJsonFixture,
} from '../_helpers'

describe(HederaWallet.name, () => {
  describe('signAndReturnTransaction', () => {
    it('should sign a transaction and return without executing', async () => {
      const wallet = HederaWallet.init({
        network: 'testnet',
        accountId: defaultAccountNumber,
        privateKey: testPrivateKeyECDSA,
      })
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), { freeze: true })

      const result = await wallet.signAndReturnTransaction(
        transaction,
        RequestType.ConsensusCreateTopic.toString(),
      )
      const expected = useJsonFixture('signAndReturnTransactionSuccess')
      expect(result).toEqual(expected)
    })
  })
})
