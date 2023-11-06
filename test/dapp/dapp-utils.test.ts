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

import { RequestType, TopicCreateTransaction, TopicDeleteTransaction } from '@hashgraph/sdk'
import {
  buildSignAndExecuteTransactionParams,
  buildSignAndReturnTransactionParams,
  buildSignMessageParams,
} from '../../src'
import { prepareTestTransaction, useJsonFixture, writeJsonFixture } from '../_helpers'

describe(buildSignMessageParams.name, () => {
  it('should build params with base64 encoded message', () => {
    const msg = 'Test me'
    const result = buildSignMessageParams(msg)
    const expected = useJsonFixture('buildSignMessageParamsResult')

    expect(result).toEqual(expected)
  })
})

describe(buildSignAndExecuteTransactionParams.name, () => {
  it('should build transaction params with type and bytes', () => {
    const type = RequestType.ConsensusCreateTopic
    const transaction = prepareTestTransaction(new TopicCreateTransaction())

    const result = buildSignAndExecuteTransactionParams(type, transaction)
    const expected = useJsonFixture('buildSignAndExecuteTransactionParamsResult')

    expect(result).toEqual(expected)
  })
})

describe(buildSignAndReturnTransactionParams.name, () => {
  it('should build transaction params with type and bytes', () => {
    const type = RequestType.ConsensusDeleteTopic
    const transaction = prepareTestTransaction(new TopicDeleteTransaction())

    const result = buildSignAndReturnTransactionParams(type, transaction)
    const expected = useJsonFixture('buildSignAndReturnTransactionParamsResult')

    expect(result).toEqual(expected)
  })
})
