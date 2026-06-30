import { buildBusuanziScript, scriptResponse } from './shared.js';

export default function onRequest() {
  return scriptResponse(buildBusuanziScript({ apiBase: '/api/count', scriptName: 'count.js' }));
}
