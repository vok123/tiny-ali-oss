import ajax, { IAjaxRes } from './utils/ajax';
import { unix, blobToBuffer, filterOptions, getContentMd5, getSignature } from './utils';

export interface ITinyOSSOptions {
  accessKeyId: string; // access secret you create
  accessKeySecret: string; // access secret you create
  stsToken?: string; // used by temporary authorization
  bucket?: string; //  the default bucket you want to access If you don't have any bucket, please use putBucket() create one first.
  endpoint?: string; // oss region domain. It takes priority over region.
  region?: string; // the bucket data region location, please see Data Regions, default is oss-cn-hangzhou.
  internal?: boolean; //  access OSS with aliyun internal network or not, default is false. If your servers are running on aliyun too, you can set true to save lot of money.
  secure?: boolean; // instruct OSS client to use HTTPS (secure: true) or HTTP (secure: false) protocol.
  timeout?: number; // instance level timeout for all operations, default is 60s
  cname?: boolean; // use custom domain name
  policy?: string;
  [key: string]: any;
}

export interface IResponseHeaderType {
  'content-type'?: string;
  'content-disposition'?: string;
  'cache-control'?: string;
  [key: string]: any;
}
export type THttpMethods = 'GET' | 'POST' | 'DELETE' | 'PUT';

export interface ISignatureUrlOptions {
  expires?: number; // after expires seconds, the url will become invalid, default is 1800
  method?: THttpMethods; // the HTTP method, default is 'GET'
  'Content-Type'?: string; // set the request content type
  process?: string;
  response?: IResponseHeaderType; // set the response headers for download
  callback?: IObjectCallback;
  [key: string]: any;
}

export interface IObjectCallback {
  url: string; // After a file is uploaded successfully, the OSS sends a callback request to this URL.
  host?: string; // The host header value for initiating callback requests.
  body: string; // The value of the request body when a callback is initiated, for example, key=$(key)&etag=$(etag)&my_var=$(x:my_var).
  contentType?: string; // The Content-Type of the callback requests initiatiated, It supports application/x-www-form-urlencoded and application/json, and the former is the default value.
  customValue?: Record<string, any>;
  headers?: Record<string, any>; //  extra headers, detail see RFC 2616
  [key: string]: any;
}

interface IPutOptions {
  progress?(process: number): void;
  xhrInit?(xhr: XMLHttpRequest, abort: () => void): void;
}

export default class TinyAliOSS {
  constructor(options = {} as ITinyOSSOptions) {
    filterOptions(options);

    this.opts = Object.assign(
      {
        region: 'oss-cn-hangzhou',
        internal: false,
        cname: false,
        secure: false,
        timeout: 60000
      },
      options
    );

    const { bucket, region, endpoint, internal } = this.opts;

    this.host = '';

    if (endpoint) {
      this.host = endpoint;
    } else {
      let host = bucket;
      if (internal) {
        host += '-internal';
      }
      host += `.${region}.aliyuncs.com`;
      this.host = host + '';
    }
  }

  host = '';
  opts = {} as ITinyOSSOptions;

  put<T>(objectName: string, file: File, options = {} as IPutOptions) {
    return new Promise<IAjaxRes<T>>(async (resolve, reject) => {
      try {
        const buf = await blobToBuffer(file);
        const { accessKeyId, accessKeySecret, stsToken, bucket, policy } = this.opts;
        const verb = 'PUT';
        const contentMd5 = getContentMd5(buf);
        const contentType = file.type;
        const headers: Record<string, any> = {
          'Content-Md5': contentMd5,
          'Content-Type': contentType,
          'x-oss-date': new Date().toUTCString()
        };

        if (stsToken) {
          headers['x-oss-security-token'] = stsToken;
        }

        if (!policy) {
          const signature = getSignature({
            verb,
            contentMd5,
            headers,
            bucket,
            objectName,
            accessKeyId,
            accessKeySecret
          });
  
          headers.Authorization = `OSS ${accessKeyId}:${signature}`;
        }

        const protocol = this.opts.secure ? 'https' : 'http';
        const url = `${protocol}://${this.host}/${objectName}`;

        const result = ajax<T>(url, {
          method: verb,
          headers,
          data: file,
          xhrInit: options.xhrInit,
          timeout: this.opts.timeout || 60e3,
          progress: options.progress
        });
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  }

  // https://help.aliyun.com/document_detail/45126.html
  putSymlink<T>(name: string, targetName: string) {
    const { accessKeyId, accessKeySecret, stsToken, bucket } = this.opts;
    const verb = 'PUT';
    const headers: Record<string, any> = {
      'x-oss-date': new Date().toUTCString(),
      'x-oss-symlink-target': encodeURI(targetName)
    };

    if (stsToken) {
      headers['x-oss-security-token'] = stsToken;
    }

    const signature = getSignature({
      verb,
      headers,
      bucket,
      objectName: name,
      accessKeyId,
      accessKeySecret,
      subResource: {
        symlink: ''
      }
    });

    headers.Authorization = `OSS ${accessKeyId}:${signature}`;
    const protocol = this.opts.secure ? 'https' : 'http';
    const url = `${protocol}://${this.host}/${name}?symlink`;

    return ajax<T>(url, {
      method: verb,
      headers,
      timeout: this.opts.timeout
    });
  }

  signatureUrl(objectName: string, options = {} as ISignatureUrlOptions) {
    const { expires = 1800, method, process, response } = options;
    const { accessKeyId, accessKeySecret, stsToken, bucket } = this.opts;
    const headers: Record<string, any> = {};
    const subResource: Record<string, string> = {};

    if (process) {
      const processKeyword = 'x-oss-process';
      subResource[processKeyword] = process;
    }

    if (response) {
      Object.keys(response).forEach((k) => {
        const key = `response-${k.toLowerCase()}`;
        subResource[key] = response[k];
      });
    }

    Object.keys(options).forEach((key) => {
      const lowerKey = key.toLowerCase();
      const value = options[key];
      if (lowerKey.indexOf('x-oss-') === 0) {
        headers[lowerKey] = value;
      } else if (lowerKey.indexOf('content-md5') === 0) {
        headers[key] = value;
      } else if (lowerKey.indexOf('content-type') === 0) {
        headers[key] = value;
      } else if (lowerKey !== 'expires' && lowerKey !== 'response' && lowerKey !== 'process' && lowerKey !== 'method') {
        subResource[lowerKey] = value;
      }
    });

    const securityToken = options['security-token'] || stsToken;
    if (securityToken) {
      subResource['security-token'] = securityToken;
    }

    const expireUnix = unix() + expires;
    const signature = getSignature({
      type: 'url',
      verb: method || 'GET',
      accessKeyId,
      accessKeySecret,
      bucket,
      objectName,
      headers,
      subResource,
      expires: expireUnix
    });
    const protocol = this.opts.secure ? 'https' : 'http';
    let url = `${protocol}://${this.host}/${objectName}`;
    url += `?OSSAccessKeyId=${accessKeyId}`;
    url += `&Expires=${expireUnix}`;
    url += `&Signature=${encodeURIComponent(signature)}`;
    Object.keys(subResource).forEach((k) => {
      url += `&${k}=${encodeURIComponent(subResource[k])}`;
    });

    return url;
  }
}
