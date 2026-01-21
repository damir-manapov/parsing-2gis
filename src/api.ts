import type {
  ApiItem,
  ApiResponse,
  DayOfWeek,
  Organization,
  Schedule,
  SearchParams,
} from './types.js';

const API_BASE_URL = 'https://catalog.api.2gis.ru/3.0/items';

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

function generateSessionId(): string {
  // Using a fixed session ID format that the API accepts
  return 'e124f6f4-7b10-46bc-96f1-7c9c5e3857a6';
}

function generateUserHash(): string {
  // Using a fixed user hash that the API accepts
  return '7090465926170095974';
}

function generateUserId(): string {
  return 'f1ae1efb-d025-49b8-a2c8-e27d110e8573';
}

export function buildSearchUrl(params: SearchParams): string {
  const { query, viewpoint1, viewpoint2, page = 1, locale = 'ru_RU' } = params;
  // Note: pageSize is ignored - API only accepts page_size=12

  const sessionId = generateSessionId();
  const userHash = generateUserHash();
  const userId = generateUserId();
  const r = 4293796187; // Fixed r value from working request

  // Build URL manually to avoid encoding commas in fields and type parameters
  const queryEncoded = encodeURIComponent(query);
  const urlParts = [
    `key=${getApiKey()}`,
    `q=${queryEncoded}`,
    `fields=${DEFAULT_FIELDS}`,
    `type=${DEFAULT_TYPES}`,
    'page_size=12', // Fixed - API rejects other values
    `page=${page}`,
    `locale=${locale}`,
    'allow_deleted=true',
    'search_device_type=desktop',
    `search_user_hash=${userHash}`,
    `viewpoint1=${viewpoint1.lon},${viewpoint1.lat}`,
    `viewpoint2=${viewpoint2.lon},${viewpoint2.lat}`,
    `stat%5Bsid%5D=${sessionId}`,
    `stat%5Buser%5D=${userId}`,
    'shv=2026-01-21-17',
    `r=${r}`,
  ];

  return `${API_BASE_URL}?${urlParts.join('&')}`;
}

export async function search(params: SearchParams): Promise<ApiResponse> {
  const url = buildSearchUrl(params);

  const response = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const data = (await response.json()) as ApiResponse;

  if (data.meta.code !== 200) {
    throw new Error(`API error: ${data.meta.error?.message ?? 'Unknown error'}`);
  }

  return data;
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

export function parseItem(item: ApiItem): Organization {
  const city = item.adm_div?.find((d) => d.type === 'city')?.name;
  const district = item.adm_div?.find((d) => d.type === 'district')?.name;

  const phone = item.contact_groups
    ?.flatMap((g) => g.contacts ?? [])
    .find((c) => c.type === 'phone')?.value;

  return {
    id: item.id,
    name: item.name,
    address: item.address_name ?? '',
    addressComment: item.address_comment,
    city,
    district,
    point: item.point ?? { lat: 0, lon: 0 },
    phone,
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

    // API always returns 12 items per page
    if (items.length < 12) break;

    page++;
  }

  return allOrgs;
}
