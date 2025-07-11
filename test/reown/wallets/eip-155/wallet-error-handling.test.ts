/*
 *
 * Hedera Wallet Connect
 *
 * Copyright (C) 2025 Hedera Hashgraph, LLC
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

import { EIP155Wallet } from '../../../../src/reown/wallets/EIP155Wallet'
import { formatJsonRpcError } from '@walletconnect/jsonrpc-utils'
import { PrivateKey } from '@hashgraph/sdk'

import {
  testPrivateKeyECDSA,
  requestId,
  requestTopic,
} from '../../../_helpers'
import {
  HederaChainDefinition,
  Eip155JsonRpcMethod,
  WalletRequestEventArgs,
} from '../../../../src/reown/utils'

describe('EIP155Wallet Error Handling', () => {
  let wallet: EIP155Wallet
  const privateKey = `0x${PrivateKey.fromStringECDSA(testPrivateKeyECDSA).toStringRaw()}`
  const chainId = HederaChainDefinition.EVM.Testnet.caipNetworkId

  const createEvent = (method: Eip155JsonRpcMethod, params: any[]): WalletRequestEventArgs => ({
    id: requestId,
    topic: requestTopic,
    params: {
      request: { method, params },
      chainId,
    },
  })

  beforeEach(() => {
    wallet = EIP155Wallet.init({ privateKey })
  })

  it('returns specific error message when eth_sign throws Error', async () => {
    const event = createEvent(Eip155JsonRpcMethod.Sign, ['0xdead', 'message'])
    jest.spyOn(wallet, 'eth_sign').mockRejectedValue(new Error('boom'))

    const result = await wallet.approveSessionRequest(event)
    expect(result).toEqual(formatJsonRpcError(requestId, 'boom'))
  })

  it('returns failed typed data message when signTypedData throws non-Error', async () => {
    const typedData = {
      domain: {},
      types: { EIP712Domain: [], Test: [{ name: 'x', type: 'string' }] },
      message: { x: '1' },
    }
    const event = createEvent(Eip155JsonRpcMethod.SignTypedData, [typedData])
    jest.spyOn(wallet, 'eth_signTypedData').mockImplementation(() => {
      throw 'failure'
    })

    const result = await wallet.approveSessionRequest(event)
    expect(result).toEqual(formatJsonRpcError(requestId, 'Failed to sign typed data'))
  })

  it('returns specific error message when signTransaction throws Error', async () => {
    const event = createEvent(Eip155JsonRpcMethod.SignTransaction, [{ to: '0x1', value: '0x1' }])
    jest.spyOn(wallet, 'eth_signTransaction').mockRejectedValue(new Error('bad tx'))

    const result = await wallet.approveSessionRequest(event)
    expect(result).toEqual(formatJsonRpcError(requestId, 'bad tx'))
  })

  it('returns specific error when eth_sendTransaction throws Error', async () => {
    const event = createEvent(Eip155JsonRpcMethod.SendTransaction, [{ to: '0x1', value: '0x1' }])
    jest.spyOn(wallet, 'eth_sendTransaction').mockRejectedValue(new Error('send fail'))

    const result = await wallet.approveSessionRequest(event)
    expect(result).toEqual(formatJsonRpcError(requestId, 'send fail'))
  })
})
