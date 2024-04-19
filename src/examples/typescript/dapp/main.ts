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
// https://docs.walletconnect.com/2.0/api/sign/dapp-usage
import { SessionTypes, SignClientTypes } from '@walletconnect/types'
import {
  Transaction,
  TransferTransaction,
  Hbar,
  TransactionId,
  AccountInfoQuery,
  AccountId,
  Timestamp,
  LedgerId,
  PublicKey,
  AccountInfo,
} from '@hashgraph/sdk'
import { proto } from '@hashgraph/proto'
import {
  HederaSessionEvent,
  HederaJsonRpcMethod,
  transactionToBase64String,
  transactionToTransactionBody,
  transactionBodyToBase64String,
  base64StringToSignatureMap,
  base64StringToUint8Array,
  queryToBase64String,
  ExecuteTransactionParams,
  SignMessageParams,
  SignAndExecuteQueryParams,
  SignAndExecuteTransactionParams,
  SignTransactionParams,
  DAppConnector,
  HederaChainId,
  verifyMessageSignature,
  verifySignerSignature,
} from '@hashgraph/hedera-wallet-connect'

import { saveState, loadState, getState } from '../shared'

// referenced in handlers
var dAppConnector: DAppConnector | undefined
/*
 * Simple handler to show errors or success to user
 */
async function showErrorOrSuccess<R>(method: (e: SubmitEvent) => Promise<R>, e: SubmitEvent) {
  try {
    e.preventDefault()
    saveState(e)
    const result = await method(e)
    console.log(result)
    alert(`Success: ${JSON.stringify(result)}`)
  } catch (e) {
    console.error(e)
    alert(`Error: ${JSON.stringify(e)}`)
  }
}

/**
 * Render connected accounts
 */
function renderConnectedAccounts(session: SessionTypes.Struct) {
  const topic = session.topic
  const accountIds = session.namespaces.hedera.accounts
    .map((acc: string) => acc.split(':')[2])
    .join(',')

  const form = document.getElementById('connected-accounts')
  const fieldset = document.createElement('fieldset')

  const topicLabel = document.createElement('label')
  topicLabel.textContent = 'Topic: ' + topic

  const accountsLabel = document.createElement('label')
  accountsLabel.textContent = 'AccountIds: ' + accountIds

  const button = document.createElement('button')
  button.textContent = 'Disconnect Account'
  button.addEventListener('click', (event) => {
    event.preventDefault()
    dAppConnector.disconnect(topic)
    form!.removeChild(fieldset)
  })

  fieldset.appendChild(topicLabel)
  fieldset.appendChild(accountsLabel)
  fieldset.appendChild(button)

  form!.appendChild(fieldset)
}

/*
 * WalletConnect
 *  - signClient
 *  - activeSession
 *  - init
 *  - connect
 *  - disconnect
 */
loadState() // load previous state if it exists

