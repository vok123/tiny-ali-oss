import md5 from 'md5';
import base64js from 'base64-js';
import Sha1 from 'jssha/dist/sha1';
import { ITinyOSSOptions } from '..';

function isDate(obj: any): obj is Date {
  return obj && Object.prototype.toString.call(obj) === '[object Date]' && obj.toString !== 'Invalid Date';
}

export function unix(date?: number | string | Date) {
  let d;
  if (date) {
    d = new Date(date);
  }
  if (!isDate(d)) {
    d = new Date();
  }
  return Math.round(d.getTime() / 1000);
}

export function blobToBuffer(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const result = new Uint8Array(fr.result as ArrayBufferLike);
      resolve(result);
    };
    fr.onerror = () => {
      reject(fr.error);
    };
    fr.readAsArrayBuffer(file);
  });
}

export function filterOptions(options: ITinyOSSOptions) {
  const { accessKeyId, accessKeySecret, bucket, endpoint } = options;
  if (!accessKeyId) {
    throw new Error('need accessKeyId');
  }
  if (!accessKeySecret) {
    throw new Error('need accessKeySecret');
  }
  if (!bucket && !endpoint) {
    throw new Error('need bucket or endpoint');
  }
}

function hexToBuffer(hex: string) {
  const arr = [];
  for (let i = 0; i < hex.length; i += 2) {
    arr.push(parseInt(hex[i] + hex[i + 1], 16));
  }
  return Uint8Array.from(arr);
}

export function getContentMd5(buf: Uint8Array) {
  // md5 doesn't work for Uint8Array
  const bytes = Array.prototype.slice.call(buf, 0);
  const md5Buf = hexToBuffer(md5(bytes));
  return base64js.fromByteArray(md5Buf);
}

function getCannibalizedOSSHeaders(headers: Record<string, any>) {
  let result = '';
  let headerNames = Object.keys(headers);

  headerNames = headerNames.map((name) => name.toLowerCase());
  headerNames.sort();

  headerNames.forEach((name) => {
    if (name.indexOf('x-oss-') === 0) {
      result += `${name}:${headers[name]}\n`;
    }
  });

  return result;
}

function getCannibalizedResource(bucket = '', objectName = '', parameters: Record<string, string>) {
  let resourcePath = '';
  if (bucket) {
    resourcePath += `/${bucket}`;
  }
  if (objectName) {
    if (objectName.charAt(0) !== '/') {
      resourcePath += '/';
    }
    resourcePath += objectName;
  }

  let cannibalizedResource = `${resourcePath}`;
  let separatorString = '?';

  if (parameters) {
    const compareFunc = (entry1: string, entry2: string) => {
      if (entry1[0] > entry2[0]) {
        return 1;
      }
      if (entry1[0] < entry2[0]) {
        return -1;
      }
      return 0;
    };
    const processFunc = (key: string) => {
      cannibalizedResource += separatorString + key;
      if (parameters[key]) {
        cannibalizedResource += `=${parameters[key]}`;
      }
      separatorString = '&';
    };
    Object.keys(parameters).sort(compareFunc).forEach(processFunc);
  }

  return cannibalizedResource;
}

export function getSignature(options: any = {}) {
  const {
    type = 'header',
    verb = '',
    contentMd5 = '',
    expires = unix() + 3600,
    bucket,
    objectName,
    accessKeySecret,
    headers = {},
    subResource
  } = options;
  const date = headers['x-oss-date'] || '';
  const contentType = headers['Content-Type'] || '';
  const data = [verb, contentMd5, contentType];

  if (type === 'header') {
    data.push(date);
  } else {
    data.push(expires);
  }

  const cannibalizedOSSHeaders = getCannibalizedOSSHeaders(headers);
  const cannibalizedResource = getCannibalizedResource(bucket, objectName, subResource);

  data.push(`${cannibalizedOSSHeaders}${cannibalizedResource}`);
  const text = data.join('\n');
  const hmac = new Sha1('SHA-1', 'TEXT', { hmacKey: { value: accessKeySecret, format: 'TEXT' } });
  hmac.update(text);
  const hashBuf = hmac.getHash('UINT8ARRAY');
  const signature = base64js.fromByteArray(hashBuf);
  return signature;
}
