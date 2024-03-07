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

import { AccountId, LedgerId, Transaction } from '@hashgraph/sdk'
import { EngineTypes, SessionTypes, SignClientTypes } from '@walletconnect/types'
import QRCodeModal from '@walletconnect/qrcode-modal'
import { WalletConnectModal } from '@walletconnect/modal'

import SignClient from '@walletconnect/sign-client'
import { getSdkError } from '@walletconnect/utils'
import {
  HederaJsonRpcMethod,
  accountAndLedgerFromSession,
  networkNamespaces,
  GetNodeAddressesRequest,
  GetNodeAddressesResult,
  ExecuteTransactionParams,
  ExecuteTransactionRequest,
  ExecuteTransactionResult,
  SignMessageParams,
  SignMessageRequest,
  SignMessageResult,
  SignAndExecuteQueryRequest,
  SignAndExecuteQueryResult,
  SignAndExecuteQueryParams,
  SignAndExecuteTransactionParams,
  SignAndExecuteTransactionRequest,
  SignAndExecuteTransactionResult,
  SignTransactionParams,
  SignTransactionRequest,
  SignTransactionResult,
  isExecuteTransactionParams,
  isSignMessageParams,
  isSignAndExecuteTransactionParams,
  isSignTransactionParams,
  isSignAndExecuteQueryParams,
} from '../shared'
import { DAppSigner } from './DAppSigner'
import { JsonRpcResult } from '@walletconnect/jsonrpc-types'

export * from './DAppSigner'

type BaseLogger = 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'fatal'

export class DAppConnector {
  dAppMetadata: SignClientTypes.Metadata
  network: LedgerId = LedgerId.TESTNET
  projectId: string
  supportedMethods: string[] = []
  supportedEvents: string[] = []
  supportedChains: string[] = []

  walletConnectClient: SignClient | undefined
  walletConnectModal: WalletConnectModal
  signers: DAppSigner[] = []
  isInitializing = false

  /**
   * Initializes the DAppConnector instance.
   * @param metadata - SignClientTypes.Metadata object for the DApp metadata.
   * @param network - LedgerId representing the network (default: LedgerId.TESTNET).
   * @param projectId - Project ID for the WalletConnect client.
   * @param methods - Array of supported methods for the DApp (optional).
   * @param events - Array of supported events for the DApp (optional).
   * @param events - Array of supported chains for the DApp (optional).
   */
  constructor(
    metadata: SignClientTypes.Metadata,
    network: LedgerId,
    projectId: string,
    methods?: string[],
    events?: string[],
    chains?: string[],
  ) {
    this.dAppMetadata = metadata
    this.network = network
    this.projectId = projectId
    this.supportedMethods = methods ?? Object.values(HederaJsonRpcMethod)
    this.supportedEvents = events ?? []
    this.supportedChains = chains ?? []

    this.walletConnectModal = new WalletConnectModal({
      projectId: projectId,
      chains: chains,
    })
  }

  get accountIds(): AccountId[] {
    return this.signers.map((signer) => signer.getAccountId())
  }

  /**
   * Initializes the DAppConnector instance.
   * @param logger - `BaseLogger` for logging purposes (optional).
   */
  async init({ logger }: { logger?: BaseLogger } = {}) {
    try {
      this.isInitializing = true
      if (!this.projectId) {
        throw new Error('Project ID is not defined')
      }
      this.walletConnectClient = await SignClient.init({
        logger,
        relayUrl: 'wss://relay.walletconnect.com',
        projectId: this.projectId,
        metadata: this.dAppMetadata,
      })
      DAppSigner.initialize(this.walletConnectClient)

      const existingSessions = this.walletConnectClient.session.getAll()

      if (existingSessions) this.signers = existingSessions.flatMap(this.createSigners)

      this.walletConnectClient.on('session_delete', (pairing) => {
        this.signers = this.signers.filter((signer) => signer.topic !== pairing.topic)
        this.disconnect(pairing.topic)
      })

      this.walletConnectClient.core.pairing.events.on('pairing_delete', (pairing) => {
        this.signers = this.signers.filter((signer) => signer.topic !== pairing.topic)
        this.disconnect(pairing.topic)
      })
    } finally {
      this.isInitializing = false
    }
  }

