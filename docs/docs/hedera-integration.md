---
title: Hedera Integration
sidebar_position: 1
---

# How to Integrate Hedera Using Reown’s AppKit & WalletKit

Hedera acheives EVM compatibility by implementing the Ethereum JSON-RPC spec through a middle layer called a JSON-RPC relay.The relay follows the [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification) and implements a subset of the [Ethereum JSON-RPC APIs](https://ethereum.github.io/execution-apis/api-documentation/) to facilitate smart contract interactions and transaction execution. This relay is responsible for translating EVM transactions into Hedera native transactions. 

While the Hedera JSON-RPC is considered feature complete and ready for production, please note the delineation between compatible and equivalent. To see a full list of supported methods, refer to [this documentation](https://github.com/hashgraph/hedera-json-rpc-relay/blob/main/docs/rpc-api.md).

Both wallets and dApps that integrate Hedera can choose to use either the [EVM compatibility layer](#) or [interact directly with Hedera APIs](#) through the SDKs or implement [both approaches for maximum compatibility](#). A strong reason to integrate Hedera via the EVM compatibility is to leverage existing tooling and libraries available in the EVM ecosystem. A strong reason to integrate Hedera via the native APIs is to fully support all account types and native transaction types provided by Hedera. **Integrating both approaches allows for the broadest compatibility amongst, dApps, wallets, and users.**

In the context of Reown's WalletKit and AppKit, this is defined by the namespaces requested by dApps to wallets. For the EVM compatibility layer, the namespace is `eip155` and for Hedera native transactions it is `hedera`.

---

## Developer TL;DR

Hedera offers two primary ways to interact with the network:

1. **Hedera Native Integrations**  
   - Direct access to Hedera services (topics, native token associations, etc.).  
   - Typically uses Ed25519 keys (though ECDSA can also be used).  
   - Does not support the JSON-RPC relay or EVM transactions.

2. **EVM-Compatible Integrations**  
   - Uses ECDSA keys and standard Ethereum tools (e.g., MetaMask).  
   - Relies on the Hedera JSON-RPC relay, which implements much of the Ethereum JSON-RPC spec and translates calls to Hedera native transactions.  
   - Simplifies connecting to existing EVM infrastructure for dApps that want to be “chain-agnostic.”

These primary intraction methods give dApps three integration pathways.

---

## Hedera Integration Pathways

When you configure Reown’s WalletKit & AppKit, you’ll need to specify which **namespace(s)** (i.e., network identifiers) your dApp supports. Hedera supports two main namespaces:

- `hedera:mainnet` (Hedera-specific)
- `eip155:295` (EVM-compatible)

You can choose **one** of these or **both**, depending on your dApp’s needs. Below are the three primary integration approaches:

### Path 1: Hedera Namespace Only

- **Namespace:** `hedera:mainnet` (or `hedera:testnet` in dev environments)
- **Supported Key Types:** 
  - Ed25519 and ECDSA (Ed25519 has historical use in Hedera-native wallets, but ECDSA is fully supported).
- **Wallet Compatibility:** 
  - Hedera-native wallets such as HashPack, Kabila, Blade, Dropp or other wallets that implement the Hedera namespace.  
- **Use Cases & Benefits:**  
  - If your dApp is built specifically for Hedera (and doesn’t require Ethereum tooling), this is the most straightforward path.
- **Limitations & Trade-Offs:**  
  - You do not get out-of-the-box compatibility with standard Ethereum tools like MetaMask or Remix.  
  - Users with purely EVM-based wallets can’t connect if you only support the Hedera namespace.
- **Ideal For:**
  - Projects that are Hedera-first (or Hedera-exclusive) and want to leverage the full native capabilities without needing EVM-based user flows.

### Path 2: EVM Namespace Only

- **Namespace:** `eip155:295`
- **Supported Key Types:** 
  - **ECDSA** only. (Ed25519 is *not* recognized by EVM-based wallets and JSON-RPC.)
- **Wallet Compatibility:** 
  - EVM-based wallets like MetaMask, Coinbase Wallet, or any wallet that supports standard Ethereum WalletConnect flows.  
  - Transactions use the Hedera JSON-RPC relay, which converts EVM calls to Hedera-native transactions under the hood.
  - Note: EVM wallets (e.g., MetaMask) only support ECDSA keys; ensure users select an ECDSA account.
- **Use Cases & Benefits:**  
  - If your entire dApp is built around Ethereum tooling—smart contracts, user flows with MetaMask, standard Ethereum libraries (ethers.js, web3.js), etc.  
  - You can treat Hedera nearly the same as any other EVM chain, enabling quick adoption for devs used to Ethereum, BSC, Polygon, etc.  
  - Users who already have MetaMask or other EVM wallets can plug in instantly, no need to download a dedicated Hedera wallet.
- **Limitations & Trade-Offs:**  
  - The JSON-RPC relay translates EVM transactions into Hedera native ones but does not support all native features. These require the Hedera namespace (`hedera:mainnet`) and native APIs. ECDSA keys remain fully compatible with these features outside the relay.
  - ECDSA accounts on Hedera often require sending HBAR to an EVM address to create an account (via the JSON-RPC relay). This can be a bit different from typical Hedera account creation.
- **Ideal For:**
  - dApps that are EVM-focused and want to offer a familiar Ethereum-like experience on Hedera. You can connect with standard Ethereum wallets and dev tools, minimizing friction for EVM developers.

### Path 3: Hedera & EVM Namespaces (Recommended)

- **Namespaces:** `hedera:mainnet` and `eip155:295`
- **Supported Key Types:** 
  - Both **Ed25519** (for Hedera namespace) and **ECDSA** (for EVM namespace).  
  - Users can choose wallets from either ecosystem.
- **Wallet Compatibility:** 
  - Hedera-native wallets (HashPack, Kabila, Dropp, Blade, etc.) and EVM wallets (MetaMask, etc.).  
  - Your dApp must handle connections from both sets of wallets—two different “flavors” of functionality, but typically integrated under one UI flow.
  - Note: Ensure your dApp handles wallet-specific key support (e.g., HashPack rekeying for Ed25519 only).
- **Use Cases & Benefits:**  
  - Users can connect with *whichever wallet they have*, whether it’s purely EVM or purely Hedera.  
  - Access native Hedera features alongside EVM-based workflows.  
  - Attract both Hedera-only users and those who prefer mainstream Ethereum wallets.
- **Limitations & Considerations:**  
  - You’ll need logic in your dApp to detect which namespace is being used and route transactions or calls accordingly.  
  - ECDSA wallet users might have a different flow than Ed25519 wallet users. You may want to display different UI elements, disclaimers, or instructions.
- **Ideal For:**
  - Projects that want to bridge the best of both worlds—offering comprehensive Hedera features and EVM compatibility to cater to a broader audience. This is often the recommended path if you aim for a truly cross-ecosystem dApp.

### Further Recommendations for Each Pathway

Regardless of which path you choose, keep these points in mind:

- Display helpful messages if the user’s wallet *doesn’t* match your dApp’s requirements (e.g., Ed25519 in an EVM-only flow).
- For EVM approaches, highlight that sending HBAR to an EVM address triggers account creation. Provide instructions if your user base is unfamiliar with Hedera’s unique EVM address scheme.

---

## Account Key Differences

Hedera supports two main key types for accounts. Your chosen key type can impact the user’s experience, especially regarding EVM compatibility.

| **Attribute**           | **Ed25519**                                                                                          | **ECDSA**                                                                                           |
|-------------------------|-------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|
| **Compatibility**       | Native support on Hedera. Not compatible with the JSON-RPC relay for EVM interactions.               | Fully compatible with both Hedera native transactions (via SDK/APIs) and the JSON-RPC relay for EVM interactions. |
| **Usage Context**       | Ideal for Hedera’s native features and when performance and security are prioritized.                | Recommended when connecting with EVM-based tools (e.g., MetaMask) and dApps requiring EVM support.   |
| **Common Use Case**     | Historically the most common account type on Hedera.                                                 | Preferred if you need to send HBAR to an EVM address or connect strictly via EVM tooling.            |
| **Integration Impact**  | Optimized for Hedera native features (e.g., key rotation) via SDK/APIs; incompatible with JSON-RPC relay for EVM interactions. | Enables EVM compatibility via JSON-RPC relay and supports all native features via SDK/APIs, ideal for cross-ecosystem dApps. |
| **Detection**           | Often the default in many existing Hedera accounts.                                                  | Must be explicitly chosen if your dApp or wallet is EVM-first.                                       |
| **Key Migration**       | Can be updated to ECDSA via AccountUpdateTransaction.                                                | Can be updated to Ed25519; changing ECDSA key updates the EVM address alias.                        |

:::tip ECDSA Keys Recommended for EVM dApps
For full EVM compatibility via Hedera WalletConnect (Reown), dApp developers should verify that connecting accounts use **ECDSA** keys. This is especially important for dApps relying on JSON-RPC and other EVM-specific integrations.
:::

### Key Migration Between Ed25519 and ECDSA
Hedera allows updating an account’s key from Ed25519 to ECDSA or vice versa using an AccountUpdateTransaction, signed with the current key. This process retains the same account ID (e.g., 0.0.123456). However, for accounts with an ECDSA key tied to an EVM address alias (a 20-byte address derived from the public key), changing the ECDSA key updates the alias to a new address, which may affect EVM-based interactions (e.g., smart contract calls). Wallets like HashPack support rekeying for Ed25519 accounts, but ECDSA rekeying support may vary by wallet.

**Note:** While ECDSA keys work seamlessly with native Hedera APIs, some wallet implementations may default to Ed25519 for native features due to optimization preferences.

---

## Integration Checklist

1. **Configure Your Project in [cloud.reown.com](https://cloud.reown.com)**  
   - Register your dApp and retrieve any required credentials or configuration details.

2. **Add AppKit & WalletKit**  
   - Install Reown’s tools in your codebase.  
   - Optionally, incorporate the [Hedera SDKs](https://docs.hedera.com/) for deeper Hedera-native capabilities.

3. **Pick a Namespace Approach**  
   - Decide whether you’ll support `hedera:mainnet`, `eip155:295`, or **both**.  
   - Configure your client to handle whichever account types or requests you expect.

4. **Implement Key-Type Logic** (If needed)  
   - If your dApp demands ECDSA-only for certain features, detect the user’s key type (detailed below) and handle gracefully.

5. **Test & Deploy**  
   - Use test environments or mainnet debugging to confirm that your configuration is correct.  
   - Watch for errors in EVM transaction translation (via the JSON-RPC relay).

---

## Detecting & Handling Key Types

In some cases, your dApp might need to distinguish between Ed25519 and ECDSA accounts at runtime (e.g., to display warnings or enable EVM-only features). Below is an example flow.

### Fetch the Key Type from Hedera’s Mirror Node

```js
/**
 * Fetch the key type of a Hedera account from the mirror node.
 * @param {string} accountId - The Hedera account ID (e.g., "0.0.123456").
 * @returns {Promise<string>} - The type of key ("ED25519" or "ECDSA") or "Unknown".
 */
async function fetchAccountKeyType(accountId) {
  const URL = `https://mainnet.mirrornode.hedera.com/api/v1/accounts/${accountId}`;
  const response = await fetch(URL);
  const data = await response.json();

  // Adjust the property name based on the actual Mirror Node response shape
  return data?.key?._type || 'Unknown';
}
```

### Verify the Key Type upon Connection

When a user connects via WalletConnect (Reown), you can:

```js
async function verifyAccountKeyType(accountId) {
  const keyType = await fetchAccountKeyType(accountId);

  if (keyType === 'ECDSA') {
    console.log('ECDSA key detected. Proceed with EVM-compatible operations.');
    // e.g., handle JSON-RPC calls
  } else if (keyType === 'ED25519') {
    console.warn('Ed25519 key detected. Some EVM functionality may be limited.');
    // Possibly display a warning or limit certain features
  } else {
    console.error('Unknown key type. Please verify the account details.');
  }
}
```

### Restrict Actions if ECDSA is Required

For dApps that depend on EVM transactions, you might conditionally restrict or prompt for an ECDSA account if the connected account is Ed25519:

```js
async function handleAccountConnection(accountId) {
  const keyType = await fetchAccountKeyType(accountId);

  if (keyType !== 'ECDSA') {
    alert('This dApp requires an ECDSA account for full EVM compatibility. Please connect an ECDSA-enabled account.');
    return false;
  }

  // Proceed if ECDSA
  return true;
}
```

---

## Testing & Validation

### Local or Node.js Testing

1. **Set Up a Test Script**  
   - Include the `fetchAccountKeyType` function in a `.js` file.  
   - (Optional) Use ES Modules or CommonJS based on your environment.

2. **Install Dependencies**  
   - Ensure `node-fetch` or similar is installed if needed.

3. **Run the Script**  
   ```bash
   node testKeyType.js
   ```
4. **Check Output**  
   - Confirm that the key type prints as expected.  
   - Validate error handling for invalid or unknown accounts.

### dApp Integration Testing

- **QA on Testnet**:  
  - Connect a wallet with **Ed25519** keys.  
  - Connect a wallet with **ECDSA** keys.  
  - Verify that your UI responds appropriately in each case.
- **End-to-End Flow**:  
  - Use the JSON-RPC relay for EVM transactions.  
  - Use Hedera native APIs if you’re also supporting the Hedera namespace.

---

## Additional Resources

- **[dApp Guide](dapp-guide):** Step-by-step instructions for integrating Hedera WalletConnect in your dApp.
- **[Installation Guide](installation):** Details on installing the Hedera WalletConnect package and its dependencies.
- **[Signing Messages](signing-messages):** Learn how to sign and verify messages within your dApp.

---

By following these integration pathways, choosing the right key type, and leveraging both **Hedera** and **EVM** toolkits, your dApp can provide a seamless experience for all users—regardless of whether their accounts are ECDSA or Ed25519. With **Reown’s AppKit & WalletKit**, you can confidently build on Hedera, harness its native capabilities, and still retain full EVM compatibility.