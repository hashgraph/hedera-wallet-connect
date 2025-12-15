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

import { Buffer } from 'buffer'
import { Core } from '@walletconnect/core'
import { WalletKit, WalletKitTypes } from '@reown/walletkit'
import { SessionTypes } from '@walletconnect/types'
import { buildApprovedNamespaces, getSdkError } from '@walletconnect/utils'
import { Wallet as HederaWallet, Client, AccountId, Transaction, Query } from '@hashgraph/sdk'

import {
  HederaChainId,
  HederaSessionEvent,
  HederaJsonRpcMethod,
  base64StringToQuery,
  Uint8ArrayToBase64String,
  stringToSignerMessage,
  signatureMapToBase64String,
  signerSignaturesToSignatureMap,
  base64StringToTransaction,
  getHederaError,
  getRandomNodes,
  GetNodeAddresesResponse,
  ExecuteTransactionResponse,
  SignMessageResponse,
  SignAndExecuteQueryResponse,
  SignAndExecuteTransactionResponse,
  SignTransactionResponse,
  SignTransactionsResponse,
} from '../shared'
import { proto } from '@hashgraph/proto'
import Provider from './provider'
import type { HederaNativeWallet } from './types'

export type { HederaNativeWallet } from './types'
export { default as WalletProvider } from './provider'

/*
 *
 * @see {@link https://github.com/WalletConnect/walletconnect-monorepo/blob/v2.0/packages/web3wallet/src/client.ts}
 */
export class HederaWeb3Wallet extends WalletKit implements HederaNativeWallet {
  /*
   * Set default values for chains, methods, events
   */
  constructor(
    opts: WalletKitTypes.Options,
    public chains: HederaChainId[] | string[] = Object.values(HederaChainId),
    public methods: string[] = Object.values(HederaJsonRpcMethod),
    public sessionEvents: HederaSessionEvent[] | string[] = Object.values(HederaSessionEvent),
  ) {
    super(opts)
  }

  // wrapper to reduce needing to instantiate Core object on client, also add hedera sensible defaults
  static async create(
    projectId: string,
    metadata: WalletKitTypes.Metadata,
    chains?: HederaChainId[],
    methods?: string[],
    sessionEvents?: HederaSessionEvent[] | string[],
  ) {
    const wallet = new HederaWeb3Wallet(
      { core: new Core({ projectId }), metadata },
      chains,
      methods,
      sessionEvents,
    )

    //https://github.com/WalletConnect/walletconnect-monorepo/blob/14f54684c3d89a5986a68f4dd700a79a958f1604/packages/web3wallet/src/client.ts#L178
    wallet.logger.trace(`Initialized`)
    try {
      await wallet.engine.init()
      wallet.logger.info(`Web3Wallet Initialization Success`)
    } catch (error: any) {
      wallet.logger.info(`Web3Wallet Initialization Failure`)
      wallet.logger.error(error.message)
      throw error
    }

    return wallet
  }

  /*
   * Hedera Wallet Signer
   */
  public getHederaWallet(
    chainId: HederaChainId,
    accountId: AccountId | string,
    privateKey: string,
    _provider?: Provider,
  ): HederaWallet {
    const network = chainId.split(':')[1]
    const client = Client.forName(network)
    const provider = _provider ?? new Provider(client)
    return new HederaWallet(accountId, privateKey, provider)
  }

