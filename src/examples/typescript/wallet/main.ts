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

// https://github.com/WalletConnect/walletconnect-monorepo/tree/v2.0/packages/web3wallet
import type { Web3WalletTypes } from '@walletconnect/web3wallet'
import { getSdkError } from '@walletconnect/utils'
import { Wallet, HederaChainId } from '@hashgraph/walletconnect'
import { loadState, saveState } from '../shared'

// referenced in handlers
var wallet: Wallet | undefined
loadState() // load previous state if it exists

/*
 * Initialize wallet
 */
async function init(e: Event) {
  const state = saveState(e)

  const projectId = state['project-id']
  const metadata: Web3WalletTypes.Metadata = {
    name: state['name'],
    description: state['description'],
    url: state['url'],
    icons: [state['icons']],
  }

  wallet = await Wallet.create(projectId, metadata)

  /*
   * Add listeners
   */
  // called after pairing to set parameters of session, i.e. accounts, chains, methods, events
  wallet.on('session_proposal', async (proposal: Web3WalletTypes.SessionProposal) => {
    // Client logic: prompt for approval of accounts
    const accountId = state['account-id']
    const chainId = HederaChainId.Testnet
    const accounts: string[] = [`${chainId}:${accountId}`]

    if (confirm(`Do you want to connect to this session?: ${JSON.stringify(proposal)}`))
      wallet!.buildAndApproveSession(accounts, proposal)
    else
      await wallet!.rejectSession({
        id: proposal.id,
        reason: getSdkError('USER_REJECTED_METHODS'),
      })
  })

  // requests to call a JSON-RPC method
  wallet.on('session_request', async (event: Web3WalletTypes.SessionRequest) => {
    try {
      // Client logic: prompt user for approval of request
      const { chainId, accountId } = wallet!.parseSessionRequest(event)

      if (!confirm(`Do you want to proceed with this request?: ${JSON.stringify(event)}`))
        throw getSdkError('USER_REJECTED_METHODS')

      // A custom provider/signer can be used to sign transactions
      // https://docs.hedera.com/hedera/sdks-and-apis/sdks/signature-provider/wallet
      const hederaWallet = wallet!.getHederaWallet(
        chainId,
        accountId || state['account-id'],
        state['private-key'],
      )

      return await wallet!.executeSessionRequest(event, hederaWallet)
    } catch (e) {
      console.error(e)
      wallet!.rejectSessionRequest(event, e)
    }
  })

  wallet.on('session_delete', () => {
    // Session was deleted
    console.log('Wallet: Session deleted by dapp!')
    //
  })
  //https://docs.walletconnect.com/api/core/pairing
  wallet.core.pairing.events.on('pairing_delete', (pairing: string) => {
    // Session was deleted
    console.log(pairing)
    console.log(`Wallet: Pairing deleted by dapp!`)
    // clean up after the pairing for `topic` was deleted.
  })

  const eventTarget = e.target as HTMLElement
  eventTarget
    .querySelectorAll('input,button')
    .forEach((input) => ((input as HTMLInputElement).disabled = true))
  document
    .querySelectorAll('.toggle input,.toggle button, .toggle select')
    .forEach((element) => ((element as HTMLInputElement).disabled = false))

  console.log('Wallet: WalletConnect initialized!')
}

document.querySelector<HTMLFormElement>('#init')!.onsubmit = init
/*
 * Handle pairing event on initialized wallet
 */
async function pair(e: Event) {
  const { uri } = saveState(e)
  wallet!.core.pairing.pair({ uri })
}

document.querySelector<HTMLFormElement>('#pair')!.onsubmit = pair

/*
 * Handle adding a hedera account
 */
document.querySelector<HTMLFormElement>('#set-account')!.onsubmit = function (event) {
  saveState(event)

  console.log('-'.repeat(10))
  console.log('Account saved!')
  console.log('-'.repeat(10))
}

/*
 * Handle changes in wallet
 */
async function disconnect(e: Event) {
  e.preventDefault()
  //https://docs.walletconnect.com/web3wallet/wallet-usage#session-disconnect
  for (const session of Object.values(wallet!.getActiveSessions())) {
    console.log(`Disconnecting from session: ${session}`)
    await wallet!.disconnectSession({
      // @ts-ignore
      topic: session.topic,
      reason: getSdkError('USER_DISCONNECTED'),
    })
  }
  for (const pairing of wallet!.core.pairing.getPairings()) {
    console.log(`Disconnecting from pairing: ${pairing}`)
    await wallet!.disconnectSession({
      topic: pairing.topic,
      reason: getSdkError('USER_DISCONNECTED'),
    })
  }
}
document.querySelector<HTMLFormElement>('#disconnect')!.onsubmit = disconnect
// await web3wallet.updateSession({ topic, namespaces: newNs });