  public getSigner(accountId: AccountId): DAppSigner {
    const signer = this.signers.find((signer) => signer.getAccountId().equals(accountId))
    if (!signer) throw new Error('Signer is not found for this accountId')
    return signer
  }

  /**
   * Initiates the WalletConnect connection flow using a QR code.
   * @param pairingTopic - The pairing topic for the connection (optional).
   * @returns A Promise that resolves when the connection process is complete.
   */
  public async connectQR(pairingTopic?: string): Promise<void> {
    return this.abortableConnect(async () => {
      try {
        const { uri, approval } = await this.connectURI(pairingTopic)
        if (!uri) throw new Error('URI is not defined')
        QRCodeModal.open(uri, () => {
          throw new Error('User rejected pairing')
        })
        await this.onSessionConnected(await approval())
      } finally {
        QRCodeModal.close()
      }
    })
  }

  /**
   * Initiates the WalletConnect connection flow using a QR code.
   * @param pairingTopic - The pairing topic for the connection (optional).
   * @returns A Promise that resolves when the connection process is complete.
   */
  public async openModal(pairingTopic?: string): Promise<SessionTypes.Struct> {
    try {
      const { uri, approval } = await this.connectURI(pairingTopic)
      this.walletConnectModal.openModal({ uri })
      const session = await approval()
      await this.onSessionConnected(session)
      return session
    } catch (error) {
      throw error
    } finally {
      this.walletConnectModal.closeModal()
    }
  }

  /**
   * Initiates the WallecConnect connection flow using URI.
   * @param pairingTopic - The pairing topic for the connection (optional).
   * @returns A Promise that resolves when the connection process is complete.
   */
  public async connect(
    launchCallback: (uri: string) => void,
    pairingTopic?: string,
  ): Promise<void> {
    return this.abortableConnect(async () => {
      const { uri, approval } = await this.connectURI(pairingTopic)
      if (!uri) throw new Error('URI is not defined')
      launchCallback(uri)
      const session = await approval()
      await this.onSessionConnected(session)
    })
  }

  private abortableConnect = async <T>(callback: () => Promise<T>): Promise<T> => {
    return new Promise(async (resolve, reject) => {
      const pairTimeoutMs = 480_000
      const timeout = setTimeout(() => {
        QRCodeModal.close()
        reject(new Error(`Connect timed out after ${pairTimeoutMs}(ms)`))
      }, pairTimeoutMs)

      try {
        return resolve(await callback())
      } finally {
        clearTimeout(timeout)
      }
    })
  }

  /**
   * Disconnects the current session associated with the specified topic.
   * @param topic - The topic of the session to disconnect.
   * @returns A Promise that resolves when the session is disconnected.
   */
  public async disconnect(topic: string): Promise<void> {
    await this.walletConnectClient!.disconnect({
      topic: topic,
      reason: getSdkError('USER_DISCONNECTED'),
    })
  }

