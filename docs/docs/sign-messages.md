---
sidebar_position: 6
---

# Signing Messages

Before signing messages, read the [Installation](./installation.md) guide and [dApp Guide](./dapp-guide.md).

# Import required functions

```javascript
import { verifyMessageSignature, verifySignerSignature } from '@hashgraph/hedera-wallet-connect'
import { PublicKey } from '@hashgraph/sdk'
```

# Signing and verifying messages using dAppConnector

First, get the address, params, and call the signMessage method. This will return a `SignatureMap` object once the user has signed the message.

```javascript
const address = localStorage.getItem('hederaAddress')
const params = {
  signerAccountId: `hedera:mainnet:${address}`,
  message: 'Example message to sign',
}
```

Next, let's sign and verify the signature.

On your frontend call the `signMessage` method in your dAppConnector instance.

```javascript
const result = await dAppConnector.signMessage(params)
```

On your backend, retrieve the user's public key from a mirror node and verify the signature.

```javascript

export const getPublicKey = async (accountId, network) => {
  try {

    const URL = `https://mainnet.mirrornode.hedera.com/api/v1/accounts/${address}`;

    const request = await fetch(URL);
    const response = (await request.json())

    return { key: response?.key?.key, type: response?.key?._type };
  } catch (e) {
    console.log('failed to request', e);
    return { key: undefined, type: undefined };
  }
};
const keyResponse = await getPublicKey(address, 'mainnet');
const publicKey = PublicKey.fromString(publicKey);
const verifiedResult = verifyMessageSignature(params.message, result.signatureMap, publicKey)
```

# Signing and verifying messages using a Signer

To sign messages, you can use the `signer.sign` method. This method takes a base64 encoded
string and returns an array of `SignatureMap` objects. Each `SignatureMap` object contains a
`signature` and `publicKey` property.

To verify the signature, you can use the `verifySignerSignature` function. This function takes
the base64 encoded string, the `SignatureMap` object, and a `PublicKey` object.

```javascript
const text = 'Example message to sign'
const base64String = btoa(text)

const sigMaps = await signer.sign([base64StringToUint8Array(base64String)])

// sigMaps[0].publicKey also contains the public key of the signer, but you should obtain a PublicKey you can trust from a mirror node.
const verifiedResult = verifySignerSignature(base64String, sigMaps[0], publicKey)
```

# Putting it all together

Here's a complete example showing both signing approaches and their verification:

```javascript
import { verifyMessageSignature, verifySignerSignature } from '@hashgraph/hedera-wallet-connect'
import { PublicKey } from '@hashgraph/sdk'

// Helper function to get public key from mirror node
async function getPublicKey(accountId, network = 'mainnet') {
  try {
    const URL = `https://${network}.mirrornode.hedera.com/api/v1/accounts/${accountId}`
    const request = await fetch(URL)
    const response = await request.json()
    return { 
      key: response?.key?.key, 
      type: response?.key?._type 
    }
  } catch (error) {
    console.error('Failed to fetch public key:', error)
    throw error
  }
}

// Example using dAppConnector
async function signAndVerifyWithDAppConnector(dAppConnector, message) {
  try {
    // Get the connected account
    const address = localStorage.getItem('hederaAddress')
    if (!address) throw new Error('No connected account found')

    // Prepare parameters
    const params = {
      signerAccountId: `hedera:mainnet:${address}`,
      message: message,
    }

    // Sign the message
    const result = await dAppConnector.signMessage(params)
    console.log('Message signed successfully')

    // Get the public key from mirror node
    const { key: publicKeyString } = await getPublicKey(address)
    if (!publicKeyString) throw new Error('Could not fetch public key')

    // Verify the signature
    const publicKey = PublicKey.fromString(publicKeyString)
    const isValid = verifyMessageSignature(params.message, result.signatureMap, publicKey)

    console.log('Signature verification result:', isValid)
    return isValid
  } catch (error) {
    console.error('Error in signAndVerifyWithDAppConnector:', error)
    throw error
  }
}

// Example using Signer
async function signAndVerifyWithSigner(signer, message) {
  try {
    // Convert message to base64
    const base64String = btoa(message)
    
    // Helper function to convert base64 to Uint8Array
    const base64StringToUint8Array = (base64String) => {
      const binaryString = atob(base64String)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      return bytes
    }

    // Sign the message
    const sigMaps = await signer.sign([base64StringToUint8Array(base64String)])
    console.log('Message signed successfully')

    // Get the public key from mirror node
    const accountId = signer.getAccountId().toString()
    const { key: publicKeyString } = await getPublicKey(accountId)
    if (!publicKeyString) throw new Error('Could not fetch public key')

    // Verify the signature
    const publicKey = PublicKey.fromString(publicKeyString)
    const isValid = verifySignerSignature(base64String, sigMaps[0], publicKey)

    console.log('Signature verification result:', isValid)
    return isValid
  } catch (error) {
    console.error('Error in signAndVerifyWithSigner:', error)
    throw error
  }
}

// Usage example
async function example() {
  try {
    // Using dAppConnector
    const dAppConnectorResult = await signAndVerifyWithDAppConnector(
      dAppConnector,
      'Example message to sign with dAppConnector'
    )
    console.log('DAppConnector verification:', dAppConnectorResult)

    // Using Signer
    const signerResult = await signAndVerifyWithSigner(
      signer,
      'Example message to sign with Signer'
    )
    console.log('Signer verification:', signerResult)
  } catch (error) {
    console.error('Error in example:', error)
  }
}
```

This complete example demonstrates:
1. A reusable function to fetch public keys from the mirror node
2. Two complete implementations for signing and verifying messages:
   - Using dAppConnector
   - Using Signer
3. Proper error handling throughout the process
4. Helper functions for base64 conversion
5. Usage examples for both methods

You can adapt this code to your specific needs and integrate it into your application's architecture.
