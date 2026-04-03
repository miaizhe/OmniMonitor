export async function edgeOneRequest(
  action: string,
  payload: any,
  secretId: string,
  secretKey: string
) {
  const endpoint = "teo.tencentcloudapi.com";
  const service = "teo";
  const region = "ap-singapore";
  const version = "2022-09-01";
  
  const payloadStr = JSON.stringify(payload);
  
  const date = new Date();
  const timestamp = Math.floor(date.getTime() / 1000);
  const dateStr = date.toISOString().split('T')[0];
  
  // Helper for SHA-256 hash
  const getHash = async (message: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Helper for HMAC-SHA256
  const hmacSha256 = async (key: Uint8Array | string, message: string) => {
    const encoder = new TextEncoder();
    const keyData = typeof key === 'string' ? encoder.encode(key) : key;
    const messageData = encoder.encode(message);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData as any,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    return new Uint8Array(signature);
  };
  
  const toHex = (buffer: Uint8Array) => {
    return Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const hashedRequestPayload = await getHash(payloadStr);
  const httpRequestMethod = "POST";
  const canonicalUri = "/";
  const canonicalQueryString = "";
  const canonicalHeaders = "content-type:application/json\n" + "host:" + endpoint + "\n";
  const signedHeaders = "content-type;host";

  const canonicalRequest = httpRequestMethod + "\n" +
                           canonicalUri + "\n" +
                           canonicalQueryString + "\n" +
                           canonicalHeaders + "\n" +
                           signedHeaders + "\n" +
                           hashedRequestPayload;

  const algorithm = "TC3-HMAC-SHA256";
  const hashedCanonicalRequest = await getHash(canonicalRequest);
  const credentialScope = dateStr + "/" + service + "/tc3_request";
  const stringToSign = algorithm + "\n" +
                       timestamp + "\n" +
                       credentialScope + "\n" +
                       hashedCanonicalRequest;

  const kDate = await hmacSha256("TC3" + secretKey, dateStr);
  const kService = await hmacSha256(kDate, service);
  const kSigning = await hmacSha256(kService, "tc3_request");
  const signatureBuffer = await hmacSha256(kSigning, stringToSign);
  const signature = toHex(signatureBuffer);

  const authorization = algorithm + " " +
                        "Credential=" + secretId + "/" + credentialScope + ", " +
                        "SignedHeaders=" + signedHeaders + ", " +
                        "Signature=" + signature;

  const response = await fetch("https://" + endpoint, {
    method: "POST",
    headers: {
      "Authorization": authorization,
      "Content-Type": "application/json",
      "Host": endpoint,
      "X-TC-Action": action,
      "X-TC-Version": version,
      "X-TC-Region": region,
      "X-TC-Timestamp": timestamp.toString(),
    },
    body: payloadStr,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`EdgeOne API Error: ${response.status} ${text}`);
  }

  const result = await response.json();
  if (result.Response && result.Response.Error) {
    throw new Error(`EdgeOne API Error: ${result.Response.Error.Message}`);
  }
  return result.Response;
}