  /*
   * Session proposal
   */
  public async buildAndApproveSession(
    accounts: string[],
    { id, params }: WalletKitTypes.SessionProposal,
  ): Promise<SessionTypes.Struct> {
    // filter to get unique chains
    const chains = accounts
      .map((account) => account.split(':').slice(0, 2).join(':'))
      .filter((x, i, a) => a.indexOf(x) == i)

    return await this.approveSession({
      id,
      namespaces: buildApprovedNamespaces({
        proposal: params,
        supportedNamespaces: {
          hedera: {
            chains,
            methods: this.methods,
            events: this.sessionEvents,
            accounts,
          },
        },
      }),
    })
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
    event: WalletKitTypes.SessionRequest,
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

  public async executeSessionRequest(
    event: WalletKitTypes.SessionRequest,
    hederaWallet: HederaWallet,
  ): Promise<void> {
    const { method, id, topic, body } = this.parseSessionRequest(event)

    return await this[method](id, topic, body, hederaWallet)
  }

  // https://docs.walletconnect.com/web3wallet/wallet-usage#responding-to-session-requests
  public async rejectSessionRequest(
    event: WalletKitTypes.SessionRequest,
    error: { code: number; message: string },
  ): Promise<void> {
    const { id, topic } = this.parseSessionRequest(event, false)

    return await this.respondSessionRequest({
      topic,
      response: { id, error, jsonrpc: '2.0' },
    })
  }

  /*
   * JSON RPC Methods
   */
  // 1. hedera_getNodeAddresses
  public async hedera_getNodeAddresses(
    id: number,
    topic: string,
    _: any, // ignore this param to be consistent call signature with other functions
    signer: HederaWallet,
  ): Promise<void> {
    const nodesAccountIds = signer.getNetwork()
    const nodes = Object.values(nodesAccountIds).map((nodeAccountId) =>
      nodeAccountId.toString(),
    )

    const response: GetNodeAddresesResponse = {
      topic,
      response: {
        jsonrpc: '2.0',
        id,
        result: {
          nodes,
        },
      },
    }

    return await this.respondSessionRequest(response)
  }

  // 2. hedera_executeTransaction
  public async hedera_executeTransaction(
    id: number,
    topic: string,
    body: Transaction,
    signer: HederaWallet,
  ): Promise<void> {
    const response: ExecuteTransactionResponse = {
      topic,
      response: {
        id,
        result: (await signer.call(body)).toJSON(),
        jsonrpc: '2.0',
      },
    }

    return await this.respondSessionRequest(response)
  }
  // 3. hedera_signMessage
  public async hedera_signMessage(
    id: number,
    topic: string,
    body: string,
    signer: HederaWallet,
  ): Promise<void> {
    // signer takes an array of Uint8Arrays though spec allows for 1 message to be signed
    const signerSignatures = await signer.sign(stringToSignerMessage(body))

    const _signatureMap = proto.SignatureMap.create(
      signerSignaturesToSignatureMap(signerSignatures),
    )

    const signatureMap = signatureMapToBase64String(_signatureMap)

    const response: SignMessageResponse = {
      topic,
      response: {
        jsonrpc: '2.0',
        id,
        result: {
          signatureMap,
        },
      },
    }
    return await this.respondSessionRequest(response)
  }

  // 4. hedera_signAndExecuteQuery
  public async hedera_signAndExecuteQuery(
    id: number,
    topic: string,
    body: Query<any>,
    signer: HederaWallet,
  ): Promise<void> {
    /*
     * Can be used with return values the have a toBytes method implemented
     * For example:
     * https://github.com/hashgraph/hedera-sdk-js/blob/c4438cbaa38074d8bfc934dba84e3b430344ed89/src/account/AccountInfo.js#L402
     */
    const queryResult = await body.executeWithSigner(signer)
    let queryResponse = ''
    if (Array.isArray(queryResult)) {
      queryResponse = queryResult.map((qr) => Uint8ArrayToBase64String(qr.toBytes())).join(',')
    } else {
      queryResponse = Uint8ArrayToBase64String(queryResult.toBytes())
    }

    const response: SignAndExecuteQueryResponse = {
      topic,
      response: {
        jsonrpc: '2.0',
        id,
        result: {
          response: queryResponse,
        },
      },
    }

    return await this.respondSessionRequest(response)
  }

  // 5. hedera_signAndExecuteTransaction
  public async hedera_signAndExecuteTransaction(
    id: number,
    topic: string,
    body: Transaction,
    signer: HederaWallet,
  ): Promise<void> {
    // check transaction is incomplete (HIP-745)
    if (!body.isFrozen()) {
      // set multiple nodeAccountIds and transactionId if not present
      await body.freezeWithSigner(signer)
    }

    const signedTransaction = await signer.signTransaction(body)

    const response: SignAndExecuteTransactionResponse = {
      topic,
      response: {
        id,
        result: (await signer.call(signedTransaction)).toJSON(),
        jsonrpc: '2.0',
      },
    }

    return await this.respondSessionRequest(response)
  }

  // 6. hedera_signTransaction
  public async hedera_signTransaction(
    id: number,
    topic: string,
    body: Uint8Array,
    signer: HederaWallet,
  ): Promise<void> {
    const signerSignatures = await signer.sign([body])

    const _signatureMap = proto.SignatureMap.create(
      signerSignaturesToSignatureMap(signerSignatures),
    )

    const signatureMap = signatureMapToBase64String(_signatureMap)

    const response: SignTransactionResponse = {
      topic,
      response: {
        jsonrpc: '2.0',
        id,
        result: {
          signatureMap,
        },
      },
    }

    return await this.respondSessionRequest(response)
  }

  /**
   * Signs a transaction body for multiple random Hedera nodes (HIP-1190)
   *
   * This method implements HIP-1190 to enable multi-signature workflows
   * with node redundancy. The wallet:
   * 1. Validates transaction body has NO node account ID set
   * 2. Selects N random nodes from the network
   * 3. Signs transaction for each node
   * 4. Returns ONLY signature maps (not full transactions)
   *
   * @param id - JSON-RPC request ID
   * @param topic - WalletConnect session topic
   * @param body - Transaction body as Uint8Array (must not have nodeAccountId)
   * @param signer - HederaWallet instance with private key
   * @param nodeCount - Number of nodes to sign for (default: 5)
   *
   * @returns Promise that resolves when response is sent
   *
   * @throws {Error} If transaction body already has nodeAccountId set
   * @throws {Error} If insufficient nodes available in network
   *
   * @see {@link https://github.com/hashgraph/hedera-improvement-proposal/blob/main/HIP/hip-1190.md | HIP-1190}
   */
  public async hedera_signTransactions(
    id: number,
    topic: string,
    body: Uint8Array,
    signer: HederaWallet,
    nodeCount: number = 5,
  ): Promise<void> {
    // Decode transaction body
    let transactionBody: proto.ITransactionBody
    try {
      transactionBody = proto.TransactionBody.decode(body)
    } catch (error: any) {
      const errorResponse = {
        topic,
        response: {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32602,
            message: `Failed to decode transaction body: ${error.message}`,
          },
        },
      }
      return await this.respondSessionRequest(errorResponse)
    }

    // SECURITY CHECK - Ensure no node account ID is set
    if (transactionBody.nodeAccountID) {
      const errorResponse = {
        topic,
        response: {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32602,
            message:
              'Transaction body must not have nodeAccountId set. ' +
              'The wallet assigns multiple random nodes for HIP-1190 multi-node signing.',
          },
        },
      }
      return await this.respondSessionRequest(errorResponse)
    }

