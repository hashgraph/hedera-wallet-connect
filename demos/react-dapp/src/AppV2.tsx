import React, { useEffect, useMemo, useState } from 'react'
import Modal from './components/Modal'
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
  AccountCreateTransaction,
  KeyList,
  TopicCreateTransaction,
  TokenCreateTransaction,
  TokenMintTransaction,
  TokenUpdateTransaction,
  TokenId,
  TokenType,
  TokenSupplyType,
  TransactionReceiptQuery,
  Transaction,
} from '@hashgraph/sdk'
import { SessionTypes, SignClientTypes } from '@walletconnect/types'
import * as nacl from 'tweetnacl'
import {
  useDisconnect,
  useAppKitAccount,
  useAppKitNetworkCore,
  useAppKitState,
  useAppKitProvider,
  useWalletInfo,
  getAppKit,
} from '@reown/appkit/react'
import { AppKit, createAppKit } from '@reown/appkit'
import {
  HederaAdapter,
  HederaWalletConnectProvider,
  hederaMainnetEvm,
  hederaMainnetNative,
  hederaNamespace,
  hederaTestnetEvm,
  hederaTestnetNative,
} from '../../../src/reown'
import { UniversalProvider, UniversalProviderOpts } from '@walletconnect/universal-provider'
import {
  queryToBase64String,
  verifyMessageSignature,
  DAppSigner,
  SignMessageParams,
  SignAndExecuteTransactionParams,
  transactionToBase64String,
  SignAndExecuteQueryParams,
  ExecuteTransactionParams,
  base64StringToUint8Array,
  verifySignerSignature,
  transactionToTransactionBody,
  SignTransactionParams,
  base64StringToSignatureMap,
  Uint8ArrayToBase64String,
  extractFirstSignature,
} from '../../../src/lib'
import { AppKitNetwork } from '@reown/appkit/networks'

export default function V2App() {
  const [projectId, setProjectId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')
  const [icons, setIcons] = useState('')
  const [appKit, setAppKit] = useState<AppKit>()

  const storageKey = 'hedera-wc-demos-saved-state-v2-root'

  const handleClearData = () => {
    localStorage.removeItem(storageKey)
    setProjectId('')
    setName('')
    setDescription('')
    setUrl('')
    setIcons('')
  }

  const saveData = () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        projectId,
        name,
        description,
        url,
        icons,
      }),
    )
  }

  useEffect(() => {
    const state = JSON.parse(localStorage.getItem(storageKey) || '{}')
    if (state) {
      setProjectId(state['projectId'])
      setName(state['name'])
      setDescription(state['description'])
      setUrl(state['url'])
      setIcons(state['icons'])
    }
  }, [])

  const handleInitAppKit = async () => {
    const metadata: SignClientTypes.Metadata = {
      name,
      description,
      url,
      icons: icons.split(','),
    }

    const networks = [
      // hederaMainnetEvm,
      // hederaTestnetEvm,
      hederaMainnetNative,
      hederaTestnetNative,
    ] as [AppKitNetwork, ...AppKitNetwork[]]

    const nativeHederaAdapter = new HederaAdapter({
      projectId,
      networks: [hederaMainnetNative, hederaTestnetNative],
      namespace: hederaNamespace,
    })

    // const eip155HederaAdapter = new HederaAdapter({
    //   projectId,
    //   networks: [hederaMainnetEvm, hederaTestnetEvm],
    //   namespace: 'eip155',
    // })

    const universalProvider = await HederaWalletConnectProvider.init({
      projectId,
      metadata,
      logger: 'debug',
    })

    const appKit = createAppKit({
      adapters: [nativeHederaAdapter],
      // @ts-expect-error - UniversalProvider false positive types error
      universalProvider,
      defaultNetwork: hederaTestnetNative,
      projectId,
      metadata,
      networks,
      themeMode: 'light' as const,
      features: {
        analytics: false,
        socials: false,
        swaps: false,
        onramp: false,
        email: false,
      },
    })
    console.log({ appKit });
    getAppKit(appKit)
    setTimeout(() => {
       setAppKit(appKit)
    }, 500);
    
    saveData()
  }


  return (
    <main>
      <h1>Hedera WalletConnect V2 Demo</h1>
      <p>
        This demo dApp requires a project id from WalletConnect. Please see{' '}
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
            onClick={handleInitAppKit}
          >
            Initialize WalletConnect
          </button>
        </div>
      </section>
      { appKit && <V2AppWithAppKit parentClearData={handleClearData} appKit={appKit}/> }
    </main>
  )
}

