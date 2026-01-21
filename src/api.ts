import type {
  ApiItem,
  ApiResponse,
  DayOfWeek,
  Organization,
  Point,
  Schedule,
  SearchParams,
} from './types.js';

const API_BASE_URL = 'https://catalog.api.2gis.ru/3.0/items';

// API Constants
const API_PAGE_SIZE = 12; // Fixed - API rejects other values
const SEARCH_R_VALUE = 4293796187; // Fixed r value for search endpoint
const BYID_R_VALUE = 1138174652; // Fixed r value for byid endpoint
const DEFAULT_CONTEXT_RUBRIC_ID = '110357'; // Default context rubric (hookah bars)
const SESSION_ID = 'e124f6f4-7b10-46bc-96f1-7c9c5e3857a6';
const USER_HASH = '7090465926170095974';
const USER_ID = 'f1ae1efb-d025-49b8-a2c8-e27d110e8573';

function getApiKey(): string {
  const key = process.env['TWOGIS_API_KEY'];
  if (!key) {
    throw new Error('TWOGIS_API_KEY environment variable is not set');
  }
  return key;
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';

const DEFAULT_FIELDS = [
  'items.locale',
  'items.flags',
  'items.search_attributes.detection_type',
  'search_attributes',
  'items.search_attributes.best_keyword',
  'items.search_attributes.relevance',
  'items.adm_div',
  'items.city_alias',
  'items.region_id',
  'items.segment_id',
  'items.reviews',
  'items.point',
  'request_type',
  'context_rubrics',
  'query_context',
  'items.links',
  'items.name_ex',
  'items.name_back',
  'items.org',
  'items.group',
  'items.external_content',
  'items.comment',
  'items.ads.options',
  'items.email_for_sending.allowed',
  'items.stat',
  'items.description',
  'items.geometry.centroid',
  'items.geometry.selection',
  'items.geometry.style',
  'items.timezone_offset',
  'items.context',
  'items.address',
  'items.is_paid',
  'items.access',
  'items.access_comment',
  'items.for_trucks',
  'items.is_incentive',
  'items.paving_type',
  'items.capacity',
  'items.schedule',
  'items.schedule_special',
  'items.floors',
  'items.floor_id',
  'items.floor_plans',
  'dym',
  'ad',
  'items.rubrics',
  'items.routes',
  'items.reply_rate',
  'items.purpose',
  'items.purpose_code',
  'items.attribute_groups',
  'items.route_logo',
  'items.has_goods',
  'items.has_apartments_info',
  'items.has_pinned_goods',
  'items.has_realty',
  'items.has_payments',
  'items.is_promoted',
  'items.delivery',
  'items.order_with_cart',
  'search_type',
  'items.has_discount',
  'items.metarubrics',
  'items.detailed_subtype',
  'items.temporary_unavailable_atm_services',
  'items.poi_category',
  'items.has_ads_model',
  'items.vacancies',
  'filters',
  'widgets',
  'items.search_attributes.external_source',
  'items.summary',
].join(',');

// Full fields list required for API v3 (otherwise falls back to v2 which blocks the key)
const BYID_FIELDS = [
  'items.locale',
  'items.flags',
  'items.search_attributes.detection_type',
  'search_attributes',
  'items.search_attributes.relevance',
  'items.adm_div',
  'items.city_alias',
  'items.region_id',
  'items.segment_id',
  'items.reviews',
  'items.point',
  'request_type',
  'context_rubrics',
  'query_context',
  'items.links',
  'items.name_ex',
  'items.name_back',
  'items.org',
  'items.group',
  'items.dates',
  'items.external_content',
  'items.contact_groups',
  'items.comment',
  'items.ads.options',
  'items.email_for_sending.allowed',
  'items.stat',
  'items.stop_factors',
  'items.description',
  'items.geometry.centroid',
  'items.geometry.selection',
  'items.geometry.style',
  'items.timezone_offset',
  'items.context',
  'items.level_count',
  'items.address',
  'items.is_paid',
  'items.access',
  'items.access_comment',
  'items.for_trucks',
  'items.is_incentive',
  'items.paving_type',
  'items.capacity',
  'items.schedule',
  'items.schedule_special',
  'items.floors',
  'items.floor_id',
  'items.floor_plans',
  'ad',
  'items.rubrics',
  'items.routes',
  'items.platforms',
  'items.directions',
  'items.barrier',
  'items.reply_rate',
  'items.purpose',
  'items.purpose_code',
  'items.attribute_groups',
  'items.route_logo',
  'items.has_goods',
  'items.has_apartments_info',
  'items.has_pinned_goods',
  'items.has_realty',
  'items.has_otello_stories',
  'items.has_exchange',
  'items.has_payments',
  'items.has_dynamic_congestion',
  'items.is_promoted',
  'items.congestion',
  'items.delivery',
  'items.order_with_cart',
  'search_type',
  'items.has_discount',
  'items.metarubrics',
  'items.detailed_subtype',
  'items.temporary_unavailable_atm_services',
  'items.poi_category',
  'items.has_ads_model',
  'items.vacancies',
  'items.structure_info.material',
  'items.structure_info.floor_type',
  'items.structure_info.gas_type',
  'items.structure_info.year_of_construction',
  'items.structure_info.elevators_count',
  'items.structure_info.is_in_emergency_state',
  'items.structure_info.project_type',
  'items.has_otello_hotels',
  'items.ski_lift',
  'items.ski_track',
  'items.inactive',
  'items.links', // REQUIRED: duplicated at end to trigger API v3 (without it, falls back to v2)
].join(',');

const DEFAULT_TYPES = [
  'adm_div.city',
  'adm_div.district',
  'adm_div.district_area',
  'adm_div.division',
  'adm_div.living_area',
  'adm_div.place',
  'adm_div.region',
  'adm_div.settlement',
  'attraction',
  'branch',
  'building',
  'crossroad',
  'foreign_city',
  'gate',
  'parking',
  'road',
  'route',
  'station',
  'street',
  'coordinates',
  'kilometer_road_sign',
].join(',');

function buildCommonUrlParams(viewpoint1: Point, viewpoint2: Point): string[] {
  return [
    `viewpoint1=${viewpoint1.lon},${viewpoint1.lat}`,
    `viewpoint2=${viewpoint2.lon},${viewpoint2.lat}`,
    `stat%5Bsid%5D=${SESSION_ID}`,
    `stat%5Buser%5D=${USER_ID}`,
  ];
}

async function makeFetchRequest(url: string): Promise<ApiResponse> {
  const response = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const data = (await response.json()) as ApiResponse;

  const apiVersion = data.meta.api_version ?? 'unknown';
  if (!apiVersion.startsWith('3.')) {
    console.warn(`⚠️  API version ${apiVersion} detected (expected 3.x). URL may be malformed.`);
  }

  if (data.meta.code !== 200) {
    throw new Error(
      `API error: ${data.meta.error?.message ?? 'Unknown error'} (api_version: ${apiVersion})`,
    );
  }

  return data;
}

export function buildSearchUrl(params: SearchParams): string {
  const { query, viewpoint1, viewpoint2, page = 1, locale = 'ru_RU' } = params;

  const queryEncoded = encodeURIComponent(query);
  const urlParts = [
    `key=${getApiKey()}`,
    `q=${queryEncoded}`,
    `fields=${DEFAULT_FIELDS}`,
    `type=${DEFAULT_TYPES}`,
    `page_size=${API_PAGE_SIZE}`,
    `page=${page}`,
    `locale=${locale}`,
    'allow_deleted=true',
    'search_device_type=desktop',
    `search_user_hash=${USER_HASH}`,
    ...buildCommonUrlParams(viewpoint1, viewpoint2),
    'shv=2026-01-21-17',
    `r=${SEARCH_R_VALUE}`,
  ];

  return `${API_BASE_URL}?${urlParts.join('&')}`;
}

export async function search(params: SearchParams): Promise<ApiResponse> {
  const url = buildSearchUrl(params);
  return makeFetchRequest(url);
}

const DAYS_OF_WEEK: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function parseSchedule(
  apiSchedule?: Partial<Record<DayOfWeek, { working_hours: Array<{ from: string; to: string }> }>>,
): Schedule | undefined {
  if (!apiSchedule) return undefined;

  const schedule: Schedule = {};

  for (const day of DAYS_OF_WEEK) {
    const data = apiSchedule[day];
    if (data?.working_hours) {
      schedule[day] = data.working_hours.map((wh) => ({
        from: wh.from,
        to: wh.to,
      }));
    }
  }

  return Object.keys(schedule).length > 0 ? schedule : undefined;
}

interface ContactInfo {
  phone: string | undefined;
  website: string | undefined;
  email: string | undefined;
  telegram: string | undefined;
  vkontakte: string | undefined;
}

function parseContacts(item: ApiItem): ContactInfo {
  const allContacts = item.contact_groups?.flatMap((g) => g.contacts ?? []) ?? [];
  const findContact = (type: string) => allContacts.find((c) => c.type === type);

  const phone = findContact('phone')?.value;
  const websiteContact = findContact('website');
  const website = websiteContact?.url ?? websiteContact?.text;
  const email = findContact('email')?.value;
  const telegramContact = findContact('telegram');
  const telegram = telegramContact?.url ?? telegramContact?.value;
  const vkontakteContact = findContact('vkontakte');
  const vkontakte = vkontakteContact?.url ?? vkontakteContact?.value;

  return { phone, website, email, telegram, vkontakte };
}

export function parseItem(item: ApiItem): Organization {
  const city = item.adm_div?.find((d) => d.type === 'city')?.name;
  const district = item.adm_div?.find((d) => d.type === 'district')?.name;
  const contacts = parseContacts(item);

  return {
    id: item.id,
    name: item.name,
    address: item.address_name ?? '',
    addressComment: item.address_comment,
    city,
    district,
    point: item.point ?? { lat: 0, lon: 0 },
    ...contacts,
    schedule: parseSchedule(item.schedule),
    rubrics:
      item.rubrics?.map((r) => ({
        id: r.id,
        name: r.name,
        kind: r.kind as 'primary' | 'additional',
      })) ?? [],
    rating: item.reviews?.general_rating ?? item.reviews?.rating,
    reviewCount: item.reviews?.general_review_count ?? item.reviews?.review_count,
    orgId: item.org?.id,
    orgName: item.org?.name,
    orgBranchCount: item.org?.branch_count,
  };
}

export async function searchOrganizations(params: SearchParams): Promise<Organization[]> {
  const response = await search(params);
  const items = response.result?.items ?? [];
  return items.filter((item) => item.type === 'branch').map(parseItem);
}

export async function searchAllPages(params: SearchParams, maxPages = 10): Promise<Organization[]> {
  const allOrgs: Organization[] = [];
  let page = 1;

  while (page <= maxPages) {
    const response = await search({ ...params, page });
    const items = response.result?.items ?? [];

    if (items.length === 0) break;

    const orgs = items.filter((item) => item.type === 'branch').map(parseItem);
    allOrgs.push(...orgs);

    if (items.length < API_PAGE_SIZE) break;

    page++;
  }

  return allOrgs;
}

export interface ByIdParams {
  id: string;
  viewpoint1: Point;
  viewpoint2: Point;
  locale?: string;
  /** Context rubric ID (e.g., 110357 for hookah bars) */
  contextRubricId?: string;
}

export function buildByIdUrl(params: ByIdParams): string {
  const {
    id,
    viewpoint1,
    viewpoint2,
    locale = 'ru_RU',
    contextRubricId = DEFAULT_CONTEXT_RUBRIC_ID,
  } = params;

  const dateStr = new Date().toISOString().split('T')[0];
  if (!dateStr) throw new Error('Invalid date');
  const shv = `${dateStr.slice(0, 4)}-${dateStr.slice(5, 7)}-${dateStr.slice(8, 10)}-17`;

  // search_ctx format required for API v3
  const searchCtx = `0:r%3D${contextRubricId}%3B1:a%3D70000201006757123%3B2:a%3D70000201006755194%3B3:r%3D367`;

  const urlParts = [
    `id=${encodeURIComponent(id)}`,
    `key=${getApiKey()}`,
    `locale=${locale}`,
    `fields=${BYID_FIELDS}`,
    `search_ctx=${searchCtx}`,
    `context_rubrics%5B0%5D=${contextRubricId}`,
    ...buildCommonUrlParams(viewpoint1, viewpoint2),
    `shv=${shv}`,
    `r=${BYID_R_VALUE}`,
  ];

  return `${API_BASE_URL}/byid?${urlParts.join('&')}`;
}

export async function getOrganizationById(params: ByIdParams): Promise<Organization | undefined> {
  const url = buildByIdUrl(params);
  const data = await makeFetchRequest(url);

  const item = data.result?.items[0];
  if (!item) return undefined;

  return parseItem(item);
}
