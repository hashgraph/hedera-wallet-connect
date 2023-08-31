import { RequestType, TopicCreateTransaction, TopicDeleteTransaction } from '@hashgraph/sdk'
import { HederaJsonRpcMethods, HederaSessionRequest } from '../../src'
import { prepareTestTransaction, useJsonFixture } from '../_helpers'

const CHAIN_ID = 'hedera:testnet'
const TOPIC = 'abcdef123456'

describe(HederaSessionRequest.name, () => {
  describe('create', () => {
    it('should init with just topic and chainId', () => {
      const result = HederaSessionRequest.create({ chainId: CHAIN_ID, topic: TOPIC })
      const expected = { chainId: CHAIN_ID, topic: TOPIC, expiry: undefined }

      expect(result).toEqual(expected)
    })

    it('should init with optional expiry value', () => {
      const result = HederaSessionRequest.create({
        chainId: CHAIN_ID,
        topic: TOPIC,
        expiry: 1000,
      })
      const expected = { chainId: CHAIN_ID, topic: TOPIC, expiry: 1000 }

      expect(result).toEqual(expected)
    })
  })

  describe('buildSignAndExecuteTransactionRequest', () => {
    it(`should build request with ${HederaJsonRpcMethods.SIGN_AND_EXECUTE_TRANSACTION} params`, () => {
      const type = RequestType.ConsensusCreateTopic
      const transaction = prepareTestTransaction(new TopicCreateTransaction())

      const result = HederaSessionRequest.create({
        chainId: CHAIN_ID,
        topic: TOPIC,
      }).buildSignAndExecuteTransactionRequest(type, transaction)

      const expected = {
        chainId: CHAIN_ID,
        topic: TOPIC,
        expiry: undefined,
        request: {
          method: HederaJsonRpcMethods.SIGN_AND_EXECUTE_TRANSACTION,
          params: useJsonFixture('buildSignAndExecuteTransactionParamsResult'),
        },
      }

      expect(result).toEqual(expected)
    })
  })

  describe('buildSignAndReturnTransactionRequest', () => {
    it(`should build request with ${HederaJsonRpcMethods.SIGN_AND_RETURN_TRANSACTION} params`, () => {
      const type = RequestType.ConsensusDeleteTopic
      const transaction = prepareTestTransaction(new TopicDeleteTransaction())

      const result = HederaSessionRequest.create({
        chainId: CHAIN_ID,
        topic: TOPIC,
      }).buildSignAndReturnTransactionRequest(type, transaction)

      const expected = {
        chainId: CHAIN_ID,
        topic: TOPIC,
        expiry: undefined,
        request: {
          method: HederaJsonRpcMethods.SIGN_AND_RETURN_TRANSACTION,
          params: useJsonFixture('buildSignAndReturnTransactionParamsResult'),
        },
      }

      expect(result).toEqual(expected)
    })
  })

  describe('buildSignMessageRequest', () => {
    it(`should build request with ${HederaJsonRpcMethods.SIGN_MESSAGE} params`, () => {
      const result = HederaSessionRequest.create({
        chainId: CHAIN_ID,
        topic: TOPIC,
      }).buildSignMessageRequest('Test me')

      const expected = {
        chainId: CHAIN_ID,
        topic: TOPIC,
        expiry: undefined,
        request: {
          method: HederaJsonRpcMethods.SIGN_MESSAGE,
          params: useJsonFixture('buildSignMessageParamsResult'),
        },
      }

      expect(result).toEqual(expected)
    })
  })
})
