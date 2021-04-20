import { THttpMethods } from '..';

interface IAjaxOpts {
  data?: any;
  headers: Record<string, any>;
  method: THttpMethods;
  timeout?: number;
  xhrInit?(xhr: XMLHttpRequest, abort: () => void): void;
  progress?(process: number): void;
}

export interface IAjaxRes<T = any> {
  data: T;
}

export default function ajax<T>(url: string, options = {} as IAjaxOpts) {
  return new Promise<IAjaxRes<T>>((resolve, reject) => {
    const { data = null, headers = {}, method = 'get', timeout = 0, progress } = options;

    const xhr = new XMLHttpRequest();

    let timerId = 0;

    if (timeout) {
      timerId = window.setTimeout(() => {
        reject(new Error(`the request timeout ${timeout}ms`));
      }, timeout);
    }

    xhr.onerror = () => {
      reject(new Error('unknown error'));
    };

    if (progress) {
      const onprogress = (event: ProgressEvent<EventTarget>) => {
        progress(Number(((event.loaded / event.total) * 100).toFixed(2)));
      };
      if (xhr.upload) {
        // Note: the progress event must be located before the xhr.open method
        xhr.upload.onprogress = onprogress;
      }
      xhr.onprogress = onprogress;
    }

    Promise.resolve().then(() => {
      if (options.xhrInit) {
        options.xhrInit(xhr, xhr.abort.bind(xhr));
      }
    });

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (timeout) clearTimeout(timerId);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ data: xhr.response });
        } else {
          if (xhr.status !== 0) {
            const err = new Error('the request is error');
            reject(err);
          }
        }
      }
    };

    xhr.open(method, url, true);

    Object.keys(headers).forEach((key) => {
      xhr.setRequestHeader(key, headers[key]);
    });

    try {
      xhr.send(data);
    } catch (err) {
      reject(err);
    }
  });
}