  /**
   * Disconnects all active sessions and pairings.
   *
   * Throws error when WalletConnect is not initialized or there are no active sessions/pairings.
   * @returns A Promise that resolves when all active sessions and pairings are disconnected.
   */
  public async disconnectAll(): Promise<void> {
    if (!this.walletConnectClient) {
      throw new Error('WalletConnect is not initialized')
    }

    const sessions = this.walletConnectClient.session.getAll()
    const pairings = this.walletConnectClient.core.pairing.getPairings()
    if (!sessions?.length && !pairings?.length) {
      throw new Error('There is no active session/pairing. Connect to the wallet at first.')
    }

    const disconnectionPromises: Promise<void>[] = []

    // disconnect sessions
    for (const session of this.walletConnectClient.session.getAll()) {
      console.log(`Disconnecting from session: ${session}`)
      const promise = this.disconnect(session.topic)
      disconnectionPromises.push(promise)
    }

    // disconnect pairings
    //https://docs.walletconnect.com/api/core/pairing
    for (const pairing of pairings) {
      const promise = this.disconnect(pairing.topic)
      disconnectionPromises.push(promise)
    }

    await Promise.all(disconnectionPromises)

    this.signers = []
  }

  private createSigners(session: SessionTypes.Struct): DAppSigner[] {
    const allNamespaceAccounts = accountAndLedgerFromSession(session)
    return allNamespaceAccounts.map(
      ({ account, network }: { account: AccountId; network: LedgerId }) =>
        new DAppSigner(account, session.topic, network),
    )
  }

  private async onSessionConnected(session: SessionTypes.Struct) {
    this.signers.push(...this.createSigners(session))
  }

  private async connectURI(
    pairingTopic?: string,
  ): Promise<{ uri?: string; approval: () => Promise<SessionTypes.Struct> }> {
    if (!this.walletConnectClient) {
      throw new Error('WalletConnect is not initialized')
    }
    return this.walletConnectClient.connect({
      pairingTopic,
      requiredNamespaces: networkNamespaces(
        this.network,
        this.supportedMethods,
        this.supportedEvents,
      ),
    })
  }

  private async request<
    Req extends EngineTypes.RequestParams,
    Res extends JsonRpcResult['result'],
  >({ method, params }: Req['request']) {
    const signer = this.signers[this.signers.length - 1]
    if (!signer) {
      throw new Error('There is no active session. Connect to the wallet at first.')
    }

    return await signer.request<Res>({
      method: method,
      params: params,
    })
  }

  /**
   * Retrieves the node addresses associated with the current Hedera network.
   *
   * When there is no active session or an error occurs during the request.
   * @returns Promise\<{@link GetNodeAddressesResult}\>
   */
  public async getNodeAddresses() {
    return await this.request<GetNodeAddressesRequest, GetNodeAddressesResult>({
      method: HederaJsonRpcMethod.GetNodeAddresses,
      params: undefined,
    })
  }

  /**
   * Executes a transaction on the Hedera network.
   *
   * @param {ExecuteTransactionParams} params - The parameters of type {@link ExecuteTransactionParams | `ExecuteTransactionParams`} required for the transaction execution.
   * @param {string[]} params.signedTransaction - Array of Base64-encoded `Transaction`'s
   * @returns Promise\<{@link ExecuteTransactionResult}\>
   * @example
   * Use helper `transactionToBase64String` to encode `Transaction` to Base64 string
   * ```ts
   * const params = {
   *  signedTransaction: [transactionToBase64String(transaction)]
   * }
   *
   * const result = await dAppConnector.executeTransaction(params)
   * ```
   */
  public async executeTransaction(
    params: ExecuteTransactionParams,
  ): Promise<ExecuteTransactionResult['result']>

  /**
   * Executes a transaction on the Hedera networkw with a signer
   *
   * @param {AccountId} accountId - AccountId of the signer
   * @param {Transaction} transaction - Transaction to be executed
   * @returns {Promise<Transaction>}
   *  * @example
   * ```ts
   * const params = {
   *  signedTransaction: [transactionToBase64String(transaction)]
   * }
   *
   * const result = await dAppConnector.executeTransaction(AccountId.fromString('0.0.12345), transaction)
   * ```
   */
  public async executeTransaction(
    accountId: AccountId,
    transaction: Transaction,
  ): Promise<ExecuteTransactionResult['result']>
  public async executeTransaction(
    paramsOrAccountId: ExecuteTransactionParams | AccountId,
    transaction?: Transaction,
  ) {
    if (arguments.length === 1 && isExecuteTransactionParams(paramsOrAccountId)) {
      return this.request<ExecuteTransactionRequest, ExecuteTransactionResult['result']>({
        method: HederaJsonRpcMethod.ExecuteTransaction,
        params: paramsOrAccountId,
      })
    } else {
      if (!transaction) throw new Error('Transaction is not defined')
      const signer = this.getSigner(paramsOrAccountId as AccountId)
      return signer.executeTransaction(transaction)
    }
  }

