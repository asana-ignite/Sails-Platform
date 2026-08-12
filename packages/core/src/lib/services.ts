/**
 * services — singleton service locator for the TranslatorLayer (schema
 * DDL/metadata operations) and AlchemaCore (raw DDL execution). Route
 * handlers use these instead of constructing their own instances.
 */
import { TranslatorLayer } from '../services/TranslatorLayer';
import { AlchemaCore } from '../core/engine/AlchemaCore';

let translatorInstance: TranslatorLayer | null = null;

export function getTranslator() {
  if (!translatorInstance) {
    translatorInstance = new TranslatorLayer(new AlchemaCore());
  }
  return translatorInstance;
}
