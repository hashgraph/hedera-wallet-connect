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