function V2AppWithAppKit({ parentClearData, appKit }: { parentClearData: () => void; appKit: AppKit }) {
  const storageKey = 'hedera-wc-demos-saved-state-v2-app'

  // Fetch public keys from mirror node for each account
  const fetchPublicKey = async (accountId: string) => {
    const response = await fetch(
      `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}`,
    )
    const data = await response.json()
    return data.key.key
  }

  const { walletProvider } = useAppKitProvider(hederaNamespace)
  const getWalletProvider = () => {
    if (!walletProvider) throw Error('walletProvider is not initialized')
    return walletProvider as HederaWalletConnectProvider
  }

  const getSigner = () => {
    const walletProvider = getWalletProvider()
    const topic = walletProvider.session?.topic
    if (!topic) {
      throw Error('Session is not initialized')
    }
    return walletProvider.nativeProvider?.getSigner(topic)
  }

  const [base64Transaction, setBase64Transaction] = useState('')
  const [tokenName, setTokenName] = useState('')
  const [tokenSymbol, setTokenSymbol] = useState('')
  const [tokenMetadata, setTokenMetadata] = useState('')
  const [newMetadata, setNewMetadata] = useState('')
  const [createdTokenId, setCreatedTokenId] = useState<string>('')
  const [serialNumber, setSerialNumber] = useState<number>(1)

  const [isLoading, setIsLoading] = useState<boolean>(false)

  // Form data states
  const [signerAccount, setSignerAccount] = useState('')
  const [receiver, setReceiver] = useState('')
  const [signerPrivateKey, setSignerPrivateKey] = useState('')
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [signMethod, setSignMethod] = useState<'connector' | 'signer'>('connector')
  const [selectedTransactionMethod, setSelectedTransactionMethod] = useState(
    'hedera_executeTransaction',
  )

  // Modal states
  const [isModalOpen, setModalOpen] = useState<boolean>(false)
  const [isModalLoading, setIsModalLoading] = useState<boolean>(false)
  const [modalData, setModalData] = useState<any>(null)

  // Multi-signature account states
  const [publicKeyInputs, setPublicKeyInputs] = useState<string[]>([''])
  const [threshold, setThreshold] = useState<number>(1)

  useEffect(() => {
    const state = JSON.parse(localStorage.getItem(storageKey) || '{}')
    if (state) {
      setMessage(state['message'])
      setPublicKey(state['publicKey'])
      setAmount(state['amount'])
      setReceiver(state['receiver'])
    }
  }, [])

  const handleDisconnectSessions = async () => {
    modalWrapper(async () => {
      await appKit?.disconnect()
      setModalData({ status: 'Success', message: 'Session disconnected' })
    })
  }

  const saveData = () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
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
      const walletProvider = getWalletProvider()
      const result = await walletProvider.hedera_getNodeAddresses()

      console.log('NodeAddresses: ', result.nodes)
      return result.nodes
    })
  }

  // 2. hedera_executeTransaction
  const handleExecuteTransaction = async () => {
    if (!signerPrivateKey) throw new Error('Signer private key is required')
    const walletProvider = getWalletProvider()

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

    return await walletProvider.hedera_executeTransaction(params)
  }

  // 3. hedera_signMessage
  const handleSignMessage = async () => {
    modalWrapper(async () => {
      const walletProvider = getWalletProvider()
      const signer = getSigner()
      if (!signer) throw new Error('Signer is required')

      const params: SignMessageParams = {
        signerAccountId: 'hedera:testnet:' + signer.getAccountId().toString(),
        message,
      }

      const { signatureMap } = await walletProvider.hedera_signMessage(params)
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

  const handleSignMessageThroughSigner = async () => {
    modalWrapper(async () => {
      const signer = getSigner()

      if (!signer) throw new Error('Signer is required')

      const params: SignMessageParams = {
        signerAccountId: 'hedera:testnet:' + signer.getAccountId().toString(),
        message,
      }

      const buffered = btoa(params.message)
      const base64 = base64StringToUint8Array(buffered)

      const signResult = await signer.sign([base64])
      const accountPublicKey = PublicKey.fromString(publicKey)
      const verifiedResult = verifySignerSignature(
        params.message,
        signResult[0],
        accountPublicKey,
      )
      console.log('SignatureMap: ', signResult)
      console.log('Verified: ', verifiedResult)
      return {
        signatureMap: signResult,
        verified: verifiedResult,
      }
    })
  }

  // 4. hedera_signAndExecuteQuery
  const handleExecuteQuery = () => {
    modalWrapper(async () => {
      const walletProvider = getWalletProvider()
      const signer = getSigner()

      if (!signer) throw new Error('Signer is required')
      const accountId = signer.getAccountId()
      const query = new AccountInfoQuery().setAccountId(accountId)

      const params: SignAndExecuteQueryParams = {
        signerAccountId: 'hedera:testnet:' + accountId.toString(),
        query: queryToBase64String(query),
      }

      const { response } = await walletProvider.hedera_signAndExecuteQuery(params)
      const bytes = Buffer.from(response, 'base64')
      const accountInfo = AccountInfo.fromBytes(bytes)
      console.log('AccountInfo: ', accountInfo)
      return accountInfo
    })
  }

  // 5. hedera_signAndExecuteTransaction
  const handleHederaSignAndExecuteTransaction = async () => {
    const walletProvider = getWalletProvider()
    const signer = getSigner()

    const accountId = signer!.getAccountId()
    const hbarAmount = new Hbar(Number(amount))

    const transaction = new TransferTransaction()
      .setTransactionId(TransactionId.generate(accountId!))
      .addHbarTransfer(accountId, hbarAmount.negated())
      .addHbarTransfer(receiver, hbarAmount)

    const params: SignAndExecuteTransactionParams = {
      transactionList: transactionToBase64String(transaction),
      signerAccountId: 'hedera:testnet:' + accountId.toString(),
    }

    const result = await walletProvider.hedera_signAndExecuteTransaction(params)

    console.log('JSONResponse: ', result)
    return result
  }

  // 6. hedera_signTransaction
  const handleHederaSignTransaction = async () => {
    const signer = getSigner()

    const accountId = signer!.getAccountId()
    const hbarAmount = new Hbar(Number(amount))
    const transaction = new TransferTransaction()
      .setTransactionId(TransactionId.generate(accountId!))
      .addHbarTransfer(accountId.toString()!, hbarAmount.negated())
      .addHbarTransfer(receiver, hbarAmount)

    const transactionSigned = await signer!.signTransaction(transaction)

    console.log('Signed transaction: ', transactionSigned)
    return { transaction: transactionSigned }
  }

  const handleBase64TransactionExecution = async () => {
    const walletProvider = getWalletProvider()
    const signer = getSigner()

    if (!signer || !base64Transaction) return

    try {
      setIsLoading(true)
      const accountId = signer.getAccountId()
      const params: SignAndExecuteTransactionParams = {
        transactionList: base64Transaction,
        signerAccountId: 'hedera:testnet:' + accountId.toString(),
      }

      const result = await walletProvider.hedera_signAndExecuteTransaction(params)

      setModalData({
        title: 'Transaction Executed',
        content: JSON.stringify(result, null, 2),
      })
      setModalOpen(true)
    } catch (error) {
      setModalData({
        title: 'Error',
        content: error instanceof Error ? error.message : 'Unknown error occurred',
      })
      setModalOpen(true)
    } finally {
      setIsLoading(false)
    }
  }
  // Test signature verification with different HWC versions
  const handleTestSignatureVerification = async () => {
    const walletProvider = getWalletProvider()
    const signer = getSigner()

    if (!signer) throw new Error('Selected signer is required')
    const accountId = signer.getAccountId().toString()

    // Create a TopicCreateTransaction and freeze it
    const transactionId = TransactionId.generate(accountId)
    const transaction = new TopicCreateTransaction()
      .setTransactionId(transactionId)
      .freezeWith(Client.forTestnet())

    // Generate TransactionBody for different Hedera Wallet versions
    const transactionBody = transactionToTransactionBody(
      transaction,
      AccountId.fromString('0.0.3'),
    )
    if (!transactionBody) throw new Error('Transaction is null or undefined')

    // Prepare sign parameters
    const signParams: SignTransactionParams = {
      transactionBody: transaction,
      signerAccountId: `hedera:testnet:${accountId}`,
    }

    const signedWithConnector = await walletProvider.hedera_signTransaction(signParams)

    console.log(`✅ Transaction signed successfully with connector!`, signedWithConnector)
    // Sign the transaction using both versions
    const signResult = await signer.signTransaction(transaction)
    console.log(`✅ Transaction signed successfully through signer!`, signResult)
    const signatureMapSigner = signResult._signedTransactions.current.sigMap
    const signatureMapConnector = (signedWithConnector as Transaction)._signedTransactions
      .current.sigMap

    // Extract first signatures
    const firstSignature = extractFirstSignature(signatureMapSigner)
    const firstSignatureConnector = extractFirstSignature(signatureMapConnector)

    // Fetch public key from mirror node
    const publicKey = await fetchPublicKey(accountId.toString())
    const bytesToSign = transaction._signedTransactions.get(0)!.bodyBytes!
    const publicKeyBytes = PublicKey.fromString(publicKey).toBytes()

    // Verify signatures
    const verifySigner = nacl.sign.detached.verify(bytesToSign, firstSignature, publicKeyBytes)

    const verifyFromConnector = nacl.sign.detached.verify(
      bytesToSign,
      firstSignatureConnector,
      publicKeyBytes,
    )

    return {
      signerVerification: verifySigner,
      connectorVerification: verifyFromConnector,
      publicKey,
    }
  }

  const handleCreateToken = async () => {
    modalWrapper(async () => {
      const walletProvider = getWalletProvider()
      const signer = getSigner()

      if (!signer) throw new Error('Signer is required')
      const accountId = signer.getAccountId()

      const publicKey = await fetchPublicKey(accountId.toString())
      const tokenName = `NFT Token ${serialNumber}`
      const tokenSymbol = `NFT${serialNumber}`

      const transaction = await new TokenCreateTransaction()
        .setTokenName(tokenName)
        .setTokenSymbol(tokenSymbol)
        .setTreasuryAccountId(accountId)
        .setAdminKey(PublicKey.fromStringED25519(publicKey))
        .setSupplyKey(PublicKey.fromStringED25519(publicKey))
        .setMaxSupply(100)
        .setSupplyType(TokenSupplyType.Finite)
        .setTokenType(TokenType.NonFungibleUnique)
        .setDecimals(0)
        .freezeWithSigner(signer)

      const base64Transaction = transactionToBase64String(transaction)
      const params: SignAndExecuteTransactionParams = {
        transactionList: base64Transaction,
        signerAccountId: 'hedera:testnet:' + accountId.toString(),
      }

      const result = await walletProvider.hedera_signAndExecuteTransaction(params)
      console.log('Token Creation Result:', result)

      const reciept = new TransactionReceiptQuery().setTransactionId(result.transactionId)
      const signedReceipt = await reciept.executeWithSigner(signer)

      console.log('reciept is', signedReceipt)

      if (signedReceipt && signedReceipt.tokenId) {
        setCreatedTokenId(signedReceipt.tokenId.toString())
      }

      return result
    })
  }

  const handleMintToken = async () => {
    modalWrapper(async () => {
      const walletProvider = getWalletProvider()
      const signer = getSigner()

      if (!signer) throw new Error('Selected signer is required')
      if (!createdTokenId)
        throw new Error('No token ID available. Please create a token first.')

      const accountId = signer.getAccountId()
      const tokenId = TokenId.fromString(createdTokenId)

      const transaction = await new TokenMintTransaction()
        .setTokenId(tokenId)
        .setMetadata([Buffer.from(tokenMetadata)])
        .freezeWithSigner(signer)

      const base64Transaction = transactionToBase64String(transaction)
      const params: SignAndExecuteTransactionParams = {
        transactionList: base64Transaction,
        signerAccountId: 'hedera:testnet:' + accountId.toString(),
      }

      const result = await walletProvider.hedera_signAndExecuteTransaction(params)
      console.log('Token Minting Result:', result)

      setSerialNumber((prev) => prev + 1)

      return result
    })
  }

  const handleUpdateToken = async () => {
    modalWrapper(async () => {
      const walletProvider = getWalletProvider()
      const signer = getSigner()

      if (!signer) throw new Error('Selected signer is required')
      if (!createdTokenId)
        throw new Error('No token ID available. Please create a token first.')

      const accountId = signer.getAccountId()
      const tokenId = TokenId.fromString(createdTokenId)

      const transaction = await new TokenUpdateTransaction()
        .setTokenId(tokenId)
        .setMetadata(Buffer.from(newMetadata))
        .freezeWithSigner(signer)

      const base64Transaction = transactionToBase64String(transaction)
      const params: SignAndExecuteTransactionParams = {
        transactionList: base64Transaction,
        signerAccountId: 'hedera:testnet:' + accountId.toString(),
      }

      const result = await walletProvider.hedera_signAndExecuteTransaction(params)
      const recieptQuery = new TransactionReceiptQuery().setTransactionId(result.transactionId)

      const signedReceipt = await recieptQuery.executeWithSigner(signer)

      console.log('Token Update Result:', result, signedReceipt)
      return result
    })
  }

  // Create multi-signature account
  const handleCreateMultisigAccount = async () => {
    const signer = getSigner()
    const publicKeys = await Promise.all(
      publicKeyInputs.filter((id) => id).map((accountId) => fetchPublicKey(accountId)),
    )

    console.log('Public keys: ', publicKeys)

    const transaction = new AccountCreateTransaction()
      .setKey(
        new KeyList(
          publicKeys.map((key) => PublicKey.fromString(key)),
          threshold,
        ),
      )
      .setInitialBalance(new Hbar(0))
      .setAccountMemo('Multisig Account')

    const frozen = await transaction.freezeWithSigner(signer!)
    const result = await frozen.executeWithSigner(signer!)
    console.log('Result: transaction completed', result)
    const receipt = await result.getReceiptWithSigner(signer!)
    console.log('Receipt: ', receipt)
    return receipt
  }

  /**
   * Session management methods
   */

  const handleClearData = () => {
    localStorage.removeItem(storageKey)
    parentClearData()
    setMessage('')
    setPublicKey('')
    setAmount('')
    setReceiver('')
  }

  const disableButtons = !appKit || !walletProvider;

  // useEffect(() => {
  //   setSessions(dAppConnector?.walletConnectClient?.session.getAll() ?? [])
  //   console.log({ session: dAppConnector?.walletConnectClient?.session })
  // }, [dAppConnector?.walletConnectClient?.session])
  const { isConnected } = useAppKitAccount()
  const { walletInfo } = useWalletInfo()
  const { disconnect } = useDisconnect()

  return (
    <>
      <section>
        <div>
          {isLoading && <p>Loading...</p>}
          <fieldset>
            {!isConnected ? (
              <legend>Step 2: Connect a wallet</legend>
            ) : (
              <>
                <legend>Connected Wallet</legend>
                <ul>
                  <li>
                    <p>Session ID: {getWalletProvider().session.topic}</p>
                    <p>Wallet Name: {walletInfo?.name}</p>
                    <p>Account IDs: {getWalletProvider().getAccountAddresses().join(' | ')}</p>
                  </li>
                </ul>
              </>
            )}
            <appkit-button />
          </fieldset>
        </div>
      </section>
      <hr />
      <h2>Sign methods:</h2>
      <section>
        <fieldset>
          <legend>1. hedera_getNodeAddresses</legend>
          <button disabled={!walletProvider} onClick={handleGetNodeAddresses}>
            hedera_getNodeAddresses
          </button>
        </fieldset>
      </section>
      <section>
        <div>
          <fieldset>
            <legend>3. hedera_signMessage</legend>
            <label>
              Sign Method:
              <select
                value={signMethod}
                onChange={(e) => setSignMethod(e.target.value as 'connector' | 'signer')}
                className="mb-2"
              >
                <option value="connector">Sign with Connector</option>
                <option value="signer">Sign with Signer</option>
              </select>
            </label>
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
          <button
            disabled={disableButtons}
            onClick={
              signMethod === 'connector' ? handleSignMessage : handleSignMessageThroughSigner
            }
          >
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
            {selectedTransactionMethod === 'hedera_executeTransaction' && (
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
            )}
            <label>
              Send to address:
              <input value={receiver} onChange={(e) => setReceiver(e.target.value)} required />
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
                if (!walletProvider) throw new Error('walletProvider is required')
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
      <section>
        <h2>Execute Base64 Transaction</h2>
        <div>
          <label>Transaction Bytes</label>
          <textarea
            placeholder="Paste base64 transaction bytes here"
            value={base64Transaction}
            onChange={(e) => setBase64Transaction(e.target.value)}
            style={{
              width: '100%',
              minHeight: '120px',
              padding: '0.5rem',
              marginBottom: '1rem',
              border: '1px solid black',
              fontFamily: 'monospace',
              fontSize: '14px',
              borderRadius: '1rem',
            }}
          />
          <button
            onClick={handleBase64TransactionExecution}
            disabled={disableButtons || !base64Transaction || isLoading}
          >
            {!walletProvider
              ? 'Initialize WalletConnect First'
              : isLoading
                ? 'Executing...'
                : 'Execute Transaction'}
          </button>
        </div>
      </section>
      <hr />
      <h2>Pairing and session management:</h2>
      <section>
        <div>
          <button disabled={disableButtons} onClick={handleDisconnectSessions}>
            Disconnect all sessions and pairings
          </button>
          <span> </span>
          <button onClick={handleClearData}>Clear saved data</button>
        </div>
      </section>
      <section>
        <div>
          <fieldset>
            <legend>Create Multi-signature Account</legend>
            {publicKeyInputs.map((input, index) => (
              <div key={index}>
                <label>
                  Account ID {index + 1}:
                  <input
                    value={input}
                    onChange={(e) => {
                      const newInputs = [...publicKeyInputs]
                      newInputs[index] = e.target.value
                      setPublicKeyInputs(newInputs)
                    }}
                    placeholder="Enter Account ID"
                  />
                </label>
                {index === publicKeyInputs.length - 1 && (
                  <button onClick={() => setPublicKeyInputs([...publicKeyInputs, ''])}>
                    Add Another Account
                  </button>
                )}
              </div>
            ))}
            <label>
              Threshold:
              <input
                type="number"
                min="1"
                max={publicKeyInputs.filter(Boolean).length}
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value))}
              />
            </label>
          </fieldset>
          <button
            disabled={disableButtons || !publicKeyInputs[0] || threshold < 1}
            onClick={() => {
              modalWrapper(async () => {
                if (!walletProvider) throw new Error('walletProvider is required')
                return handleCreateMultisigAccount()
              })
            }}
          >
            Create Multisig Account
          </button>
        </div>
      </section>
      <section>
        <h2>Signature Verification Test</h2>
        <div>
          <button
            onClick={() => {
              modalWrapper(async () => {
                if (!walletProvider) throw new Error('walletProvider is required')
                return handleTestSignatureVerification()
              })
            }}
          >
            Test Signature Verification
          </button>
        </div>
      </section>
      <section>
        <h2>Token Operations</h2>
        <div>
          <fieldset>
            <legend>Create Token</legend>
            <label>
              Token Name:
              <input
                type="text"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                required
              />
            </label>
            <label>
              Token Symbol:
              <input
                type="text"
                value={tokenSymbol}
                onChange={(e) => setTokenSymbol(e.target.value)}
                required
              />
            </label>
            <button
              disabled={disableButtons || !tokenName || !tokenSymbol}
              onClick={() => {
                modalWrapper(async () => {
                  if (!disableButtons) throw new Error('disableButtons is required')
                  return handleCreateToken()
                })
              }}
            >
              Create Token
            </button>
          </fieldset>
          <fieldset>
            <legend>Mint Token</legend>
            <label>
              Token Metadata:
              <input
                type="text"
                value={tokenMetadata}
                onChange={(e) => setTokenMetadata(e.target.value)}
                required
              />
            </label>
            <button
              disabled={disableButtons || !tokenMetadata || !createdTokenId}
              onClick={() => {
                modalWrapper(async () => {
                  if (!walletProvider) throw new Error('walletProvider is required')
                  return handleMintToken()
                })
              }}
            >
              Mint Token
            </button>
          </fieldset>
          <fieldset>
            <legend>Update Token</legend>
            <label>
              New Metadata:
              <input
                type="text"
                value={newMetadata}
                onChange={(e) => setNewMetadata(e.target.value)}
                required
              />
            </label>
            <button
              disabled={disableButtons || !newMetadata || !createdTokenId}
              onClick={() => {
                modalWrapper(async () => {
                  if (!walletProvider) throw new Error('walletProvider is required')
                  return handleUpdateToken()
                })
              }}
            >
              Update Token
            </button>
          </fieldset>
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
    </>
  )
}

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
