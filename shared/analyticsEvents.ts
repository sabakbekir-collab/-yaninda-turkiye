export const ANALYTICS_EVENTS = [
  'page_view','button_click','search','search_zero_results','category_click','place_click',
  'phone_click','directions_click','whatsapp_click','website_click','favorite_click',
  'share_click','ad_impression','ad_click','ai_open','ai_message',
  'location_permission','scroll_depth','time_on_page','error','heatmap_click'
] as const;
export type AnalyticsEvent = typeof ANALYTICS_EVENTS[number];