  /**
   * Signs a provided `message` with provided `signerAccountId`.
   *
   * @param {SignMessageParams} params - The parameters of type {@link SignMessageParams | `SignMessageParams`} required for signing message.
   * @param {string} params.signerAccountId - a signer Hedera Account identifier in {@link https://hips.hedera.com/hip/hip-30 | HIP-30} (`<nework>:<shard>.<realm>.<num>`) form.
   * @param {string} params.message - a plain UTF-8 string
   * @returns Promise\<{@link SignMessageResult}\>
   * @example
   * ```ts
   * const params = {
   *  signerAccountId: '0.0.12345',
   *  message: 'Hello World!'
   * }
   *
   * const result = await dAppConnector.signMessage(params)
   * ```
   */

  public async signMessage(params: SignMessageParams): Promise<SignMessageResult['result']>
  public async signMessage(
    accountId: AccountId,
    message: string,
  ): Promise<SignMessageResult['result']>
  public async signMessage(paramsOrAccountId: SignMessageParams | AccountId, message?: string) {
    if (arguments.length === 1 && isSignMessageParams(paramsOrAccountId)) {
      return this.request<SignMessageRequest, SignMessageResult['result']>({
        method: HederaJsonRpcMethod.SignMessage,
        params: paramsOrAccountId,
      })
    } else {
      if (!message) throw new Error('Message is not defined')
      const signer = this.getSigner(paramsOrAccountId as AccountId)
      return signer.signMessage(message)
    }
  }

  /**
   * Signs and send `Query` on the Hedera network.
   *
   * @param {SignAndExecuteQueryParams} params - The parameters of type {@link SignAndExecuteQueryParams | `SignAndExecuteQueryParams`} required for the Query execution.
   * @param {string} params.signerAccountId - a signer Hedera Account identifier in {@link https://hips.hedera.com/hip/hip-30 | HIP-30} (`<nework>:<shard>.<realm>.<num>`) form.
   * @param {string} params.query - `Query` object represented as Base64 string
   * @returns Promise\<{@link SignAndExecuteQueryResult}\>
   * @example
   * Use helper `queryToBase64String` to encode `Query` to Base64 string
   * ```ts
   * const params = {
   *  signerAccountId: '0.0.12345',
   *  query: queryToBase64String(query),
   * }
   *
   * const result = await dAppConnector.signAndExecuteQuery(params)
   * ```
   */
  public async signAndExecuteQuery(
    params: SignAndExecuteQueryParams,
  ): Promise<SignAndExecuteQueryResult['result']>
  public async signAndExecuteQuery(
    accountId: AccountId,
    query: string,
  ): Promise<SignAndExecuteQueryResult['result']>
  public async signAndExecuteQuery(
    paramsOrAccountId: SignAndExecuteQueryParams | AccountId,
    query?: string,
  ) {
    if (arguments.length === 1 && isSignAndExecuteQueryParams(paramsOrAccountId)) {
      return await this.request<
        SignAndExecuteQueryRequest,
        SignAndExecuteQueryResult['result']
      >({
        method: HederaJsonRpcMethod.SignAndExecuteQuery,
        params: paramsOrAccountId,
      })
    } else {
      if (!query) throw new Error('Query is not defined')
      const signer = this.getSigner(paramsOrAccountId as AccountId)
      return signer.signAndExecuteQuery(query)
    }
  }

