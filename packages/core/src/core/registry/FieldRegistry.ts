import { FieldTypePlugin } from './FieldTypePlugin';
import { ShortTextType } from './types/ShortTextType';
import { TextType } from './types/TextType';
import { NumberType } from './types/NumberType';
import { BooleanType } from './types/BooleanType';
import { DateType } from './types/DateType';
import { RelationType } from './types/RelationType';

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
    const plugin = this.plugins.get(type);
    if (!plugin) {
      throw new Error(`Unregistered field type requested: ${type}`);
    }
    return plugin;
  }
}
