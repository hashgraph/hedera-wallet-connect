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

import { AccountId, TopicCreateTransaction } from '@hashgraph/sdk'
import {
  transactionToBase64String,
  freezeTransaction,
  setDefaultNodeAccountIds,
  base64StringToTransaction,
} from '../src'
import { prepareTestTransaction, useJsonFixture } from './_helpers'

describe(freezeTransaction.name, () => {
  it('should freeze an unfrozen transaction', () => {
    const txn = prepareTestTransaction(new TopicCreateTransaction())

    expect(txn.isFrozen()).toBe(false)

    freezeTransaction(txn)

    expect(txn.isFrozen()).toBe(true)
  })

  it('should have no effect on a frozen transaction', () => {
    const txn = prepareTestTransaction(new TopicCreateTransaction())
    txn.freeze()

    expect(txn.isFrozen()).toBe(true)

    freezeTransaction(txn)

    expect(txn.isFrozen()).toBe(true)
  })
})

describe(setDefaultNodeAccountIds.name, () => {
  it('should set default node account ids if none are set', () => {
    const txn = new TopicCreateTransaction()

    expect(txn.nodeAccountIds).toBeNull()

    setDefaultNodeAccountIds(txn)
    const result = txn.nodeAccountIds?.map((id) => id.toString())

    expect(result).toEqual(['0.0.3'])
  })

  it('should do nothing if node account ids are already set', () => {
    const txn = new TopicCreateTransaction()
    txn.setNodeAccountIds([new AccountId(4)])

    setDefaultNodeAccountIds(txn)
    const result = txn.nodeAccountIds?.map((id) => id.toString())

    expect(result).toEqual(['0.0.4'])
  })
})

describe(transactionToBase64String.name, () => {
  it('should convert a transaction to a base64 encoded string', () => {
    const txn = prepareTestTransaction(new TopicCreateTransaction())
    const result = transactionToBase64String(txn)
    const { expected } = useJsonFixture('transactionToBase64StringResult')

    expect(result).toBe(expected)
  })
})

describe(base64StringToTransaction.name, () => {
  it('should create a transaction from a base64 string', () => {
    const txn = prepareTestTransaction(new TopicCreateTransaction())
    txn.setTransactionMemo('I should be restored')
    const str = transactionToBase64String(txn)

    const resultWithParam = base64StringToTransaction<TopicCreateTransaction>(str)
    const resultWithoutParam = base64StringToTransaction(str)

    expect(resultWithParam).toBeInstanceOf(TopicCreateTransaction)
    expect(resultWithoutParam).toBeInstanceOf(TopicCreateTransaction)
    expect(resultWithParam.transactionMemo).toBe('I should be restored')
  })
})
