import { Buffer } from 'buffer'
import {
  AccountId,
  AccountInfo,
  AccountInfoQuery,
  Client,
  Hbar,
  LedgerId,
  PublicKey,
  TransactionId,
  TransferTransaction,
} from '@hashgraph/sdk'
import { SessionTypes, SignClientTypes } from '@walletconnect/types'

import {
  HederaSessionEvent,
  HederaJsonRpcMethod,
  queryToBase64String,
  DAppConnector,
  HederaChainId,
  verifyMessageSignature,
} from '@hashgraph/hedera-wallet-connect'

import React, { useEffect, useMemo, useState } from 'react'
import Modal from './components/Modal'

const App: React.FC = () => {
  // Connector data states
  const [projectId, setProjectId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')
  const [icons, setIcons] = useState('')

  // Session management states
  const [dAppConnector, setDAppConnector] = useState<DAppConnector | null>(null)
  const [sessions, setSessions] = useState<SessionTypes.Struct[]>([])
  const [connectedAccountIds, setConnectedAccountIds] = useState<AccountId[]>([])
  const [selectedAccount, setSelectedAccount] = useState<AccountId | null>(null)

  // Form data states
  const [receiver, setReceiver] = useState('')
  const [signerPrivateKey, setSignerPrivateKey] = useState('')
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [selectedTransactionMethod, setSelectedTransactionMethod] = useState(
    'hedera_executeTransaction',
  )

  // Modal states
  const [isModalOpen, setModalOpen] = useState<boolean>(false)
  const [isModalLoading, setIsModalLoading] = useState<boolean>(false)
  const [modalData, setModalData] = useState<any>(null)

  useEffect(() => {
    const state = JSON.parse(localStorage.getItem('hedera-wc-demos-saved-state') || '{}')
    if (state) {
      setProjectId(state['projectId'])
      setName(state['name'])
      setDescription(state['description'])
      setUrl(state['url'])
      setIcons(state['icons'])
      setMessage(state['message'])
      setPublicKey(state['publicKey'])
      setAmount(state['amount'])
      setReceiver(state['receiver'])
    }
  }, [])

  useEffect(() => {
    if (projectId && name && description && url && icons) {
      handleInitConnector()
    }
  }, [projectId])

  const saveData = () => {
    localStorage.setItem(
      'hedera-wc-demos-saved-state',
      JSON.stringify({
        projectId,
        name,
        description,
        url,
        icons,
        message,
        publicKey,
        amount,
        receiver,
      }),
    )
  }

  const modalWrapper = async (fn: () => Promise<any>) => {
    try {
      saveData()
      setModalOpen(true)
      setIsModalLoading(true)
      const result = await fn()
      setModalData({
        status: 'Success',
        message: 'The request has been executed successfully',
        result,
      })
    } catch (error) {
      console.error('Error signing message: ', error)
      setModalData({ status: 'Error', message: error.message })
    } finally {
      setIsModalLoading(false)
    }
  }

  /**
   * WalletConnect methods
   */

  // 1. hedera_getNodeAddresses
  const handleGetNodeAddresses = async () => {
    modalWrapper(async () => {
      const nodeAddresses = await dAppConnector!.getNodeAddresses()
      console.log('NodeAddresses: ', nodeAddresses)
      return nodeAddresses
    })
  }

  // 2. hedera_executeTransaction
  const handleExecuteTransaction = async () => {
    if (!signerPrivateKey) throw new Error('Signer private key is required')

    const client = Client.forTestnet()
    client.setOperator(selectedAccount!, signerPrivateKey)

    const hbarAmount = new Hbar(Number(amount))
    const transaction = new TransferTransaction()
      .setTransactionId(TransactionId.generate(selectedAccount!))
      .setNodeAccountIds([AccountId.fromString('0.0.3')])
      .addHbarTransfer(selectedAccount!, hbarAmount.negated())
      .addHbarTransfer(receiver, hbarAmount)
      .freezeWith(client)

    const signedTransaction = await transaction.signWithOperator(client)

    const result = await dAppConnector!.executeTransaction(selectedAccount!, signedTransaction)
    console.log('JSONResponse: ', result)
    return result
  }

  // 3. hedera_signMessage
  const handleSignMessage = async () => {
    modalWrapper(async () => {
      const { signatureMap } = await dAppConnector!.signMessage(selectedAccount!, message)
      const accountPublicKey = PublicKey.fromString(publicKey)
      const verified = verifyMessageSignature(message, signatureMap, accountPublicKey)
      console.log('SignatureMap: ', signatureMap)
      console.log('Verified: ', verified)
      return {
        signatureMap,
        verified,
      }
    })
  }

  // 4. hedera_signAndExecuteQuery
  const handleExecuteQuery = () => {
    modalWrapper(async () => {
      const query = new AccountInfoQuery().setAccountId(selectedAccount!)
      const { response } = await dAppConnector!.signAndExecuteQuery(
        selectedAccount!,
        queryToBase64String(query),
      )
      const bytes = Buffer.from(response, 'base64')
      const accountInfo = AccountInfo.fromBytes(bytes)
      console.log('AccountInfo: ', accountInfo)
      return accountInfo
    })
  }

  // 5. hedera_signAndExecuteTransaction
  const handleHederaSignAndExecuteTransaction = async () => {
    const hbarAmount = new Hbar(Number(amount))

    const transaction = new TransferTransaction()
      .setTransactionId(TransactionId.generate(selectedAccount!))
      .addHbarTransfer(selectedAccount!, hbarAmount.negated())
      .addHbarTransfer(receiver, hbarAmount)

    const result = await dAppConnector!.signAndExecuteTransaction(selectedAccount!, transaction)
    console.log('JSONResponse: ', result)
    return result
  }

  // 6. hedera_signTransaction
  const handleHederaSignTransaction = async () => {
    const hbarAmount = new Hbar(Number(amount))
    const transaction = new TransferTransaction()
      .setTransactionId(TransactionId.generate(selectedAccount!))
      .addHbarTransfer(selectedAccount!, hbarAmount.negated())
      .addHbarTransfer(receiver, hbarAmount)

    const transactionSigned = await dAppConnector!.signTransaction(
      selectedAccount!,
      transaction,
    )

    console.log('Signed transaction: ', transactionSigned)
    return { transaction: transactionSigned }
  }

  /**
   * Session management methods
   */

  const handleInitConnector = async () => {
    const metadata: SignClientTypes.Metadata = {
      name,
      description,
      url,
      icons: icons.split(','),
    }

    const _dAppConnector = new DAppConnector(
      metadata,
      LedgerId.TESTNET,
      projectId,
      Object.values(HederaJsonRpcMethod),
      [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
      [HederaChainId.Testnet],
    )
    await _dAppConnector.init({ logger: 'error' })

    setDAppConnector(_dAppConnector)
    const _sessions = _dAppConnector.walletConnectClient?.session.getAll()
    if (_sessions) {
      setSessions(_sessions)

      // Select first account as default
      const sessionAccount = _sessions[0].namespaces?.hedera?.accounts?.[0]
      const accountId = sessionAccount?.split(':').pop()
      if (accountId) setSelectedAccount(AccountId.fromString(accountId))
    }
    setConnectedAccountIds(_dAppConnector.accountIds)
    saveData()
  }

  const handleConnect = async () => {
    const session = await dAppConnector!.openModal()
    setSessions((prev) => [...prev, session])
    setConnectedAccountIds(dAppConnector!.accountIds)
    const sessionAccount = session.namespaces?.hedera?.accounts?.[0]
    const accountId = sessionAccount?.split(':').pop()
    if (!accountId) console.error('No account id found in the session')
    else setSelectedAccount(AccountId.fromString(accountId))
    console.log('New connected session: ', session)
    console.log('New connected account: ', accountId)
  }

  const handleDisconnectSessions = async () => {
    modalWrapper(async () => {
      await dAppConnector!.disconnectAll()
      setSessions([])
      setConnectedAccountIds([])
      setModalData({ status: 'Success', message: 'Session disconnected' })
    })
  }

  const handleClearData = () => {
    localStorage.removeItem('hedera-wc-demos-saved-state')
    setProjectId('')
    setName('')
    setDescription('')
    setUrl('')
    setIcons('')
    setMessage('')
    setPublicKey('')
    setAmount('')
    setReceiver('')
  }

  const disableButtons = useMemo(
    () => !dAppConnector || !selectedAccount,
    [dAppConnector, selectedAccount],
  )

  return (
    <>
      <main>
        <h1>dApp</h1>
        <p>
          This demo dApp requires a project id from WalletConnect. Please see
          <a target="_blank" href="https://cloud.walletconnect.com">
            https://cloud.walletconnect.com
          </a>
        </p>
        <section>
          <div>
            <fieldset>
              <legend>Step 1: Initialize WalletConnect</legend>
              <label>
                Project Id:
                <input
                  type="text"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  required
                />
              </label>
              <label>
                Name:
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <label>
                Description:
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </label>
              <label>
                Url:
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              </label>
              <label>
                Icons:
                <input
                  type="text"
                  value={icons}
                  onChange={(e) => setIcons(e.target.value)}
                  required
                />
              </label>
            </fieldset>
            <button
              disabled={!projectId || !name || !description || !url || !icons}
              onClick={handleInitConnector}
            >
              Initialize WalletConnect
            </button>
          </div>
        </section>
        <section>
          <div>
            <fieldset>
              {sessions.length === 0 ? (
                <legend>Step 2: Connect a wallet</legend>
              ) : (
                <>
                  <legend>Connected Wallets</legend>
                  <ul>
                    {sessions.map((session, index) => (
                      <li key={index}>
                        <p>Session ID: {session.topic}</p>
                        <p>Wallet Name: {session.peer.metadata.name}</p>
                        <p>Account IDs: {session.namespaces?.hedera?.accounts?.join(' | ')}</p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <button disabled={!dAppConnector} onClick={handleConnect}>
                Open WalletConnect Modal
              </button>
            </fieldset>
          </div>
        </section>
        <hr />
        <section>
          <fieldset>
            <legend>1. hedera_getNodeAddresses</legend>
            <button disabled={!dAppConnector} onClick={handleGetNodeAddresses}>
              hedera_getNodeAddresses
            </button>
          </fieldset>
        </section>
        <section>
          <div>
            <fieldset>
              <legend>3. hedera_signMessage</legend>
              <AccountSelector
                accounts={connectedAccountIds}
                selectedAccount={selectedAccount}
                onSelect={setSelectedAccount}
              />
              <label>
                Message:
                <input value={message} onChange={(e) => setMessage(e.target.value)} required />
              </label>
              <label>
                Hedera Testnet Public Key:
                <input
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  required
                />
              </label>
              <p>The public key for the account is used to verify the signed message</p>
            </fieldset>
            <button disabled={disableButtons} onClick={handleSignMessage}>
              Submit to wallet
            </button>
          </div>
        </section>
        <section>
          <div>
            <fieldset>
              <legend>4. hedera_signAndExecuteQuery</legend>
              <label>
                Query type:
                <select>
                  <option value="account-info">Account Info</option>
                </select>
              </label>
              <AccountSelector
                accounts={connectedAccountIds}
                selectedAccount={selectedAccount}
                onSelect={setSelectedAccount}
              />
            </fieldset>
            <button disabled={disableButtons} onClick={handleExecuteQuery}>
              hedera_signAndExecuteQuery
            </button>
          </div>
        </section>
        <hr />
        <h2>Transaction methods:</h2>
        <section>
          <label>
            Select a transaction method:
            <select
              value={selectedTransactionMethod}
              onChange={(e) => setSelectedTransactionMethod(e.target.value)}
            >
              <option value={'hedera_executeTransaction'}>2. hedera_executeTransaction</option>
              <option value={'hedera_signAndExecuteTransaction'}>
                5. hedera_signAndExecuteTransaction
              </option>
              <option value={'hedera_signTransaction'}>6. hedera_signTransaction</option>
            </select>
          </label>
          <div>
            <fieldset>
              <label>
                Transaction type:
                <select>
                  <option value="hbar-transfer">Hbar Transfer</option>
                </select>
              </label>
              <AccountSelector
                accounts={connectedAccountIds}
                selectedAccount={selectedAccount}
                onSelect={setSelectedAccount}
              />
              {selectedTransactionMethod === 'hedera_executeTransaction' && (
                <label>
                  Signer Private Key:
                  <input
                    value={signerPrivateKey}
                    onChange={(e) => setSignerPrivateKey(e.target.value)}
                    required
                  />
                </label>
              )}
              <label>
                Send to address:
                <input
                  value={receiver}
                  onChange={(e) => setReceiver(e.target.value)}
                  required
                />
              </label>
              <label>
                Amount in Hbar:
                <input value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </label>
            </fieldset>
            <button
              disabled={disableButtons}
              onClick={() => {
                modalWrapper(async () => {
                  switch (selectedTransactionMethod) {
                    case 'hedera_executeTransaction':
                      return handleExecuteTransaction()
                    case 'hedera_signAndExecuteTransaction':
                      return handleHederaSignAndExecuteTransaction()
                    case 'hedera_signTransaction':
                      return handleHederaSignTransaction()
                  }
                })
              }}
            >
              Submit to wallet
            </button>
          </div>
        </section>
        <hr />
        <h2>Pairing and session management:</h2>
        <section>
          <div>
            <button disabled={!dAppConnector} onClick={handleDisconnectSessions}>
              Disconnect all sessions and pairings
            </button>
            <span> </span>
            <button onClick={handleClearData}>Clear saved data</button>
          </div>
        </section>
        <Modal title="Send Request" isOpen={isModalOpen} onClose={() => setModalOpen(false)}>
          {isModalLoading ? (
            <div className="loading">
              <p>Approve request on wallet</p>
              <span className="loader"></span>
            </div>
          ) : (
            <div>
              <h3>{modalData?.status}</h3>
              <p>{modalData?.message}</p>
              <pre>{JSON.stringify(modalData?.result, null, 2)}</pre>
            </div>
          )}
        </Modal>
      </main>
    </>
  )
}

export default App

interface AccountSelectorProps {
  accounts: AccountId[]
  selectedAccount: AccountId | null
  onSelect: (accountId: AccountId) => void
}

const AccountSelector = ({ accounts, selectedAccount, onSelect }: AccountSelectorProps) => {
  return (
    <label>
      Signer Account:
      <select
        value={selectedAccount?.toString()}
        onChange={(e) => onSelect(AccountId.fromString(e.target.value))}
      >
        {accounts.map((accountId, index) => (
          <option key={index} value={accountId.toString()}>
            {accountId.toString()}
          </option>
        ))}
      </select>
    </label>
  )
}
