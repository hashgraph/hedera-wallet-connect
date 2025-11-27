import { Buffer } from 'buffer'
import { getSdkError } from '@walletconnect/utils'
import {
  Wallet as HederaWallet,
  Client,
  AccountId,
  Transaction,
  Query,
  PrecheckStatusError,
  PrivateKey,
} from '@hashgraph/sdk'
import { proto } from '@hashgraph/proto'
import {
  formatJsonRpcError,
  formatJsonRpcResult,
  JsonRpcError,
  JsonRpcResult,
} from '@walletconnect/jsonrpc-utils'

import {
  HederaChainId,
  HederaJsonRpcMethod,
  base64StringToQuery,
  Uint8ArrayToBase64String,
  stringToSignerMessage,
  signerSignaturesToSignatureMap,
  getHederaError,
  getRandomNodes,
  GetNodeAddressesResult,
  ExecuteTransactionResult,
  SignAndExecuteQueryResult,
  SignMessageResult,
  SignAndExecuteTransactionResult,
  SignTransactionResult,
  base64StringToTransaction,
  signatureMapToBase64String,
  WalletRequestEventArgs,
} from '../..'
import Provider from '../../lib/wallet/provider'

interface IInitArgs {
  chainId: HederaChainId
  accountId: AccountId | string
  privateKey: PrivateKey
  _provider?: Provider
}

export interface HIP820WalletInterface {
  approveSessionRequest(
    requestEvent: WalletRequestEventArgs,
  ): Promise<JsonRpcResult<any> | JsonRpcError>
  rejectSessionRequest(requestEvent: WalletRequestEventArgs): JsonRpcError

  getHederaWallet(): HederaWallet
  [HederaJsonRpcMethod.GetNodeAddresses](id: number, _: any): Promise<GetNodeAddressesResult>
  [HederaJsonRpcMethod.ExecuteTransaction](
    id: number,
    body: Transaction,
  ): Promise<ExecuteTransactionResult | JsonRpcError>
  [HederaJsonRpcMethod.SignMessage](id: number, body: string): Promise<SignMessageResult>
  [HederaJsonRpcMethod.SignAndExecuteQuery](
    id: number,
    body: Query<any>,
  ): Promise<SignAndExecuteQueryResult | JsonRpcError>
  [HederaJsonRpcMethod.SignAndExecuteTransaction](
    id: number,
    body: Transaction,
  ): Promise<SignAndExecuteTransactionResult | JsonRpcError>
  [HederaJsonRpcMethod.SignTransaction](
    id: number,
    body: Uint8Array,
  ): Promise<SignTransactionResult>
}

export class HIP820Wallet implements HIP820WalletInterface {
  wallet: HederaWallet
  /*
   * Set default values for chains, methods, events
   */
  constructor(wallet: HederaWallet) {
    this.wallet = wallet
  }

  /*
   * Hedera Wallet Signer
   */
  public getHederaWallet(): HederaWallet {
    return this.wallet
  }

  static init({ chainId, accountId, privateKey, _provider }: IInitArgs) {
    const network = chainId.split(':')[1]
    const client = Client.forName(network)
    const provider = _provider ?? new Provider(client)
    const wallet = new HederaWallet(accountId, privateKey, provider)
    return new HIP820Wallet(wallet)
  }

  /*
   *  Session Requests
   */
  public validateParam(name: string, value: any, expectedType: string) {
    if (expectedType === 'array' && Array.isArray(value)) return
    if (typeof value === expectedType) return

    throw getHederaError<string>(
      'INVALID_PARAMS',
      `Invalid paramameter value for ${name}, expected ${expectedType} but got ${typeof value}`,
    )
  }

