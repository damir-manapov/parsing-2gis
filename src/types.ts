export interface SearchParams {
  query: string;
  viewpoint1: { lon: number; lat: number };
  viewpoint2: { lon: number; lat: number };
  pageSize?: number;
  page?: number;
  locale?: string;
}

export interface Organization {
  id: string;
  name: string;
  address: string;
  addressComment: string | undefined;
  city: string | undefined;
  district: string | undefined;
  point: { lat: number; lon: number };
  phone: string | undefined;
  website: string | undefined;
  schedule: Schedule | undefined;
  rubrics: Rubric[];
  rating: number | undefined;
  reviewCount: number | undefined;
  orgId: string | undefined;
  orgName: string | undefined;
  orgBranchCount: number | undefined;
}

export interface Schedule {
  Mon?: WorkingHours[];
  Tue?: WorkingHours[];
  Wed?: WorkingHours[];
  Thu?: WorkingHours[];
  Fri?: WorkingHours[];
  Sat?: WorkingHours[];
  Sun?: WorkingHours[];
}

export interface WorkingHours {
  from: string;
  to: string;
}

export interface Rubric {
  id: string;
  name: string;
  kind: 'primary' | 'additional';
}

export interface ApiResponse {
  meta: {
    code: number;
    api_version: string;
    issue_date: string;
    error?: {
      message: string;
      type: string;
    };
  };
  result?: {
    items: ApiItem[];
    total: number;
  };
}

export interface ApiItem {
  id: string;
  type: string;
  name: string;
  address_name?: string;
  address_comment?: string;
  address?: {
    building_id?: string;
    postcode?: string;
    components?: Array<{
      type: string;
      street?: string;
      number?: string;
    }>;
  };
  adm_div?: Array<{
    id: string;
    name: string;
    type: string;
  }>;
  point?: {
    lat: number;
    lon: number;
  };
  org?: {
    id: string;
    name: string;
    branch_count?: number;
  };
  schedule?: Record<string, { working_hours: Array<{ from: string; to: string }> }>;
  rubrics?: Array<{
    id: string;
    name: string;
    kind: string;
  }>;
  reviews?: {
    general_rating?: number;
    general_review_count?: number;
    rating?: number;
    review_count?: number;
  };
  links?: {
    website?: string;
  };
  contact_groups?: Array<{
    contacts?: Array<{
      type: string;
      value: string;
    }>;
  }>;
}
