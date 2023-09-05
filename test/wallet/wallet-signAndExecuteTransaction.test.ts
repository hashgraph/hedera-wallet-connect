import { TopicCreateTransaction, Transaction } from '@hashgraph/sdk'
import { HederaWallet } from '../../src'
import {
  defaultAccountNumber,
  prepareTestTransaction,
  testPrivateKeyECDSA,
  useJsonFixture,
} from '../_helpers'

describe(HederaWallet.name, () => {
  describe('signAndExecuteTransaction', () => {
    it('should sign and execute, returning the transaction response and receipt', async () => {
      const mockResult = useJsonFixture('signAndExecuteTransactionSuccess')
      const wallet = HederaWallet.init({
        network: 'testnet',
        accountId: defaultAccountNumber,
        privateKey: testPrivateKeyECDSA,
      })
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })
      const transactionExecuteSpy = jest
        .spyOn(Transaction.prototype, 'execute')
        .mockImplementation(async () => {
          return {
            getReceipt: () => mockResult.receipt,
            toJSON: () => mockResult.response,
          } as any
        })
      const result = await wallet.signAndExecuteTransaction(transaction)
      expect(result).toEqual(mockResult)
      transactionExecuteSpy.mockRestore()
    })
  })
})
