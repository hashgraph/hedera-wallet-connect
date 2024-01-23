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

import type { Web3WalletTypes } from '@walletconnect/web3wallet'
import type { SessionTypes } from '@walletconnect/types'
import type { Transaction, Query, AccountId, Wallet as HederaWallet } from '@hashgraph/sdk'
import type { HederaJsonRpcMethod, HederaChainId } from '../shared'
import type Provider from './provider'

export interface HederaNativeWallet {
  /*
   * Session helpers
   */
  buildAndApproveSession(
    accounts: string[],
    { id, params }: Web3WalletTypes.SessionProposal,
  ): Promise<SessionTypes.Struct>

  parseSessionRequest(
    event: Web3WalletTypes.SessionRequest,
    shouldThrow: boolean,
  ): {
    method: HederaJsonRpcMethod
    chainId: HederaChainId
    id: number // session request id
    topic: string // session topic
    body?: Transaction | Query<any> | string | Uint8Array | undefined
    accountId?: AccountId
  }

  executeSessionRequest(
    event: Web3WalletTypes.SessionRequest,
    hederaWallet: HederaWallet,
  ): Promise<void>

  rejectSessionRequest(
    event: Web3WalletTypes.SessionRequest,
    error: { code: number; message: string },
  ): Promise<void>

  /*
   * Hedera wallet helper
   */
  getHederaWallet(
    chainId: HederaChainId,
    accountId: AccountId | string,
    privateKey: string,
    _provider?: Provider,
  ): HederaWallet

  /*
   * JSON-RPC methods
   */
  [HederaJsonRpcMethod.GetNodeAddresses](
    id: number,
    topic: string,
    _: any, // ignore this param to be consistent call signature with other functions
    signer: HederaWallet,
  ): Promise<void>

  [HederaJsonRpcMethod.ExecuteTransaction](
    id: number,
    topic: string,
    body: Transaction,
    signer: HederaWallet,
  ): Promise<void>

  [HederaJsonRpcMethod.SignMessage](
    id: number,
    topic: string,
    body: string,
    signer: HederaWallet,
  ): Promise<void>

  [HederaJsonRpcMethod.SignAndExecuteQuery](
    id: number,
    topic: string,
    body: Query<any>,
    signer: HederaWallet,
  ): Promise<void>

  [HederaJsonRpcMethod.SignAndExecuteTransaction](
    id: number,
    topic: string,
    body: Transaction,
    signer: HederaWallet,
  ): Promise<void>

  [HederaJsonRpcMethod.SignTransaction](
    id: number,
    topic: string,
    body: Uint8Array,
    signer: HederaWallet,
  ): Promise<void>
}

// placeholder for EIP:155 support
export interface HederaEvmCompatibleWallet {}
