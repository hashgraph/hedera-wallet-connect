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
import { getSdkError, isOnline } from '@walletconnect/utils'
import { RELAYER_EVENTS } from '@walletconnect/core'
import { DefaultLogger, ILogger, LogLevel } from '../shared/logger'
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
  SignTransactionResult,
  ExtensionData,
  extensionConnect,
  findExtensions,
  SignTransactionRequest,
} from '../shared'
import { DAppSigner } from './DAppSigner'
import { JsonRpcResult } from '@walletconnect/jsonrpc-types'

export * from './DAppSigner'
export { SessionNotFoundError } from './SessionNotFoundError'

type BaseLogger = 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'fatal'

export class DAppConnector {
  private logger: ILogger
  dAppMetadata: SignClientTypes.Metadata
  network: LedgerId = LedgerId.TESTNET
  projectId: string
  supportedMethods: string[] = []
  supportedEvents: string[] = []
  supportedChains: string[] = []

  extensions: ExtensionData[] = []
  public onSessionIframeCreated: ((session: SessionTypes.Struct) => void) | null = null

  walletConnectClient: SignClient | undefined
  walletConnectModal: WalletConnectModal
  signers: DAppSigner[] = []
  isInitializing = false
  private storagePrefix = 'hedera-wc/dapp-connector/'

  /**
   * Initializes the DAppConnector instance.
   * @param metadata - SignClientTypes.Metadata object for the DApp metadata.
   * @param network - LedgerId representing the network (default: LedgerId.TESTNET).
   * @param projectId - Project ID for the WalletConnect client.
   * @param methods - Array of supported methods for the DApp (optional).
   * @param events - Array of supported events for the DApp (optional).
   * @param chains - Array of supported chains for the DApp (optional).
   * @param logLevel - Logging level for the DAppConnector (optional).
   */
  constructor(
    metadata: SignClientTypes.Metadata,
    network: LedgerId,
    projectId: string,
    methods?: string[],
    events?: string[],
    chains?: string[],
    logLevel: LogLevel = 'debug',
  ) {
    this.logger = new DefaultLogger(logLevel)
    this.dAppMetadata = metadata
    this.network = network
    this.projectId = projectId
    this.supportedMethods = methods ?? Object.values(HederaJsonRpcMethod)
    this.supportedEvents = events ?? []
    this.supportedChains = chains ?? []
    this.extensions = []

    this.walletConnectModal = new WalletConnectModal({
      projectId: projectId,
      chains: chains,
    })

    findExtensions((metadata, isIframe) => {
      this.extensions.push({
        ...metadata,
        available: true,
        availableInIframe: isIframe,
      })
    })
  }

  /**
   * Sets the logging level for the DAppConnector
   * @param level - The logging level to set
   */
  public setLogLevel(level: LogLevel): void {
    if (this.logger instanceof DefaultLogger) {
      this.logger.setLogLevel(level)
    }
  }

