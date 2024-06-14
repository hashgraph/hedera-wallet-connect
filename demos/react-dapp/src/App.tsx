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
  ExtensionData,
  DAppSigner,
  SignMessageParams,
  SignAndExecuteTransactionParams,
  transactionToBase64String,
  SignAndExecuteQueryParams,
  ExecuteTransactionParams,
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
  const [signers, setSigners] = useState<DAppSigner[]>([])
  const [selectedSigner, setSelectedSigner] = useState<DAppSigner | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  // Extension Wallet Buttons
  const [extensions, setExtensions] = useState<ExtensionData[]>([])

  // Form data states
  const [signerAccount, setSignerAccount] = useState('')
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

  useEffect(() => {
    if (dAppConnector) {
      setSigners(dAppConnector.signers)
    }
  }, [sessions])

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
    client.setOperator(signerAccount, signerPrivateKey)

    const hbarAmount = new Hbar(Number(amount))
    const transaction = new TransferTransaction()
      .setTransactionId(TransactionId.generate(signerAccount))
      .addHbarTransfer(signerAccount, hbarAmount.negated())
      .addHbarTransfer(receiver, hbarAmount)
      .freezeWith(client)

    const signedTransaction = await transaction.signWithOperator(client)
    const transactionList = transactionToBase64String(signedTransaction)

    const params: ExecuteTransactionParams = { transactionList }

    return await dAppConnector!.executeTransaction(params)
  }

  // 3. hedera_signMessage
  const handleSignMessage = async () => {
    modalWrapper(async () => {
      if (!selectedSigner) throw new Error('Selected signer is required')
      const params: SignMessageParams = {
        signerAccountId: 'hedera:testnet:' + selectedSigner.getAccountId().toString(),
        message,
      }

      const { signatureMap } = await dAppConnector!.signMessage(params)
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
      if (!selectedSigner) throw new Error('Selected signer is required')
      const accountId = selectedSigner.getAccountId()
      const query = new AccountInfoQuery().setAccountId(accountId)

      const params: SignAndExecuteQueryParams = {
        signerAccountId: 'hedera:testnet:' + accountId.toString(),
        query: queryToBase64String(query),
      }

      const { response } = await dAppConnector!.signAndExecuteQuery(params)
      const bytes = Buffer.from(response, 'base64')
      const accountInfo = AccountInfo.fromBytes(bytes)
      console.log('AccountInfo: ', accountInfo)
      return accountInfo
    })
  }

  // 5. hedera_signAndExecuteTransaction
  const handleHederaSignAndExecuteTransaction = async () => {
    const accountId = selectedSigner!.getAccountId()
    const hbarAmount = new Hbar(Number(amount))

    const transaction = new TransferTransaction()
      .setTransactionId(TransactionId.generate(accountId!))
      .addHbarTransfer(accountId, hbarAmount.negated())
      .addHbarTransfer(receiver, hbarAmount)

    const params: SignAndExecuteTransactionParams = {
      transactionList: transactionToBase64String(transaction),
      signerAccountId: 'hedera:testnet:' + accountId.toString(),
    }

    const result = await dAppConnector!.signAndExecuteTransaction(params)

    console.log('JSONResponse: ', result)
    return result
  }

  // 6. hedera_signTransaction
  const handleHederaSignTransaction = async () => {
    const accountId = selectedSigner!.getAccountId()
    const hbarAmount = new Hbar(Number(amount))
    const transaction = new TransferTransaction()
      .setTransactionId(TransactionId.generate(accountId!))
      .addHbarTransfer(accountId.toString()!, hbarAmount.negated())
      .addHbarTransfer(receiver, hbarAmount)

    const transactionSigned = await selectedSigner!.signTransaction(transaction)

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

    _dAppConnector.onSessionIframeCreated = (session) => {
      setNewSession(session)
    }

    _dAppConnector?.extensions?.forEach((extension) => {
      console.log('extension: ', extension)
    })

    if (_dAppConnector) {
      const extensionData = _dAppConnector.extensions?.filter(
        (extension) => extension.available,
      )
      if (extensionData) setExtensions(extensionData)

      setDAppConnector(_dAppConnector)
      setSigners(_dAppConnector.signers)
      setSelectedSigner(_dAppConnector.signers[0])
      const _sessions = _dAppConnector.walletConnectClient?.session.getAll()
      if (_sessions && _sessions?.length > 0) {
        setSessions(_sessions)
      }
    }
    saveData()
  }

  const handleConnect = async (extensionId?: string) => {
    try {
      if (!dAppConnector) throw new Error('DAppConnector is required')
      let session: SessionTypes.Struct
      setIsLoading(true)
      if (extensionId) session = await dAppConnector.connectExtension(extensionId)
      else session = await dAppConnector.openModal()

      setNewSession(session)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisconnectSessions = async () => {
    modalWrapper(async () => {
      await dAppConnector!.disconnectAll()
      setSessions([])
      setSigners([])
      setSelectedSigner(null)
      setModalData({ status: 'Success', message: 'Session disconnected' })
    })
  }

  const setNewSession = (session: SessionTypes.Struct) => {
    setSessions((prev) => [...prev, session])
    const sessionAccount = session.namespaces?.hedera?.accounts?.[0]
    const accountId = sessionAccount?.split(':').pop()
    if (!accountId) console.error('No account id found in the session')
    else setSelectedSigner(dAppConnector?.getSigner(AccountId.fromString(accountId))!)
    console.log('New connected session: ', session)
    console.log('New connected accounts: ', session.namespaces?.hedera?.accounts)
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
    () => !dAppConnector || !selectedSigner,
    [dAppConnector, selectedSigner],
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
            {isLoading && <p>Loading...</p>}
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
              <button disabled={!dAppConnector || isLoading} onClick={() => handleConnect()}>
                Open WalletConnect Modal
              </button>
              {extensions.map((extension, index) => (
                <button
                  disabled={isLoading}
                  key={index}
                  onClick={() => handleConnect(extension.id)}
                >
                  Open {extension.name}
                </button>
              ))}
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
                accounts={signers.map((signer) => signer.getAccountId())}
                selectedAccount={selectedSigner?.getAccountId() || null}
                onSelect={(accountId) =>
                  setSelectedSigner(dAppConnector?.getSigner(accountId)!)
                }
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
                accounts={signers.map((signer) => signer.getAccountId())}
                selectedAccount={selectedSigner?.getAccountId() || null}
                onSelect={(accountId) =>
                  setSelectedSigner(dAppConnector?.getSigner(accountId)!)
                }
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
              {selectedTransactionMethod === 'hedera_executeTransaction' ? (
                <>
                  <label>
                    Signer AccountId:
                    <input
                      value={signerAccount}
                      onChange={(e) => setSignerAccount(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Signer Private Key:
                    <input
                      value={signerPrivateKey}
                      onChange={(e) => setSignerPrivateKey(e.target.value)}
                      required
                    />
                  </label>
                </>
              ) : (
                <AccountSelector
                  accounts={signers.map((signer) => signer.getAccountId())}
                  selectedAccount={selectedSigner?.getAccountId() || null}
                  onSelect={(accountId) =>
                    setSelectedSigner(dAppConnector?.getSigner(accountId)!)
                  }
                />
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
                  if (!dAppConnector) throw new Error('DAppConnector is required')
                  if (!selectedSigner) throw new Error('Selected signer is required')
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
        {accounts?.map((accountId, index) => (
          <option key={index} value={accountId.toString()}>
            {accountId.toString()}
          </option>
        ))}
      </select>
    </label>
  )
}
