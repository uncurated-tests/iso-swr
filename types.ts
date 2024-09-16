export interface Weather {
  auth?: string;
  location: {
    name: string;
    region: string;
    country: string;
    tz_id: string;
    localtime_epoch: number;
  };
  current: {
    temp_f: string;
    condition: {
      text: string;
    };
  };
}
