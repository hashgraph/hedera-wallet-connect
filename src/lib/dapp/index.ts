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

import { AccountId, LedgerId } from '@hashgraph/sdk'
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
      const existingSessions = this.walletConnectClient.session.getAll()

      if (existingSessions)
        this.signers = existingSessions.flatMap((session) => this.createSigners(session))

      this.walletConnectClient.on('session_event', (event) => {
        // Handle session events, such as "chainChanged", "accountsChanged", etc.
        console.log(event)
      })

      this.walletConnectClient.on('session_update', ({ topic, params }) => {
        // Handle session update
        const { namespaces } = params
        const _session = this.walletConnectClient!.session.get(topic)
        // Overwrite the `namespaces` of the existing session with the incoming one.
        const updatedSession = { ..._session, namespaces }
        // Integrate the updated session state into your dapp state.
        console.log(updatedSession)
      })

      this.walletConnectClient.on('session_delete', (pairing) => {
        console.log(pairing)
        this.signers = this.signers.filter((signer) => signer.topic !== pairing.topic)
        this.disconnect(pairing.topic)
        // Session was deleted -> reset the dapp state, clean up from user session, etc.
        console.log('Dapp: Session deleted by wallet!')
      })

      this.walletConnectClient.core.pairing.events.on('pairing_delete', (pairing) => {
        // Session was deleted
        console.log(pairing)
        this.signers = this.signers.filter((signer) => signer.topic !== pairing.topic)
        this.disconnect(pairing.topic)
        console.log(`Dapp: Pairing deleted by wallet!`)
        // clean up after the pairing for `topic` was deleted.
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
   * @returns {Promise<SessionTypes.Struct>} - A Promise that resolves when the connection process is complete.
   */
  public async openModal(pairingTopic?: string): Promise<SessionTypes.Struct> {
    try {
      const { uri, approval } = await this.connectURI(pairingTopic)
      this.walletConnectModal.openModal({ uri })
      const session = await approval()
      await this.onSessionConnected(session)
      return session
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
        new DAppSigner(account, this.walletConnectClient!, session.topic, network),
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

  private async request<Req extends EngineTypes.RequestParams, Res extends JsonRpcResult>({
    method,
    params,
  }: Req['request']): Promise<Res> {
    const signer = this.signers[this.signers.length - 1]
    if (!signer) {
      throw new Error('There is no active session. Connect to the wallet at first.')
    }

    return await signer.request({
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
  public async executeTransaction(params: ExecuteTransactionParams) {
    return await this.request<ExecuteTransactionRequest, ExecuteTransactionResult>({
      method: HederaJsonRpcMethod.ExecuteTransaction,
      params,
    })
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
  public async signMessage(params: SignMessageParams) {
    return await this.request<SignMessageRequest, SignMessageResult>({
      method: HederaJsonRpcMethod.SignMessage,
      params,
    })
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
  public async signAndExecuteQuery(params: SignAndExecuteQueryParams) {
    return await this.request<SignAndExecuteQueryRequest, SignAndExecuteQueryResult>({
      method: HederaJsonRpcMethod.SignAndExecuteQuery,
      params,
    })
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
  public async signAndExecuteTransaction(params: SignAndExecuteTransactionParams) {
    return await this.request<
      SignAndExecuteTransactionRequest,
      SignAndExecuteTransactionResult
    >({
      method: HederaJsonRpcMethod.SignAndExecuteTransaction,
      params,
    })
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
  public async signTransaction(params: SignTransactionParams) {
    return await this.request<SignTransactionRequest, SignTransactionResult>({
      method: HederaJsonRpcMethod.SignTransaction,
      params,
    })
  }
}

export default DAppConnector