// Initialize WalletConnect library
async function init(e: Event) {
  const projectId = getState('project-id')
  const metadata: SignClientTypes.Metadata = {
    name: getState('name'),
    description: getState('description'),
    url: getState('url'),
    icons: [getState('icons')],
  }

  dAppConnector = new DAppConnector(
    metadata,
    LedgerId.TESTNET,
    projectId,
    Object.values(HederaJsonRpcMethod),
    [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
    [HederaChainId.TESTNET],
  )

  await dAppConnector.init({ logger: 'error' })

  const sessions = dAppConnector.walletConnectClient.session.getAll()
  sessions.forEach((session: SessionTypes.Struct) => renderConnectedAccounts(session))

  const eventTarget = e.target as HTMLElement
  eventTarget
    .querySelectorAll('input,button')
    .forEach((input) => ((input as HTMLInputElement).disabled = true))
  document
    .querySelectorAll('.toggle input,.toggle button, .toggle select')
    .forEach((element) => ((element as HTMLInputElement).disabled = false))

  return 'dApp: WalletConnect initialized!'
}

document.getElementById('init')!.onsubmit = (e: SubmitEvent) => showErrorOrSuccess(init, e)

// connect a new pairing string to a wallet via the WalletConnect modal
async function connect(_: Event) {
  const session = await dAppConnector!.openModal()
  console.log({ session })

  renderConnectedAccounts(session)

  return 'Connected to wallet!'
}

document.getElementById('connect')!.onsubmit = (e: SubmitEvent) =>
  showErrorOrSuccess(connect, e)

// disconnect
async function disconnect(e: Event) {
  e.preventDefault()
  dAppConnector!.disconnectAll()
}

document.querySelector<HTMLFormElement>('#disconnect')!.onsubmit = (e: SubmitEvent) =>
  showErrorOrSuccess(disconnect, e)

/*
 * JSON RPC Methods
 */
// 1. hedera_getNodeAddresses
async function hedera_getNodeAddresses(_: Event) {
  return await dAppConnector!.getNodeAddresses()
}

document.getElementById('hedera_getNodeAddresses')!.onsubmit = (e: SubmitEvent) =>
  showErrorOrSuccess(hedera_getNodeAddresses, e)

// 2. hedera_executeTransaction
async function hedera_executeTransaction(_: Event) {
  const bodyBytes = Buffer.from(getState('execute-transaction-body'), 'base64')
  const sigMap = base64StringToSignatureMap(getState('execute-transaction-signature-map'))

  const bytes = proto.Transaction.encode({ bodyBytes, sigMap }).finish()
  const transactionList = transactionToBase64String(Transaction.fromBytes(bytes))

  const params: ExecuteTransactionParams = { transactionList }

  return await dAppConnector!.executeTransaction(params)
}
document.getElementById('hedera_executeTransaction')!.onsubmit = (e: SubmitEvent) =>
  showErrorOrSuccess(hedera_executeTransaction, e)

// 3. hedera_signMessage
async function hedera_signMessage(_: Event) {
  const message = getState('sign-message')
  const params: SignMessageParams = {
    signerAccountId: 'hedera:testnet:' + getState('sign-message-from'),
    message,
  }

  const { signatureMap } = await dAppConnector!.signMessage(params)
  const accountPublicKey = PublicKey.fromString(getState('public-key'))
  const verified = verifyMessageSignature(message, signatureMap, accountPublicKey)

  document.getElementById('sign-message-result')!.innerHTML =
    `Message signed - ${verified}: ${message}`
  return signatureMap
}

document.getElementById('hedera_signMessage')!.onsubmit = (e: SubmitEvent) =>
  showErrorOrSuccess(hedera_signMessage, e)

// 4. SignAndExecuteQuery
async function hedera_signAndExecuteQuery(_: Event) {
  const query = new AccountInfoQuery().setAccountId(getState('query-payment-account'))
  const params: SignAndExecuteQueryParams = {
    signerAccountId: 'hedera:testnet:' + getState('query-payment-account'),
    query: queryToBase64String(query),
  }

  /*
   * We expect the response to be the bytes of the AccountInfo protobuf
   */
  const { response } = await dAppConnector!.signAndExecuteQuery(params)
  const bytes = Buffer.from(response, 'base64')
  const accountInfo = AccountInfo.fromBytes(bytes)
  console.log(accountInfo)
  return accountInfo
}

document.getElementById('hedera_signAndExecuteQuery')!.onsubmit = (e: SubmitEvent) =>
  showErrorOrSuccess(hedera_signAndExecuteQuery, e)

// 5. hedera_signAndExecuteTransaction
async function hedera_signAndExecuteTransaction(_: Event) {
  const transaction = new TransferTransaction()
    .setTransactionId(TransactionId.generate(getState('sign-send-from')))
    .addHbarTransfer(getState('sign-send-from'), new Hbar(-getState('sign-send-amount')))
    .addHbarTransfer(getState('sign-send-to'), new Hbar(+getState('sign-send-amount')))

  const params: SignAndExecuteTransactionParams = {
    transactionList: transactionToBase64String(transaction),
    signerAccountId: 'hedera:testnet:' + getState('sign-send-from'),
  }

  console.log(params)

  return await dAppConnector!.signAndExecuteTransaction(params)
}
document.getElementById('hedera_signAndExecuteTransaction')!.onsubmit = (e: SubmitEvent) =>
  showErrorOrSuccess(hedera_signAndExecuteTransaction, e)

// 6. hedera_signTransaction
async function hedera_signTransaction(_: Event) {
  const transaction = new TransferTransaction()
    .setTransactionId(TransactionId.generate(getState('sign-from')))
    .setMaxTransactionFee(new Hbar(1))
    .addHbarTransfer(getState('sign-from'), new Hbar(-getState('sign-amount')))
    .addHbarTransfer(getState('sign-to'), new Hbar(+getState('sign-amount')))

  const params: SignTransactionParams = {
    signerAccountId: 'hedera:testnet:' + getState('sign-from'),
    transactionBody: transactionBodyToBase64String(
      // must specify a node account id for the transaction body
      transactionToTransactionBody(transaction, AccountId.fromString('0.0.3')),
    ),
  }

  const { signatureMap } = await dAppConnector!.signTransaction(params)
  document.getElementById('sign-transaction-result')!.innerText = JSON.stringify(
    { params, signatureMap },
    null,
    2,
  )
  console.log({ params, signatureMap })
}
document.getElementById('hedera_signTransaction')!.onsubmit = (e: SubmitEvent) =>
  showErrorOrSuccess(hedera_signTransaction, e)

/*
 * Error handling simulation
 */
async function simulateGossipNodeError(_: Event) {
  const sender = getState('sign-send-from') || getState('send-from')
  const recepient = getState('sign-send-to') || getState('send-to')

  const transaction = new TransferTransaction()
    .setNodeAccountIds([new AccountId(999)]) // this is invalid node id
    .setTransactionId(TransactionId.generate(sender))
    .addHbarTransfer(sender, new Hbar(-5))
    .addHbarTransfer(recepient, new Hbar(+5))

  const params: SignAndExecuteTransactionParams = {
    transactionList: transactionToBase64String(transaction),
    signerAccountId: 'hedera:testnet:' + getState('sign-send-from'),
  }

  return await dAppConnector!.signAndExecuteTransaction(params)
}

document.getElementById('error-gossip-node')!.onsubmit = (e: SubmitEvent) =>
  showErrorOrSuccess(simulateGossipNodeError, e)

async function simulateTransactionExpiredError(_: Event) {
  const sender = 'hedera:testnet:' + (getState('sign-send-from') || getState('send-from'))
  const recepient = getState('sign-send-to') || getState('send-to')

  const transaction = new TransferTransaction()
    // set valid start to 15 seconds ago
    .setTransactionId(
      TransactionId.withValidStart(
        AccountId.fromString(sender),
        Timestamp.fromDate(Date.now() - 15000),
      ),
    )
    // 15 seconds is a minimum valid duration otherwise there's an INVALID_TRANSACTION_DURATION error
    .setTransactionValidDuration(15)
    .addHbarTransfer(sender, new Hbar(-5))
    .addHbarTransfer(recepient, new Hbar(+5))

  const params: SignAndExecuteTransactionParams = {
    transaction: transactionToBase64String(transaction),
    signerAccountId: sender,
  }

  return await dAppConnector!.signAndExecuteTransaction(params)
}

document.getElementById('error-transaction-expired')!.onsubmit = (e: SubmitEvent) =>
  showErrorOrSuccess(simulateTransactionExpiredError, e)

async function signer_signAndExecuteTransaction(_: Event) {
  const transaction = new TransferTransaction()
    .addHbarTransfer(getState('sign-send-from'), new Hbar(-getState('sign-send-amount')))
    .addHbarTransfer(getState('sign-send-to'), new Hbar(+getState('sign-send-amount')))

  const signer = dAppConnector!.signers[0]
  await transaction.freezeWithSigner(signer)
  return await transaction.executeWithSigner(signer)
}
document.getElementById('signer_signAndExecuteTransaction')!.onsubmit = (e: SubmitEvent) =>
  showErrorOrSuccess(signer_signAndExecuteTransaction, e)

async function signer_signTransaction(_: Event) {
  const transaction = new TransferTransaction()
    .addHbarTransfer(getState('sign-send-from'), new Hbar(-getState('sign-send-amount')))
    .addHbarTransfer(getState('sign-send-to'), new Hbar(+getState('sign-send-amount')))

  const signer = dAppConnector!.signers[0]
  await transaction.freezeWithSigner(signer)
  return await signer.signTransaction(transaction)
}
document.getElementById('signer_signTransaction')!.onsubmit = (e: SubmitEvent) =>
  showErrorOrSuccess(signer_signTransaction, e)

async function signer_sign(_: Event) {
  const text = getState('sign-text')
  const base64String = btoa(text)
  const signer = dAppConnector!.signers[0]
  const sigMaps = await signer.sign([base64StringToUint8Array(base64String)])
  const verifiedResult = verifySignerSignature(base64String, sigMaps[0], sigMaps[0].publicKey)
  return { verifiedResult, sigMaps }
}
document.getElementById('signer_sign')!.onsubmit = (e: SubmitEvent) =>
  showErrorOrSuccess(signer_sign, e)

async function signer_getAccountBalance(_: Event) {
  const signer = dAppConnector!.signers[0]
  return await signer.getAccountBalance()
}
document.getElementById('signer_getAccountBalance')!.onsubmit = (e: SubmitEvent) =>
  showErrorOrSuccess(signer_getAccountBalance, e)

async function signer_getAccountInfo(_: Event) {
  const signer = dAppConnector!.signers[0]
  return await signer.getAccountInfo()
}
document.getElementById('signer_getAccountInfo')!.onsubmit = (e: SubmitEvent) =>
  showErrorOrSuccess(signer_getAccountInfo, e)

async function signer_getAccountRecords(_: Event) {
  const signer = dAppConnector!.signers[0]
  return await signer.getAccountRecords()
}
document.getElementById('signer_getAccountRecords')!.onsubmit = (e: SubmitEvent) =>
  showErrorOrSuccess(signer_getAccountRecords, e)
