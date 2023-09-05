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
