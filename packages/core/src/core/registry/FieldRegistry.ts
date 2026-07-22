import { FieldTypePlugin } from './FieldTypePlugin';
import { ShortTextType } from './types/ShortTextType';
import { TextType } from './types/TextType';
import { NumberType } from './types/NumberType';
import { BooleanType } from './types/BooleanType';
import { DateType } from './types/DateType';
import { RelationType } from './types/RelationType';
import { SelectType } from './types/SelectType';
import { CurrencyType } from './types/CurrencyType';
import { PercentageType } from './types/PercentageType';
import { PhoneType } from './types/PhoneType';
import { AddressType } from './types/AddressType';
import { AttachmentType } from './types/AttachmentType';

export class FieldRegistry {
  private static instance: FieldRegistry;
  private plugins: Map<string, FieldTypePlugin>;

  private constructor() {
    this.plugins = new Map();
    // Register default plugins
    this.register(ShortTextType);
    this.register(TextType);
    this.register(NumberType);
    this.register(BooleanType);
    this.register(DateType);
    this.register(RelationType);
    this.register(SelectType);
    this.register(CurrencyType);
    this.register(PercentageType);
    this.register(PhoneType);
    this.register(AddressType);
    this.register(AttachmentType);
  }


  public static getInstance(): FieldRegistry {
    if (!FieldRegistry.instance) {
      FieldRegistry.instance = new FieldRegistry();
    }
    return FieldRegistry.instance;
  }

  public register(plugin: FieldTypePlugin): void {
    if (this.plugins.has(plugin.type)) {
      console.warn(`Plugin for type '${plugin.type}' is already registered and will be overwritten.`);
    }
    this.plugins.set(plugin.type, plugin);
  }

  public getPlugin(type: string): FieldTypePlugin {
    let plugin = this.plugins.get(type);
    if (!plugin) {
      // Fallback: search registered plugins by physicalType if exact logical type match not found
      for (const p of this.plugins.values()) {
        if (p.physicalType === type) {
          plugin = p;
          break;
        }
      }
    }
    if (!plugin) {
      throw new Error(`Unregistered field type requested: ${type}`);
    }
    return plugin;
  }

  public getAllPlugins(): FieldTypePlugin[] {
    return Array.from(this.plugins.values());
  }
}

