# tiny-ali-oss (forked from Alex1990/tiny-oss)

缩减版ali-oss SDK, 提供上传及获取文件带签名访问链接

## Installation

Npm

```sh
npm i -S tiny-ali-oss
```

Yarn

```sh
yarn add tiny-ali-oss
```

## Usage

### Basic

```js
import TinyAliOSS from 'tiny-ali-oss';

const oss = new TinyAliOSS({
  accessKeyId: 'your accessKeyId',
  accessKeySecret: 'your accessKeySecret',
  stsToken: 'security token',
  region: 'oss-cn-beijing',
  bucket: 'your bucket'
});

const blob = new Blob(['hello world'], { type: 'text/plain' });

// Upload
oss.put('hello-world', blob);
```

### Upload progress

获取上传进度(xhr.onprogress)

```js
// Upload progress
oss.put('hello-world', blob, {
  progress (process) {
    console.log('process:', process + '%');
  }
});
```

### Upload abort

取消上传

```js
// Upload abort
let abortFn = null;
oss.put('hello-world', blob, {
  xhrInit(xhr, abort) {
    abortFn = abort;
  }
});

cancelBtn.onclick = () => {
  abortFn && abortFn();
}
```

### Download url

获取带签名访问链接

```js

const url = oss.signatureUrl('img/1.png');

document.querySelector('img').src = url;
// Or
downloadBtn.onclick = () => {
  window.location.href = url;
}
```

More options or methods see [API](#api).

## Compatibility

This package depends on some modern Web APIs, such as [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob), [Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array), [FileReader](https://developer.mozilla.org/en-US/docs/Web/API/FileReader), [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise).

浏览器兼容.

* Chrome >= 20
* Edge >= 12
* IE >= 10
* Firefox >= 4
* Safari >= 8
* Opera >= 11
* Android >= 4.4.4
* iOS >= 8

**For IE and low version FireFox, you should import a promise polyfill, such as [es6-promise](https://github.com/stefanpenner/es6-promise)**.

## API

```js
new TinyAliOSS(options)
```

### options

Please check [Browser.js offical document](https://help.aliyun.com/document_detail/64095.html?spm=a2c4g.11186623.6.1122.27976928XhTpTr).

* accessKeyId
* accessKeySecret
* stsToken
* bucket
* endpoint
* region
* secure
* timeout
* policy
---
### put(objectName, blob, options)

上传

#### Arguments

* **objectName (String)**: 路径+文件名.
* **blob (Blob|File)**: input.file.
* **[options (Object)]**
  + **[progress (Function)]**
  + **[xhrInit (Function)]**
#### Return

* **(Promise)**
---

### putSymlink(objectName, targetObjectName)

获取软连接.

#### Arguments

* **objectName (String)**: 路径+文件名.
* **targetObjectName (String)**: 目标文件名.

#### Return

* **(Promise)**
---
### signatureUrl(objectName, options)

获取文件带签名访问链接

#### Arguments

* **objectName (String)**: 路径+文件名.
* **[options (Object)]**:
  + **[options.expires (Number)]**: 访问超时时间(秒).

#### Return

* **(String)**
---
## LICENSE

MIT
