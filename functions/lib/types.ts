export type Env = {
  DB?: D1DatabaseLike;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
  OSM_CONTACT_EMAIL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};
export type D1Result<T=Record<string, unknown>>={results:T[];success?:boolean;meta?:Record<string,unknown>};
export type D1Prepared={bind(...values:unknown[]):D1Prepared;first<T=Record<string,unknown>>(column?:string):Promise<T|null>;all<T=Record<string,unknown>>():Promise<D1Result<T>>;run():Promise<unknown>};
export type D1DatabaseLike={prepare(sql:string):D1Prepared};
export type Place={id:string;name:string;category:string;lat:number;lon:number;address?:string;phone?:string;whatsapp?:string;openingHours?:string;website?:string;operator?:string;source:string;distance?:number;district?:string;isDuty?:boolean;officialUrl?:string;verifiedAt?:string;dutyUpdatedAt?:string};
