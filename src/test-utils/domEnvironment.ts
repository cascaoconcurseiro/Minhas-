import { GlobalRegistrator } from '@happy-dom/global-registrator';

if (typeof document === 'undefined') {
  GlobalRegistrator.register({ url: 'https://minhaseconomias.test', width: 1280, height: 800 });
}

Object.assign(window, { IS_REACT_ACT_ENVIRONMENT: true });