  public parseSessionRequest(
    event: WalletRequestEventArgs,
    // optional arg to throw error if request is invalid, call with shouldThrow = false when calling from rejectSessionRequest as we only need id and top to send reject response
    shouldThrow = true,
  ): {
    method: HederaJsonRpcMethod
    chainId: HederaChainId
    id: number // session request id
    topic: string // session topic
    body?: Transaction | Query<any> | string | Uint8Array | undefined
    accountId?: AccountId
  } {
    const { id, topic } = event
    const {
      request: { method, params },
      chainId,
    } = event.params

    let body: Transaction | Query<any> | string | Uint8Array | undefined
    // get account id from optional second param for transactions and queries or from transaction id
    // this allows for the case where the requested signer is not the payer, but defaults to the payer if a second param is not provided
    let signerAccountId: AccountId | undefined
    // First test for valid params for each method
    // then convert params to a body that the respective function expects
    try {
      switch (method) {
        case HederaJsonRpcMethod.GetNodeAddresses: {
          // 1
          if (params) throw getHederaError('INVALID_PARAMS')
          break
        }
        case HederaJsonRpcMethod.ExecuteTransaction: {
          // 2
          const { transactionList } = params
          this.validateParam('transactionList', transactionList, 'string')
          body = base64StringToTransaction(transactionList)
          break
        }
        case HederaJsonRpcMethod.SignMessage: {
          // 3
          const { signerAccountId: _accountId, message } = params
          this.validateParam('signerAccountId', _accountId, 'string')
          this.validateParam('message', message, 'string')
          signerAccountId = AccountId.fromString(_accountId.replace(chainId + ':', ''))
          body = message
          break
        }
        case HederaJsonRpcMethod.SignAndExecuteQuery: {
          // 4
          const { signerAccountId: _accountId, query } = params
          this.validateParam('signerAccountId', _accountId, 'string')
          this.validateParam('query', query, 'string')
          signerAccountId = AccountId.fromString(_accountId.replace(chainId + ':', ''))
          body = base64StringToQuery(query)
          break
        }
        case HederaJsonRpcMethod.SignAndExecuteTransaction: {
          // 5
          const { signerAccountId: _accountId, transactionList } = params
          this.validateParam('signerAccountId', _accountId, 'string')
          this.validateParam('transactionList', transactionList, 'string')

          signerAccountId = AccountId.fromString(_accountId.replace(chainId + ':', ''))
          body = base64StringToTransaction(transactionList)
          break
        }
        case HederaJsonRpcMethod.SignTransaction: {
          // 6
          const { signerAccountId: _accountId, transactionBody } = params
          this.validateParam('signerAccountId', _accountId, 'string')
          this.validateParam('transactionBody', transactionBody, 'string')
          signerAccountId = AccountId.fromString(_accountId.replace(chainId + ':', ''))
          body = Buffer.from(transactionBody, 'base64')
          break
        }
        case HederaJsonRpcMethod.SignTransactions: {
          // 7 - HIP-1190
          const { signerAccountId: _accountId, transactionBody, nodeCount } = params
          this.validateParam('signerAccountId', _accountId, 'string')
          this.validateParam('transactionBody', transactionBody, 'string')
          
          if (nodeCount !== undefined) {
            this.validateParam('nodeCount', nodeCount, 'number')
            
            if (nodeCount <= 0) {
              throw getHederaError(
                'INVALID_PARAMS',
                'nodeCount must be a positive number'
              )
            }
          }
          
          signerAccountId = AccountId.fromString(_accountId.replace(chainId + ':', ''))
          body = Buffer.from(transactionBody, 'base64')
          
          // Store nodeCount for handler method
          ;(body as any).__nodeCount = nodeCount ?? 5
          
          break
        }
        default:
          throw getSdkError('INVALID_METHOD')
      }
      // error parsing request params
    } catch (e) {
      if (shouldThrow) throw e
    }

    return {
      method: method as HederaJsonRpcMethod,
      chainId: chainId as HederaChainId,
      id,
      topic,
      body,
      accountId: signerAccountId,
    }
  }

  public async approveSessionRequest(
    event: WalletRequestEventArgs,
  ): Promise<JsonRpcResult<any> | JsonRpcError> {
    const { method, id, body } = this.parseSessionRequest(event)
    
    // Extract nodeCount if it exists (for HIP-1190)
    const nodeCount = (body as any)?.__nodeCount
    
    // Call the method with appropriate parameters
    const response = nodeCount !== undefined 
      ? await this[method](id, body, nodeCount)
      : await this[method](id, body)
      
    return response
  }

  rejectSessionRequest(requestEvent: WalletRequestEventArgs) {
    const { id } = requestEvent

    return formatJsonRpcError(id, getSdkError('USER_REJECTED').message)
  }

  /*
   * JSON RPC Methods
   */
  // 1. hedera_getNodeAddresses
  public async hedera_getNodeAddresses(
    id: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _: any, // ignore this param to be consistent call signature with other functions
  ) {
    const nodesAccountIds = this.wallet.getNetwork()
    const nodes = Object.values(nodesAccountIds).map((nodeAccountId) =>
      nodeAccountId.toString(),
    )
    return formatJsonRpcResult(id, {
      nodes,
    })
  }

  // 2. hedera_executeTransaction
  public async hedera_executeTransaction(
    id: number,
    signedTransaction: Transaction,
  ): Promise<ExecuteTransactionResult | JsonRpcError> {
    try {
      const response = await this.wallet.call(signedTransaction)
      return formatJsonRpcResult(id, response.toJSON())
    } catch (e) {
      if (e instanceof PrecheckStatusError) {
        // HIP-820 error format
        return formatJsonRpcError(id, {
          code: 9000,
          message: e.message,
          data: e.status._code.toString(),
        })
      }
      return formatJsonRpcError(id, { code: 9000, message: 'Unknown Error' })
    }
  }
  // 3. hedera_signMessage
  public async hedera_signMessage(id: number, body: string) {
    // signer takes an array of Uint8Arrays though spec allows for 1 message to be signed
    const signerSignatures = await this.wallet.sign(stringToSignerMessage(body))

    const _signatureMap = proto.SignatureMap.create(
      signerSignaturesToSignatureMap(signerSignatures),
    )

    const signatureMap = signatureMapToBase64String(_signatureMap)

    return formatJsonRpcResult(id, {
      signatureMap,
    })
  }

