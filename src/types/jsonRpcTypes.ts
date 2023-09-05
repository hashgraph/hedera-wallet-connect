import { TransactionReceipt, TransactionResponseJSON } from '@hashgraph/sdk'

type TransactionParams = {
  transaction: {
    type: string
    bytes: string // should be a base64 encoded string of a Uint8Array
  }
}

/** hedera_signAndExecuteTransaction */
export type HederaSignAndExecuteTransactionParams = TransactionParams
export type HederaSignAndExecuteTransactionResponse = {
  response: TransactionResponseJSON
  receipt: TransactionReceipt
}

/** hedera_signAndReturnTransaction */
export type HederaSignAndReturnTransactionParams = TransactionParams
export type HederaSignAndReturnTransactionResponse = TransactionParams

/** hedera_signMessage */
export type HederaSignMessageParams = {
  message: string
}
export type HederaSignMessageResponse = {
  signature: string
}
