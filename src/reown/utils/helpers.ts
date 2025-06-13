import { ethers } from 'ethers'

/**
 * Gets message from various signing request methods by filtering out
 * a value that is not an address (thus is a message).
 * If it is a hex string, it gets converted to utf8 string
 */
export function getSignParamsMessage(params: string[]) {
  const message = params.filter((p) => !ethers.isAddress(p))[0]

  if (ethers.isHexString(message)) {
    return ethers.toUtf8String(message)
  }

  return message
}

/**
 * Gets data from various signTypedData request methods by filtering out
 * a value that is not an address (thus is data).
 * If data is a string convert it to object
 */
export function getSignTypedDataParamsData(params: string[]) {
  const data = params.filter((p) => !ethers.isAddress(p))[0]

  if (typeof data === 'string') {
    return JSON.parse(data)
  }

  return data
}
