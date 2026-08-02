import type { FieldControlPlugin } from './types';
import { LookupControl } from './plugins/LookupControl';
import { ShortTextControl } from './plugins/ShortTextControl';
import { LongTextControl } from './plugins/LongTextControl';
import { RichTextControl } from './plugins/RichTextControl';
import { NumberControl } from './plugins/NumberControl';
import { DecimalControl } from './plugins/DecimalControl';
import { CurrencyControl } from './plugins/CurrencyControl';
import { SelectControl } from './plugins/SelectControl';
import { BooleanToggleControl, BooleanCheckboxControl, BooleanDropdownControl } from './plugins/BooleanControl';
import { DateControl } from './plugins/DateControl';
import { TimeControl } from './plugins/TimeControl';
import { DateTimeControl } from './plugins/DateTimeControl';
import { UserControl } from './plugins/UserControl';
import { PercentControl } from './plugins/PercentControl';
import { AddressControl } from './plugins/AddressControl';
import { AttachmentControl } from './plugins/AttachmentControl';
import { CitizenIdControl } from './plugins/CitizenIdControl';
import { LatLngControl } from './plugins/LatLngControl';
import { AutoNumberControl } from './plugins/AutoNumberControl';

export class FieldControlRegistry {
  private static instance: FieldControlRegistry;
  private controls: Map<string, FieldControlPlugin>;

  private constructor() {
    this.controls = new Map();
    // Register built-in default field controls
    this.register(LookupControl);
    this.register(ShortTextControl);
    this.register(LongTextControl);
    this.register(RichTextControl);
    this.register(NumberControl);
    this.register(DecimalControl);
    this.register(CurrencyControl);
    this.register(PercentControl);
    this.register(SelectControl);
    this.register(BooleanToggleControl);
    this.register(BooleanCheckboxControl);
    this.register(BooleanDropdownControl);
    this.register(DateControl);
    this.register(TimeControl);
    this.register(DateTimeControl);
    this.register(UserControl);
    this.register(AddressControl);
    this.register(AttachmentControl);
    this.register(CitizenIdControl);
    this.register(LatLngControl);
    this.register(AutoNumberControl);
  }

  public static getInstance(): FieldControlRegistry {
    if (!FieldControlRegistry.instance) {
      FieldControlRegistry.instance = new FieldControlRegistry();
    }
    return FieldControlRegistry.instance;
  }

  public register(control: FieldControlPlugin): void {
    if (this.controls.has(control.id)) {
      console.warn(`[FieldControlRegistry] Control '${control.id}' is already registered and will be overwritten.`);
    }
    this.controls.set(control.id, control);
  }

  public getControl(id: string): FieldControlPlugin | undefined {
    return this.controls.get(id);
  }

  public getControlsForType(logicalType: string): FieldControlPlugin[] {
    return Array.from(this.controls.values()).filter((c) =>
      c.compatibleTypes.includes(logicalType)
    );
  }

  public getFallbackControl(logicalType: string): FieldControlPlugin {
    const list = this.getControlsForType(logicalType);
    const defaultCtrl = list.find((c) => c.isDefault);
    if (defaultCtrl) return defaultCtrl;
    if (list.length > 0) return list[0];

    // Fallback to ShortTextControl if type isn't registered
    return ShortTextControl;
  }

  public getAllControls(): FieldControlPlugin[] {
    return Array.from(this.controls.values());
  }
}
