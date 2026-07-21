import { TranslatorLayer } from '../services/TranslatorLayer';
import { AlchemaCore } from '../core/engine/AlchemaCore';

let translatorInstance: TranslatorLayer | null = null;

export function getTranslator() {
  if (!translatorInstance) {
    translatorInstance = new TranslatorLayer(new AlchemaCore());
  }
  return translatorInstance;
}
