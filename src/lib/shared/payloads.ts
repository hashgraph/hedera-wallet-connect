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

import { JsonRpcResult } from '@walletconnect/jsonrpc-types'
import { EngineTypes } from '@walletconnect/types'
import type { TransactionResponseJSON } from '@hashgraph/sdk'
import { HederaJsonRpcMethod } from './methods'

/**
 * Defines various types and interfaces for Hedera JSON-RPC methods.
 */

/*
 * 1. hedera_getNodeAddresses
 */
// params
export type GetNodeAddressesParams = undefined
// request
export interface GetNodeAddressesRequest extends EngineTypes.RequestParams {
  request: {
    method: HederaJsonRpcMethod.GetNodeAddresses
    params: GetNodeAddressesParams
  }
}
// result
export interface GetNodeAddressesResult extends JsonRpcResult<{ nodes: string[] }> {}
// response
export interface GetNodeAddresesResponse extends EngineTypes.RespondParams {
  response: GetNodeAddressesResult
}

/*
 * 2. hedera_executeTransaction
 */

// params
export interface ExecuteTransactionParams {
  /*
   * transactionList - Base64-encoded `TransactionList`
   */
  transactionList: string
}
// request
export interface ExecuteTransactionRequest extends EngineTypes.RequestParams {
  request: {
    method: HederaJsonRpcMethod.ExecuteTransaction
    params: ExecuteTransactionParams
  }
}
// result
export interface ExecuteTransactionResult extends JsonRpcResult<TransactionResponseJSON> {}
// response
export interface ExecuteTransactionResponse extends EngineTypes.RespondParams {
  response: ExecuteTransactionResult
}

/*
 * 3. hedera_signMessage
 */
// params
export interface SignMessageParams {
  /*
   * signerAccountId - a Hedera Account identifier in [HIP-30](https://hips.hedera.com/hip/hip-30) (`<nework>:<shard>.<realm>.<num>`) form.
   */
  signerAccountId: string
  /*
   * message - a plain text string to present to the user prior to authorizing a signature
   */
  message: string
}
// request
export interface SignMessageRequest extends EngineTypes.RequestParams {
  request: {
    method: HederaJsonRpcMethod.SignMessage
    params: SignMessageParams
  }
}
// result
export interface SignMessageResult extends JsonRpcResult<{ signatureMap: string }> {}
// response
export interface SignMessageResponse extends EngineTypes.RespondParams {
  response: SignMessageResult
}

/*
 * 4. hedera_signAndExecuteQuery
 */
// params
export interface SignAndExecuteQueryParams {
  signerAccountId: string
  query: string
}
// request
export interface SignAndExecuteQueryRequest extends EngineTypes.RequestParams {
  request: {
    method: HederaJsonRpcMethod.SignAndExecuteQuery
    params: SignAndExecuteQueryParams
  }
}
// result
export interface SignAndExecuteQueryResult extends JsonRpcResult<{ response: string }> {}
// response
export interface SignAndExecuteQueryResponse extends EngineTypes.RespondParams {
  response: SignAndExecuteQueryResult
}

/*
 * 5. hedera_signAndExecuteTransaction
 */
// params
export interface SignAndExecuteTransactionParams {
  signerAccountId: string
  transactionList: string
}
// request
export interface SignAndExecuteTransactionRequest extends EngineTypes.RequestParams {
  request: {
    method: HederaJsonRpcMethod.SignAndExecuteTransaction
    params: SignAndExecuteTransactionParams
  }
}

// result
export interface SignAndExecuteTransactionResult
  extends JsonRpcResult<TransactionResponseJSON> {}

// response
export interface SignAndExecuteTransactionResponse extends EngineTypes.RespondParams {
  response: SignAndExecuteTransactionResult
}
/*
 * 6. hedera_signTransaction
 */

// params
export interface SignTransactionParams {
  signerAccountId: string
  transactionBody: string
}

//request
export interface SignTransactionRequest extends EngineTypes.RequestParams {
  request: {
    method: HederaJsonRpcMethod.SignTransaction
    params: SignTransactionParams
  }
}

// result
export interface SignTransactionResult extends JsonRpcResult<{ signatureMap: string }> {}

// response
export interface SignTransactionResponse extends EngineTypes.RespondParams {
  response: SignTransactionResult
}
