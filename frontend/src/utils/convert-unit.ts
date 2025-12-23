const convertToBitRate = (bytes: any) => {
  if (bytes === 0) {
    return "0"
  }
  let i = -1
  const bitRateUnits = [" Kbps", " Mbps", " Gbps", " Tbps"]
  do {
    bytes = bytes / 1000
    i++
  } while (bytes >= 1000)

  return Math.max(bytes, 0.1).toFixed(2) + bitRateUnits[i]
}

const convertBytes = (bytes: any) => {
  if (!bytes) {
    return "-"
  }
  let i = -1
  const units = [" KB", " MB", " GB", " TB"]
  do {
    bytes = bytes / 1024
    i++
  } while (bytes >= 1024)

  return Math.max(bytes, 0.1).toFixed(2) + units[i]
}

export { convertBytes, convertToBitRate }