    // Get available nodes from signer's network
    const network = signer.getNetwork()

    // Select N random nodes
    let selectedNodes: AccountId[]
    try {
      selectedNodes = getRandomNodes(network, nodeCount)
    } catch (error: any) {
      const errorResponse = {
        topic,
        response: {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32603,
            message: `Node selection failed: ${error.message}`,
          },
        },
      }
      return await this.respondSessionRequest(errorResponse)
    }

    // Sign transaction body for each node
    const signatureMaps: string[] = []
    const nodeAccountIds: string[] = []

    try {
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
        const signerSignatures = await signer.sign([bodyWithNode])
        const _signatureMap = proto.SignatureMap.create(
          signerSignaturesToSignatureMap(signerSignatures),
        )
        const signatureMap = signatureMapToBase64String(_signatureMap)
        signatureMaps.push(signatureMap)
        nodeAccountIds.push(nodeAccountId.toString())
      }
    } catch (error: any) {
      const errorResponse = {
        topic,
        response: {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32603,
            message: `Signing failed: ${error.message}`,
          },
        },
      }
      return await this.respondSessionRequest(errorResponse)
    }

    // Return signature maps + node IDs (NOT full transactions)
    const response: SignTransactionsResponse = {
      topic,
      response: {
        jsonrpc: '2.0',
        id,
        result: {
          signatureMaps,
          nodeAccountIds,
        },
      },
    }

    return await this.respondSessionRequest(response)
  }
}

export default HederaWeb3Wallet
