// Field definitions for every managed collection. Used by the admin editor and by the public views.
// type: text | textarea | url | image | region | select | number | bool ; i18n: translated per content language
const common = [
  { key: 'image', type: 'image', label: 'Image' },
  { key: 'link', type: 'url', label: 'Link URL' },
  { key: 'order', type: 'number', label: 'Order' },
  { key: 'active', type: 'bool', label: 'Visible', default: true }
];

export const SCHEMAS = {
  mayors: {
    label: 'mayors', titleKey: 'name',
    fields: [
      { key: 'region', type: 'region', label: 'Region', required: true },
      { key: 'name', type: 'text', i18n: true, label: 'Name', required: true },
      { key: 'position', type: 'text', i18n: true, label: 'Position (e.g. Mayor of Suwon)' },
      { key: 'message', type: 'textarea', i18n: true, label: 'Greeting message' },
      ...common
    ]
  },
  festivals: {
    label: 'festivals', titleKey: 'title',
    fields: [
      { key: 'region', type: 'region', label: 'Region', required: true },
      { key: 'title', type: 'text', i18n: true, label: 'Festival name', required: true },
      { key: 'period', type: 'text', i18n: true, label: 'Period' },
      { key: 'description', type: 'textarea', i18n: true, label: 'Description' },
      ...common
    ]
  },
  investments: {
    label: 'investment', titleKey: 'title',
    fields: [
      { key: 'region', type: 'region', label: 'Region', required: true },
      { key: 'title', type: 'text', i18n: true, label: 'Title', required: true },
      { key: 'sector', type: 'text', i18n: true, label: 'Sector' },
      { key: 'description', type: 'textarea', i18n: true, label: 'Description' },
      ...common
    ]
  },
  social: {
    label: 'social', titleKey: 'title',
    fields: [
      { key: 'platform', type: 'select', label: 'Platform', options: ['youtube', 'facebook', 'x'], required: true },
      { key: 'region', type: 'region', label: 'Region', required: true },
      { key: 'title', type: 'text', i18n: true, label: 'Title', required: true },
      { key: 'url', type: 'url', label: 'Post / video URL', required: true },
      { key: 'image', type: 'image', label: 'Thumbnail (optional, auto for YouTube)' },
      { key: 'order', type: 'number', label: 'Order' },
      { key: 'active', type: 'bool', label: 'Visible', default: true }
    ]
  },
  // id = region code (2-digit province / 5-digit municipality)
  regions: {
    label: 'regions', titleKey: 'id',
    fields: [
      { key: 'url', type: 'url', label: 'Official website' },
      { key: 'intro', type: 'textarea', i18n: true, label: 'Introduction (banner text)' },
      { key: 'image', type: 'image', label: 'Banner image' },
      { key: 'link', type: 'url', label: 'Banner link (optional)' }
    ]
  },
  settings: {
    label: 'settings',
    fields: [
      { key: 'youtubeUrl', type: 'url', label: 'YouTube channel URL' },
      { key: 'youtubeChannelId', type: 'text', label: 'YouTube channel ID (UC…, enables the latest-videos player)' },
      { key: 'facebookUrl', type: 'url', label: 'Facebook page URL' },
      { key: 'xUrl', type: 'url', label: 'X profile URL' },
      { key: 'contactEmail', type: 'text', label: 'Contact e-mail (footer)' }
    ]
  }
};
