import { RequestType, type Transaction } from '@hashgraph/sdk'
import { EngineTypes } from '@walletconnect/types'
import { transactionToBase64String } from './utils'
import {
  HederaSignAndExecuteTransactionParams,
  HederaSignAndReturnTransactionParams,
  HederaSignMessageParams,
} from '../types'
import { HederaJsonRpcMethods } from './constants'

export function buildSignMessageParams(message: string): HederaSignMessageParams {
  return {
    message: Buffer.from(message).toString('base64'),
  }
}

function _buildTransactionParams(type: RequestType, transaction: Transaction) {
  return {
    transaction: {
      type: type.toString(),
      bytes: transactionToBase64String(transaction),
    },
  }
}

export function buildSignAndExecuteTransactionParams(
  type: RequestType,
  transaction: Transaction,
): HederaSignAndExecuteTransactionParams {
  return _buildTransactionParams(type, transaction)
}

export function buildSignAndReturnTransactionParams(
  type: RequestType,
  transaction: Transaction,
): HederaSignAndReturnTransactionParams {
  return _buildTransactionParams(type, transaction)
}

type HederaSessionRequestOptions = Pick<
  EngineTypes.RequestParams,
  'chainId' | 'topic' | 'expiry'
>
export class HederaSessionRequest {
  public chainId: HederaSessionRequestOptions['chainId']
  public topic: HederaSessionRequestOptions['topic']
  public expiry: HederaSessionRequestOptions['expiry']

  constructor({ chainId, topic, expiry }: HederaSessionRequestOptions) {
    this.chainId = chainId
    this.topic = topic
    this.expiry = expiry
  }

  public static create(options: HederaSessionRequestOptions) {
    return new HederaSessionRequest(options)
  }

  public buildSignAndExecuteTransactionRequest(type: RequestType, transaction: Transaction) {
    return {
      ...this._buildFixedSessionRequestData(),
      request: {
        method: HederaJsonRpcMethods.SIGN_AND_EXECUTE_TRANSACTION,
        params: buildSignAndExecuteTransactionParams(type, transaction),
      },
    }
  }

  public buildSignAndReturnTransactionRequest(type: RequestType, transaction: Transaction) {
    return {
      ...this._buildFixedSessionRequestData(),
      request: {
        method: HederaJsonRpcMethods.SIGN_AND_RETURN_TRANSACTION,
        params: buildSignAndReturnTransactionParams(type, transaction),
      },
    }
  }

  public buildSignMessageRequest(message: string) {
    return {
      ...this._buildFixedSessionRequestData(),
      request: {
        method: HederaJsonRpcMethods.SIGN_MESSAGE,
        params: buildSignMessageParams(message),
      },
    }
  }

  private _buildFixedSessionRequestData() {
    return {
      chainId: this.chainId,
      topic: this.topic,
      expiry: this.expiry,
    }
  }
}
