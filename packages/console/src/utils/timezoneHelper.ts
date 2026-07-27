/**
 * Helper utility to build all 400+ standard IANA timezones around the world
 * with formatted UTC offsets (e.g., "(UTC+07:00) Asia/Bangkok").
 */

export interface TimezoneOption {
  value: string;
  label: string;
}

export const buildAllTimezones = (): TimezoneOption[] => {
  try {
    if (typeof Intl !== 'undefined' && typeof (Intl as any).supportedValuesOf === 'function') {
      const tzList: string[] = (Intl as any).supportedValuesOf('timeZone');
      const now = new Date();

      const options = tzList.map(tz => {
        try {
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            timeZoneName: 'shortOffset'
          });
          const parts = formatter.formatToParts(now);
          const tzPart = parts.find(p => p.type === 'timeZoneName');
          let offset = tzPart ? tzPart.value : 'UTC';
          offset = offset.replace('GMT', 'UTC');
          if (offset === 'UTC') offset = 'UTC+00:00';
          return {
            value: tz,
            label: `(${offset}) ${tz}`
          };
        } catch {
          return { value: tz, label: tz };
        }
      });

      // Sort alphabetically by timezone label
      return options.sort((a, b) => a.label.localeCompare(b.label));
    }
  } catch (e) {
    console.warn('Intl.supportedValuesOf timeZone not supported, using standard fallback list:', e);
  }

  // Standard fallback timezone list covering all major world regions
  return [
    { value: 'Africa/Cairo', label: '(UTC+02:00) Africa/Cairo' },
    { value: 'Africa/Johannesburg', label: '(UTC+02:00) Africa/Johannesburg' },
    { value: 'Africa/Lagos', label: '(UTC+01:00) Africa/Lagos' },
    { value: 'America/Anchorage', label: '(UTC-09:00) America/Anchorage' },
    { value: 'America/Argentina/Buenos_Aires', label: '(UTC-03:00) America/Buenos_Aires' },
    { value: 'America/Chicago', label: '(UTC-06:00) America/Chicago' },
    { value: 'America/Denver', label: '(UTC-07:00) America/Denver' },
    { value: 'America/Los_Angeles', label: '(UTC-08:00) America/Los_Angeles' },
    { value: 'America/Mexico_City', label: '(UTC-06:00) America/Mexico_City' },
    { value: 'America/New_York', label: '(UTC-05:00) America/New_York' },
    { value: 'America/Phoenix', label: '(UTC-07:00) America/Phoenix' },
    { value: 'America/Sao_Paulo', label: '(UTC-03:00) America/Sao_Paulo' },
    { value: 'America/Toronto', label: '(UTC-05:00) America/Toronto' },
    { value: 'America/Vancouver', label: '(UTC-08:00) America/Vancouver' },
    { value: 'Asia/Almaty', label: '(UTC+06:00) Asia/Almaty' },
    { value: 'Asia/Baghdad', label: '(UTC+03:00) Asia/Baghdad' },
    { value: 'Asia/Bangkok', label: '(UTC+07:00) Asia/Bangkok' },
    { value: 'Asia/Dubai', label: '(UTC+04:00) Asia/Dubai' },
    { value: 'Asia/Hong_Kong', label: '(UTC+08:00) Asia/Hong_Kong' },
    { value: 'Asia/Jakarta', label: '(UTC+07:00) Asia/Jakarta' },
    { value: 'Asia/Jerusalem', label: '(UTC+02:00) Asia/Jerusalem' },
    { value: 'Asia/Kolkata', label: '(UTC+05:30) Asia/Kolkata' },
    { value: 'Asia/Kuala_Lumpur', label: '(UTC+08:00) Asia/Kuala_Lumpur' },
    { value: 'Asia/Manila', label: '(UTC+08:00) Asia/Manila' },
    { value: 'Asia/Riyadh', label: '(UTC+03:00) Asia/Riyadh' },
    { value: 'Asia/Seoul', label: '(UTC+09:00) Asia/Seoul' },
    { value: 'Asia/Shanghai', label: '(UTC+08:00) Asia/Shanghai' },
    { value: 'Asia/Singapore', label: '(UTC+08:00) Asia/Singapore' },
    { value: 'Asia/Taipei', label: '(UTC+08:00) Asia/Taipei' },
    { value: 'Asia/Tokyo', label: '(UTC+09:00) Asia/Tokyo' },
    { value: 'Atlantic/Reykjavik', label: '(UTC+00:00) Atlantic/Reykjavik' },
    { value: 'Australia/Adelaide', label: '(UTC+09:30) Australia/Adelaide' },
    { value: 'Australia/Brisbane', label: '(UTC+10:00) Australia/Brisbane' },
    { value: 'Australia/Melbourne', label: '(UTC+10:00) Australia/Melbourne' },
    { value: 'Australia/Perth', label: '(UTC+08:00) Australia/Perth' },
    { value: 'Australia/Sydney', label: '(UTC+10:00) Australia/Sydney' },
    { value: 'Europe/Amsterdam', label: '(UTC+01:00) Europe/Amsterdam' },
    { value: 'Europe/Athens', label: '(UTC+02:00) Europe/Athens' },
    { value: 'Europe/Berlin', label: '(UTC+01:00) Europe/Berlin' },
    { value: 'Europe/Brussels', label: '(UTC+01:00) Europe/Brussels' },
    { value: 'Europe/Dublin', label: '(UTC+00:00) Europe/Dublin' },
    { value: 'Europe/Helsinki', label: '(UTC+02:00) Europe/Helsinki' },
    { value: 'Europe/Istanbul', label: '(UTC+03:00) Europe/Istanbul' },
    { value: 'Europe/London', label: '(UTC+00:00) Europe/London' },
    { value: 'Europe/Madrid', label: '(UTC+01:00) Europe/Madrid' },
    { value: 'Europe/Moscow', label: '(UTC+03:00) Europe/Moscow' },
    { value: 'Europe/Paris', label: '(UTC+01:00) Europe/Paris' },
    { value: 'Europe/Rome', label: '(UTC+01:00) Europe/Rome' },
    { value: 'Europe/Stockholm', label: '(UTC+01:00) Europe/Stockholm' },
    { value: 'Europe/Vienna', label: '(UTC+01:00) Europe/Vienna' },
    { value: 'Europe/Zurich', label: '(UTC+01:00) Europe/Zurich' },
    { value: 'Pacific/Auckland', label: '(UTC+12:00) Pacific/Auckland' },
    { value: 'Pacific/Fiji', label: '(UTC+12:00) Pacific/Fiji' },
    { value: 'Pacific/Honolulu', label: '(UTC-10:00) Pacific/Honolulu' },
    { value: 'UTC', label: '(UTC+00:00) UTC' }
  ];
};

export const ALL_TIMEZONE_OPTIONS = buildAllTimezones();
