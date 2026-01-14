export interface Announcement {
  reference: string;
  city: string;
  price: number;
  square_meter: number;
  zip_code: string;
  type: string;
  contract_type: string;
  slug: string;
  latitude: number;
  longitude: number;
  benefit: string;
  place_type: string;
  is_professional: boolean;
  is_exact_location: boolean;
  label_type: string;
  rental_ht_hc: number;
  is_agency_cost: boolean;
  number_of_beds: number | null;
  expense_search: number | null;
  picture: string;
  pictures?: string[];
  detail: string;
  date: string;
  // Enriched fields (fetched from detail API)
  title?: string;
}

export interface AnnouncementExtra {
  name: string;
  value: string | null;
}

export interface AnnouncementDpe {
  is_diagnostic: boolean;
  number_dpe: number | null;
  letter_dpe: string | null;
  number_ges: number | null;
  letter_ges: string | null;
  date: string | null;
  min_price: number | null;
  max_price: number | null;
  price_index: number | null;
}

export interface AnnouncementAgency {
  siret: string;
}

export interface AnnouncementDetail extends Announcement {
  title: string;
  agency: AnnouncementAgency | null;
  announcement_extras: AnnouncementExtra[];
  number_of_bedrooms: number | null;
  dpe: AnnouncementDpe | null;
  available_at: string | null;
  self: string;
  list: string;
}

export interface AnnouncementResponse {
  self: string;
  announcements: Announcement[];
  total_result: number;
  order: string;
}
