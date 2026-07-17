export interface CarouselSlide {
  title: string;
  text: string;
}

export interface SystemSettings {
  id: string;
  company_name: string;
  primary_color: string;
  secondary_color: string;
  tertiary_color: string;
  theme_mode: 'light' | 'dark';
  company_logo_url: string | null;
  auth_background_url: string | null;
  auth_background_flip: boolean;
  auth_overlay_color: string;
  auth_overlay_enabled: boolean;
  carousel_slides: CarouselSlide[];
  legal_entity_name?: string;
  company_reg_name?: string;
  fsp_number?: string;
  ncr_number?: string;
}

export const DEFAULT_CAROUSEL_SLIDES: CarouselSlide[] = [
  {
    title: 'Front End: Fully Branded Client Application Portal',
    text: 'Real-Time Affordability Intelligence (TruID Integration)\nCorporate Document Upload & E-Contracts'
  },
  {
    title: 'Back-End Risk & Compliance Engine',
    text: 'Instantly run real-time CIPC company checks, AML screening, director credit scoring, and biometric liveness checks at the point of application'
  },
  {
    title: 'Robust Operational Backbone',
    text: 'Mandate Control Room & Live Dry-Runs\nRisk-Based Pricing & Approval Hierarchies\nFull Audit Trail & Role-Based Access Logs'
  }
];

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  id: 'global',
  company_name: '',
  primary_color: '#5B21B6',
  secondary_color: '#4A0E8F',
  tertiary_color: '#11022A',
  theme_mode: 'light',
  company_logo_url: null,
  auth_background_url: null,
  auth_background_flip: false,
  auth_overlay_color: '#1E0B3B',
  auth_overlay_enabled: true,
  carousel_slides: DEFAULT_CAROUSEL_SLIDES.map((slide) => ({ ...slide }))
};