  /**
   * Initializes the DAppConnector instance.
   * @param logger - `BaseLogger` for logging purposes (optional).
   */
  async init({ logger }: { logger?: BaseLogger } = {}): Promise<void> {
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
      if (existingSessions.length > 0)
        this.signers = existingSessions.flatMap((session) => this.createSigners(session))
      else this.checkIframeConnect()

      //manual call after init before relayer connect event handler is attached
      this.handleRelayConnected()
      this.walletConnectClient.core.relayer.on(
        RELAYER_EVENTS.connect,
        this.handleRelayConnected.bind(this),
      )

      this.walletConnectClient.on('session_event', this.handleSessionEvent.bind(this))
      this.walletConnectClient.on('session_update', this.handleSessionUpdate.bind(this))
      this.walletConnectClient.on('session_delete', this.handleSessionDelete.bind(this))
      // Listen for custom session_delete events from DAppSigner
      this.walletConnectClient.core.events.on(
        'session_delete',
        this.handleSessionDelete.bind(this),
      )
      this.walletConnectClient.core.pairing.events.on(
        'pairing_delete',
        this.handlePairingDelete.bind(this),
      )
    } catch (e) {
      this.logger.error('Error initializing DAppConnector:', e)
    } finally {
      this.isInitializing = false
    }
  }

  /**
   * Retrieves a DAppSigner for the specified Hedera Account ID.
   *
   * @param {AccountId} accountId - The Hedera Account ID to find the associated signer.
   * @returns {DAppSigner} - The signer object of type {@link DAppSigner} corresponding to the provided account ID.
   * @throws {Error} - If no signer is found for the provided account ID.
   */
  public getSigner(accountId: AccountId): DAppSigner {
    if (this.isInitializing) {
      throw new Error('DAppConnector is not initialized yet. Try again later.')
    }
    const signer = this.signers.find((signer) => signer.getAccountId().equals(accountId))
    if (!signer) throw new Error('Signer is not found for this accountId')
    return signer
  }

  /**
   * Initiates the WalletConnect connection flow using a QR code.
   * @deprecated Use `openModal` instead.
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
   * @param extensionId - The id for the extension used to connect (optional).
   * @returns A Promise that resolves when the connection process is complete.
   */
  public async connect(
    launchCallback: (uri: string) => void,
    pairingTopic?: string,
    extensionId?: string,
  ): Promise<SessionTypes.Struct> {
    return this.abortableConnect(async () => {
      const { uri, approval } = await this.connectURI(pairingTopic)
      if (!uri) throw new Error('URI is not defined')
      launchCallback(uri)
      const session = await approval()
      if (extensionId) {
        const sessionProperties = {
          ...session.sessionProperties,
          extensionId,
        }
        session.sessionProperties = sessionProperties
        await this.walletConnectClient?.session.update(session.topic, {
          sessionProperties,
        })
      }
      await this.onSessionConnected(session)
      return session
    })
  }

  /**
   * Initiates the WallecConnect connection flow sending a message to the extension.
   * @param extensionId - The id for the extension used to connect.
   * @param pairingTopic - The pairing topic for the connection (optional).
   * @returns A Promise that resolves when the connection process is complete.
   */
  public async connectExtension(
    extensionId: string,
    pairingTopic?: string,
  ): Promise<SessionTypes.Struct> {
    const extension = this.extensions.find((ext) => ext.id === extensionId)
    if (!extension || !extension.available) throw new Error('Extension is not available')
    return this.connect(
      (uri) => {
        extensionConnect(extension.id, extension.availableInIframe, uri)
      },
      pairingTopic,
      extension.availableInIframe ? undefined : extensionId,
    )
  }

  /**
   * Validates the session by checking if the session exists and is valid.
   * Also ensures the signer exists for the session.
   * @param topic - The topic of the session to validate.
   * @returns {boolean} - True if the session exists and has a valid signer, false otherwise.
   */
  private validateSession(topic: string): boolean {
    try {
      if (!this.walletConnectClient) {
        return false
      }

      const session = this.walletConnectClient.session.get(topic)
      const hasSigner = this.signers.some((signer) => signer.topic === topic)
      if (!session) {
        // If session doesn't exist but we have a signer for it, clean up
        if (hasSigner) {
          this.logger.warn(`Signer exists but no session found for topic: ${topic}`)
          this.handleSessionDelete({ topic })
        }
        return false
      }

      if (!hasSigner) {
        this.logger.warn(`Session exists but no signer found for topic: ${topic}`)
        return false
      }

      return true
    } catch (e) {
      this.logger.error('Error validating session:', e)
      return false
    }
  }

  /**
   * Validates the session and refreshes the signers by removing the invalid ones.
   */
  private validateAndRefreshSigners() {
    this.signers = this.signers.filter((signer) => this.validateSession(signer.topic))
  }

  /**
   *  Initiates the WallecConnect connection if the wallet in iframe mode is detected.
   */
  private async checkIframeConnect() {
    const extension = this.extensions.find((ext) => ext.availableInIframe)
    if (extension) {
      const session = await this.connectExtension(extension.id)
      if (this.onSessionIframeCreated) this.onSessionIframeCreated(session)
    }
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
      } catch (error) {
        reject(error)
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
  public async disconnect(topic: string): Promise<boolean> {
    try {
      if (!this.walletConnectClient) {
        throw new Error('WalletConnect is not initialized')
      }
      await this.walletConnectClient.disconnect({
        topic: topic,
        reason: getSdkError('USER_DISCONNECTED'),
      })
      return true
    } catch (e) {
      this.logger.error(
        'Either the session was already disconnected or the topic is invalid',
        e,
      )
      return false
    }
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

    const disconnectionPromises: Promise<boolean>[] = []

    // disconnect sessions
    for (const session of this.walletConnectClient.session.getAll()) {
      this.logger.info(`Disconnecting from session: ${session}`)
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
        new DAppSigner(
          account,
          this.walletConnectClient!,
          session.topic,
          network,
          session.sessionProperties?.extensionId,
          this.logger instanceof DefaultLogger ? this.logger.getLogLevel() : 'debug',
        ),
    )
  }

  private async onSessionConnected(session: SessionTypes.Struct) {
    const newSigners = this.createSigners(session)

    // Filter out any existing signers with duplicate AccountIds
    for (const newSigner of newSigners) {
      // We check if any signers have the same account, extension + metadata name.
      const existingSigners = this.signers.filter((currentSigner) => {
        const matchingAccountId =
          currentSigner?.getAccountId()?.toString() === newSigner?.getAccountId()?.toString()
        const matchingExtensionId = newSigner.extensionId === currentSigner.extensionId
        const newSignerMetadata = newSigner.getMetadata()
        const existingSignerMetadata = currentSigner.getMetadata()
        const metadataNameMatch = newSignerMetadata?.name === existingSignerMetadata?.name
        if (currentSigner.topic === newSigner.topic) {
          this.logger.error(
            'The topic was already connected. This is a weird error. Please report it.',
            newSigner.getAccountId().toString(),
          )
        }
        return matchingAccountId && matchingExtensionId && metadataNameMatch
      })

      // Any dupes get disconnected + removed from the signers array.
      for (const existingSigner of existingSigners) {
        this.logger.debug(
          `Disconnecting duplicate signer for account ${existingSigner.getAccountId().toString()}`,
        )
        await this.disconnect(existingSigner.topic)
        this.signers = this.signers.filter((s) => s.topic !== existingSigner.topic)
      }
    }

    // Add new signers after all duplicates have been cleaned up
    this.signers.push(...newSigners)
    this.logger.debug(
      `Current signers after connection: ${this.signers
        .map((s) => `${s.getAccountId().toString()}:${s.topic}`)
        .join(', ')}`,
    )
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

  public async request<Req extends EngineTypes.RequestParams, Res extends JsonRpcResult>({
    method,
    params,
  }: Req['request']): Promise<Res> {
    let signer: DAppSigner | undefined

    this.logger.debug(`Requesting method: ${method} with params: ${JSON.stringify(params)}`)
    if (params?.signerAccountId) {
      // Extract the actual account ID from the hedera:<network>:<address> format
      const actualAccountId = params?.signerAccountId?.split(':')?.pop()
      signer = this.signers.find((s) => s?.getAccountId()?.toString() === actualAccountId)
      this.logger.debug(`Found signer: ${signer?.getAccountId()?.toString()}`)
      if (!signer) {
        throw new Error(
          `Signer not found for account ID: ${params?.signerAccountId}. Did you use the correct format? e.g hedera:<network>:<address> `,
        )
      }
    } else {
      signer = this.signers[this.signers.length - 1]
    }

    if (!signer) {
      throw new Error('There is no active session. Connect to the wallet at first.')
    }

    await this.verifyLastConnectedInstance()

    this.logger.debug(
      `Using signer: ${signer.getAccountId().toString()}: ${signer.topic} - about to request.`,
    )

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
   *  signerAccountId: 'hedera:testnet:0.0.12345',
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
   * @param {Transaction | string} params.transactionBody - a built Transaction object, or a base64 string of a transaction body (deprecated).
   * @deprecated Using string for params.transactionBody is deprecated and will be removed in a future version. Please migrate to using Transaction objects directly.
   * @returns Promise\<{@link SignTransactionResult}\>
   * @example
   * ```ts
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
    if (typeof params?.transactionBody === 'string') {
      this.logger.warn(
        'Transaction body is a string. This is not recommended, please migrate to passing a transaction object directly.',
      )
      return await this.request<SignTransactionRequest, SignTransactionResult>({
        method: HederaJsonRpcMethod.SignTransaction,
        params,
      })
    }

    if (params?.transactionBody instanceof Transaction) {
      const signerAccountId = params?.signerAccountId?.split(':')?.pop()
      const accountSigner = this.signers.find(
        (signer) => signer?.getAccountId()?.toString() === signerAccountId,
      )

      if (!accountSigner) {
        throw new Error(`No signer found for account ${signerAccountId}`)
      }

      if (!params?.transactionBody) {
        throw new Error('No transaction provided')
      }

      return await accountSigner.signTransaction(params.transactionBody as Transaction)
    }

    throw new Error(
      'Transaction sent in incorrect format. Ensure transaction body is either a base64 transaction body or Transaction object.',
    )
  }

  private handleSessionEvent(
    args: SignClientTypes.BaseEventArgs<{
      event: { name: string; data: any }
      chainId: string
    }>,
  ) {
    this.logger.debug('Session event received:', args)
    this.validateAndRefreshSigners()
  }

  private handleSessionUpdate({
    topic,
    params,
  }: {
    topic: string
    params: { namespaces: SessionTypes.Namespaces }
  }) {
    const { namespaces } = params
    const _session = this.walletConnectClient!.session.get(topic)
    const updatedSession = { ..._session, namespaces }
    this.logger.info('Session updated:', updatedSession)
    this.signers = this.signers.filter((signer) => signer.topic !== topic)
    this.signers.push(...this.createSigners(updatedSession))
  }

  private handleSessionDelete(event: { topic: string }) {
    this.logger.info('Session deleted:', event)
    let deletedSigner: boolean = false
    this.signers = this.signers.filter((signer) => {
      if (signer.topic !== event.topic) {
        return true
      }
      deletedSigner = true
      return false
    })
    // prevent emitting disconnected event if signers is untouched.
    if (deletedSigner) {
      try {
        this.disconnect(event.topic)
      } catch (e) {
        this.logger.error('Error disconnecting session:', e)
      }
      this.logger.info('Session deleted and signer removed')
    }
  }

  private handlePairingDelete(event: { topic: string }) {
    this.logger.info('Pairing deleted:', event)
    this.signers = this.signers.filter((signer) => signer.topic !== event.topic)
    try {
      this.disconnect(event.topic)
    } catch (e) {
      this.logger.error('Error disconnecting pairing:', e)
    }
    this.logger.info('Pairing deleted by wallet')
  }

  // Store the last connected randomSessionIdentifier
  private async handleRelayConnected() {
    if (!this.walletConnectClient) {
      this.logger.error('walletConnectClient not found')
      return
    }
    const core = this.walletConnectClient.core
    const instanceId = core.crypto.randomSessionIdentifier
    await core.storage.setItem(this.storagePrefix + 'last-connected-instance', instanceId)
  }

  // In the event of another tab being connected after the current one,
  // the current tab will be forcibly reconnected to the relay so that
  // a response to the request can be received.
  // https://github.com/hashgraph/hedera-wallet-connect/issues/387
  private async verifyLastConnectedInstance() {
    if (!this.walletConnectClient) {
      this.logger.error('walletConnectClient not found')
      return
    }

    const core = this.walletConnectClient.core
    const instanceId = core.crypto.randomSessionIdentifier

    const isOnlineStatus = await isOnline()
    const lastConnectedInstanceId = await core.storage.getItem(
      this.storagePrefix + 'last-connected-instance',
    )

    if (lastConnectedInstanceId != instanceId && isOnlineStatus) {
      this.logger.info('Forced reconnecting to the relay')
      await core.relayer.restartTransport()
    }
  }
}

export default DAppConnector