  // 4. hedera_signAndExecuteQuery
  public async hedera_signAndExecuteQuery(id: number, body: Query<any>) {
    /*
     * Can be used with return values the have a toBytes method implemented
     * For example:
     * https://github.com/hashgraph/hedera-sdk-js/blob/c4438cbaa38074d8bfc934dba84e3b430344ed89/src/account/AccountInfo.js#L402
     */
    try {
      const queryResult = await body.executeWithSigner(this.wallet)
      let queryResponse = ''
      if (Array.isArray(queryResult)) {
        queryResponse = queryResult
          .map((qr) => Uint8ArrayToBase64String(qr.toBytes()))
          .join(',')
      } else {
        queryResponse = Uint8ArrayToBase64String(queryResult.toBytes())
      }

      return formatJsonRpcResult(id, {
        response: queryResponse,
      })
    } catch (e) {
      if (e instanceof PrecheckStatusError) {
        // HIP-820 error format
        return formatJsonRpcError(id, {
          code: 9000,
          message: e.message,
          data: e.status._code.toString(),
        })
      }
      return formatJsonRpcError(id, { code: 9000, message: 'Unknown Error' })
    }
  }

  // 5. hedera_signAndExecuteTransaction
  public async hedera_signAndExecuteTransaction(id: number, transaction: Transaction) {
    // check transaction is incomplete (HIP-745)
    if (!transaction.isFrozen()) {
      // set multiple nodeAccountIds and transactionId if not present
      await transaction.freezeWithSigner(this.wallet)
    }

    const signedTransaction = await transaction.signWithSigner(this.wallet)
    try {
      const response = await signedTransaction.executeWithSigner(this.wallet)
      return formatJsonRpcResult(id, response.toJSON())
    } catch (e) {
      if (e instanceof PrecheckStatusError) {
        // HIP-820 error format
        return formatJsonRpcError(id, {
          code: 9000,
          message: e.message,
          data: e.status._code.toString(),
        })
      }
      return formatJsonRpcError(id, { code: 9000, message: 'Unknown Error' })
    }
  }

  // 6. hedera_signTransaction
  public async hedera_signTransaction(id: number, body: Uint8Array) {
    const signerSignatures = await this.wallet.sign([body])

    const _signatureMap = proto.SignatureMap.create(
      signerSignaturesToSignatureMap(signerSignatures),
    )

    const signatureMap = signatureMapToBase64String(_signatureMap)

    return formatJsonRpcResult(id, {
      signatureMap,
    })
  }

  /**
   * 7. hedera_signTransactions (HIP-1190)
   */
  public async hedera_signTransactions(id: number, body: Uint8Array, nodeCount: number = 5) {
    try {
      let transactionBody: proto.ITransactionBody
      try {
        transactionBody = proto.TransactionBody.decode(body)
      } catch (error: any) {
        return formatJsonRpcError(id, {
          code: -32602,
          message: `Failed to decode transaction body: ${error.message}`,
        })
      }

      if (transactionBody.nodeAccountID) {
        return formatJsonRpcError(id, {
          code: -32602,
          message:
            'Transaction body must not have nodeAccountId set. ' +
            'The wallet assigns multiple random nodes for HIP-1190 multi-node signing.',
        })
      }

      const network = this.wallet.getNetwork()

      let selectedNodes: AccountId[]
      try {
        selectedNodes = getRandomNodes(network, nodeCount)
      } catch (error: any) {
        return formatJsonRpcError(id, {
          code: -32603,
          message: `Node selection failed: ${error.message}`,
        })
      }

      const signatureMaps: string[] = []
      const nodeAccountIds: string[] = []

      for (const nodeAccountId of selectedNodes) {
        const txBodyWithNode: proto.ITransactionBody = {
          ...transactionBody,
          nodeAccountID: {
            shardNum: nodeAccountId.shard,
            realmNum: nodeAccountId.realm,
            accountNum: nodeAccountId.num,
          },
        }

        const bodyWithNode = proto.TransactionBody.encode(txBodyWithNode).finish()
        const signerSignatures = await this.wallet.sign([bodyWithNode])
        const _signatureMap = proto.SignatureMap.create(
          signerSignaturesToSignatureMap(signerSignatures),
        )
        const signatureMap = signatureMapToBase64String(_signatureMap)
        signatureMaps.push(signatureMap)
        nodeAccountIds.push(nodeAccountId.toString())
      }

      return formatJsonRpcResult(id, { signatureMaps, nodeAccountIds })
    } catch (error: any) {
      return formatJsonRpcError(id, {
        code: -32603,
        message: `Unexpected error: ${error.message}`,
      })
    }
  }
}

export default HIP820Wallet
