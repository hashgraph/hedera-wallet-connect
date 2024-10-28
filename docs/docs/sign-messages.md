---
sidebar_position: 5
---

# Signing Messages

Before signing messages, read the [Installation](/docs/installation) guide.

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
