import SignClient from '@walletconnect/sign-client'
import { PrivateKey, AccountId } from '../../../node_modules/@hashgraph/sdk/src/browser.js'

/*
 * Required params for the demo
 */
const params = {
  accountId: 'your Hedera testnet account id. (https://portal.hedera.com/)',
  privateKey: 'your Hedera testnet private key. (https://portal.hedera.com/)',
  projectId: 'your wallet’s project id from https://cloud.walletconnect.com',
}

/*
 * window.onload
 * See if all required params are already in the session
 */
window.onload = function onload() {
  for (const [key, _] of Object.entries(params))
    if (!sessionStorage.getItem(key)) {
      sessionStorage.clear()
      throw new Error('Wallet environment not initialized')
    }

  // if all env variables are initialized, show the pair button
  document.querySelectorAll('.toggle').forEach((el) => {
    el.classList.toggle('hidden')
  })
}

/*
 * Prompt user for required params
 */
window.initializeSession = async function initialize() {
  for (const [key, message] of Object.entries(params)) {
    let value = undefined
    while (!value) value = prompt(`Please enter ${message}`) || undefined

    if (value) sessionStorage.setItem(key, value)
    else throw new Error(`No ${key} provided`)
  }

  document.querySelectorAll('.toggle').forEach((el) => {
    el.classList.toggle('hidden')
  })
}
/*
 * WalletConnect setup
 * https://docs.walletconnect.com/2.0/api/sign/dapp-usage
 */
async function initializeWalletConnect() {
  const accountId = AccountId.fromString(sessionStorage.getItem('accountId'))
  const projectId = sessionStorage.getItem('projectId')

  const signClient = await SignClient.init({
    projectId,
    metadata: {
      name: 'Wallet',
      description: 'This is a wallet.',
      url: 'https://hgraph.app',
      icons: ['https://walletconnect.com/walletconnect-logo.png'],
    },
  })

  /*
   * Add listeners
   */

  signClient.on('session_proposal', async (event) => {
    console.log('session_proposal')
    console.log(event)
    const {
      id,
      params: { requiredNamespaces },
    } = event
    await signClient.approve({
      id,
      namespaces: {
        hedera: {
          accounts: [`hedera:testnet:${accountId.toString()}`],
          methods: requiredNamespaces.hedera.methods,
          events: requiredNamespaces.hedera.events,
        },
      },
    })
  })

  signClient.on('session_update', ({ topic, params }) => {
    console.log('session_update')
    const { namespaces } = params
    const _session = signClient.session.get(topic)
    // Overwrite the `namespaces` of the existing session with the incoming one.
    const updatedSession = { ..._session, namespaces }
    // Integrate the updated session state into your dapp state.
    console.log(updatedSession)
  })

  signClient.on('session_delete', () => {
    console.log('session deleted')
    // Session was deleted -> reset the dapp state, clean up from user session, etc.
  })
  return signClient
}

/*
 * Create a session on user action
 */
window.pair = async function pair() {
  const signClient = await initializeWalletConnect()
  const uri = (document.querySelector('input[name="uri"]') as HTMLInputElement)?.value
  if (!uri) throw new Error('No URI')

  await signClient.core.pairing.pair({ uri })
}
