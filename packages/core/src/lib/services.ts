import { TranslatorLayer } from '../services/TranslatorLayer';
import { AlchemaCore } from '../core/engine/AlchemaCore';

export const translator = new TranslatorLayer(new AlchemaCore());
