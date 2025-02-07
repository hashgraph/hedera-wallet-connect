---
title: Ed25519 & ECDSA Keys
sidebar_position: 6
---

# Choosing between Ed25519 & ECDSA Keys for dApp Integration

When integrating Hedera WalletConnect (Reown) for EVM compatibility, choosing the correct key type is essential for ensuring your dApp connects and interacts seamlessly with Hedera-based wallets. This guide is tailored for dApp developers—whether you’re new to Hedera or come from an EVM background—to help you understand, detect, and work with both Ed25519 and ECDSA keys in the context of WalletConnect integrations and JSON-RPC communication.

In Hedera, two key types are prevalent:

- **Ed25519**: The default key type for many Hedera accounts, offering high performance and native Hedera support.
- **ECDSA**: Required for dApps that need full EVM compatibility—especially when using tools like MetaMask or interacting via JSON-RPC.

---

## Key Type Comparison

The table below provides a side-by-side comparison of the two key types:

| **Attribute**        | **Ed25519**                                                                                  | **ECDSA**                                                                                        |
|----------------------|----------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| **Compatibility**    | Native support on Hedera. Not compatible with the JSON-RPC relay for EVM interactions.        | Fully compatible with the JSON-RPC relay, ensuring smooth EVM integrations with dApps.           |
| **Usage Context**    | Ideal for Hedera’s native features and when performance and security are prioritized.          | Recommended when connecting with EVM-based tools (e.g., MetaMask) and dApps requiring EVM support. |
| **Common Use Case**  | Most Hedera accounts (legacy and current) typically use Ed25519.                               | Required for dApps that need EVM compatibility via WalletConnect (Reown).                         |
| **Integration Impact** | Provides enhanced Hedera functionality but limits EVM integration options.                  | Ensures that dApps outside the Hedera ecosystem can connect reliably via JSON-RPC.                 |
| **Detection**        | Typically the default for many existing accounts on Hedera.                                  | Must be explicitly used when EVM compatibility is a requirement.                                 |

---

## Identifying Your Account’s Key Type

For dApp developers, it is crucial to determine which key type an account is using. This section describes how you can identify the key type by querying account details—commonly through Hedera’s Mirror Node API.

### Example: Detecting Key Type via Mirror Node

Below is an example function in JavaScript that fetches an account’s key type:

```javascript
/**
 * Fetch the key type of a Hedera account from the mirror node.
 * @param {string} accountId - The Hedera account ID (e.g., "123456").
 * @returns {Promise<string>} - The type of key (e.g., "ED25519" or "ECDSA") or 'Unknown'.
 */
async function fetchAccountKeyType(accountId) {
  const URL = `https://mainnet.mirrornode.hedera.com/api/v1/accounts/${accountId}`;
  const response = await fetch(URL);
  const data = await response.json();

  // The key object may include a field indicating the type (e.g., _type or similar).
  // Adjust the property name based on the exact response structure.
  return data?.key?._type || 'Unknown';
}

// Usage example:
fetchAccountKeyType('0.0.123456')
  .then(keyType => console.log('Account key type:', keyType))
  .catch(error => console.error('Error fetching key type:', error));
```

This snippet retrieves the key type, allowing your dApp to adjust its behavior based on whether the account uses Ed25519 or ECDSA.

---

## Verifying and Handling Account Key Types in Your dApp

Since some dApps—especially those external to the Hedera ecosystem—can only connect using ECDSA accounts via JSON-RPC, it is important to verify the key type before proceeding with sensitive operations. This section outlines a typical flow:

### Step 1: Verify the Key Type

After a user connects their account via WalletConnect, use the method shown above to check the account’s key type.

```javascript
async function verifyAccountKeyType(accountId) {
  const keyType = await fetchAccountKeyType(accountId);

  if (keyType === 'ECDSA') {
    console.log('ECDSA key detected. Proceeding with EVM-compatible operations.');
    // Continue with EVM-dependent workflows
  } else if (keyType === 'ED25519') {
    console.warn('Ed25519 key detected. Some EVM functionalities may be limited.');
    // You may choose to display a warning or restrict access to certain features
  } else {
    console.error('Unknown key type. Please verify the account details.');
  }
}
```

### Step 2: Handling the Special Case for EVM-only dApps

For dApps that require EVM connectivity (via JSON-RPC), you might need to enforce a check and provide user guidance if an Ed25519 account is detected:

```javascript
async function handleAccountConnection(accountId) {
  const keyType = await fetchAccountKeyType(accountId);

  if (keyType !== 'ECDSA') {
    // Notify the user or take alternative actions if an Ed25519 account is connected
    alert('This dApp requires an ECDSA account for full EVM compatibility. Please connect an account with ECDSA keys.');
    return false;
  }

  // Proceed with dApp operations if an ECDSA key is detected
  return true;
}
```

Integrate these checks early in your connection workflow to ensure your dApp operates reliably with the expected account type.

---

:::tip ECDSA Keys Recommended for EVM dApps
For full EVM compatibility via Hedera WalletConnect (Reown), dApp developers should verify that connecting accounts use **ECDSA** keys. This is especially important for dApps relying on JSON-RPC and other EVM-specific integrations.
:::

---

## Testing the Code Snippets

To verify that the provided code snippets work as intended, you can run them in your preferred environment. Below are some general instructions:

### Using Node.js in the Terminal

1. **Create a File:**  
   Save your snippet (e.g., the `fetchAccountKeyType` function) in a file with a `.js` extension (for example, `testKeyType.js`).

2. **Set Module Type (if needed):**  
   If your file uses ES module syntax (e.g., `import` statements), ensure your project’s `package.json` includes:
   ```json
   {
     "name": "key-tests",
     "version": "1.0.0",
     "type": "module",
     "main": "testKeyType.js",
     "scripts": {
       "start": "node testKeyType.js"
     },
     "dependencies": {}
   }
   ```

3. **Run the File:**  
   Open your terminal, navigate to the directory containing your file, and run:
   ```bash
   node testKeyType.js
   ```
4. **Review the Output:**  
   Check the terminal output to ensure the code runs successfully (for example, it should print `Account key type: ED25519`).

---

## Additional Resources

- **[dApp Guide](dapp-guide):** Step-by-step instructions for integrating Hedera WalletConnect in your dApp.
- **[Installation Guide](installation):** Details on installing the Hedera WalletConnect package and its dependencies.
- **[Signing Messages](signing-messages):** Learn how to sign and verify messages within your dApp.

---

By understanding these key types, integrating the appropriate checks, and testing your code using the methods above, your dApp can better handle user connections and provide a seamless experience—ensuring that all operations align with the requirements of both Hedera and the EVM ecosystem.