  /**
   * Signs and executes Transactions on the Hedera network.
   *
   * @param {SignAndExecuteTransactionParams} params - The parameters of type {@link SignAndExecuteTransactionParams | `SignAndExecuteTransactionParams`} required for `Transaction` signing and execution.
   * @param {string} params.signerAccountId - a signer Hedera Account identifier in {@link https://hips.hedera.com/hip/hip-30 | HIP-30} (`<nework>:<shard>.<realm>.<num>`) form.
   * @param {string[]} params.transaction - Array of Base64-encoded `Transaction`'s
   * @returns Promise\<{@link SignAndExecuteTransactionResult}\>
   * @example
   * Use helper `transactionToBase64String` to encode `Transaction` to Base64 string
   * ```ts
   * const params = {
   *  signerAccountId: '0.0.12345'
   *  transaction: [transactionToBase64String(transaction)]
   * }
   *
   * const result = await dAppConnector.signAndExecuteTransaction(params)
   * ```
   */
  public async signAndExecuteTransaction(
    params: SignAndExecuteTransactionParams,
  ): Promise<SignAndExecuteTransactionResult['result']>
  public async signAndExecuteTransaction(
    accountId: AccountId,
    transaction: Transaction,
  ): Promise<SignAndExecuteTransactionResult['result']>
  public async signAndExecuteTransaction(
    paramsOrAccountId: SignAndExecuteTransactionParams | AccountId,
    transaction?: Transaction,
  ) {
    if (arguments.length === 1 && isSignAndExecuteTransactionParams(paramsOrAccountId)) {
      return this.request<
        SignAndExecuteTransactionRequest,
        SignAndExecuteTransactionResult['result']
      >({
        method: HederaJsonRpcMethod.SignAndExecuteTransaction,
        params: paramsOrAccountId,
      })
    } else {
      if (!transaction) throw new Error('Transaction is not defined')
      const signer = this.getSigner(paramsOrAccountId as AccountId)
      return signer.signAndExecuteTransaction(transaction)
    }
  }

  /**
   * Signs and executes Transactions on the Hedera network.
   *
   * @param {SignTransactionParams} params - The parameters of type {@link SignTransactionParams | `SignTransactionParams`} required for `Transaction` signing.
   * @param {string} params.signerAccountId - a signer Hedera Account identifier in {@link https://hips.hedera.com/hip/hip-30 | HIP-30} (`<nework>:<shard>.<realm>.<num>`) form.
   * @param {string[]} params.transaction - Array of Base64-encoded `Transaction`'s
   * @returns Promise\<{@link SignTransactionResult}\>
   * @example
   * ```ts
   * const transactionBodyObject = transactionToTransactionBody(transaction, AccountId.fromString('0.0.3'))
   * const transactionBody = transactionBodyToBase64String(transactionBodyObject)
   *
   * const params = {
   *  signerAccountId: '0.0.12345',
   *  transactionBody
   * }
   *
   * const result = await dAppConnector.signTransaction(params)
   * ```
   */
  public async signTransaction(
    params: SignTransactionParams,
  ): Promise<SignTransactionResult['result']>
  public async signTransaction(
    accountId: AccountId,
    transaction: Transaction,
  ): Promise<Transaction>
  public async signTransaction(
    paramsOrAccountId: SignTransactionParams | AccountId,
    transaction?: Transaction,
  ) {
    if (arguments.length === 1 && isSignTransactionParams(paramsOrAccountId)) {
      return this.request<SignTransactionRequest, SignTransactionResult['result']>({
        method: HederaJsonRpcMethod.SignTransaction,
        params: paramsOrAccountId,
      })
    } else {
      if (!transaction) throw new Error('Transaction is not defined')
      const signer = this.getSigner(paramsOrAccountId as AccountId)
      return signer.signTransaction(transaction)
    }
  }
}

export default DAppConnector
