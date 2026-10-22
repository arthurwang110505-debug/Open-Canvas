#!/usr/bin/env node
/**
 * Regenerates `packages/icons/src/data.ts` from the Lucide icon set that is already installed.
 *
 * OpenCanvas stores icons as *data* (see `packages/icons`), not as components, so the generated
 * file is a plain table: one entry per icon with the 24×24 shapes Lucide draws. Running this is
 * only necessary when the icon set should change; the output is committed so the app never needs
 * the generator, a network call, or a build step.
 *
 *   node scripts/generate-icons.mjs [--limit N] [--family name,name]
 *
 * Why not import lucide-react at runtime: its 2 000+ entries are React components, which would
 * put React (and a megabyte of JSX) into `@opencanvas/icons` — a package the Node-side exporters
 * and a future API must be able to use. Turning them into path data keeps the package pure.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const lucideDir = join(repoRoot, 'apps/web/node_modules/lucide-react');
const outputFile = join(repoRoot, 'packages/icons/src/data.ts');

const args = process.argv.slice(2);
const limitArg = args.indexOf('--limit');
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : Number.POSITIVE_INFINITY;

/**
 * The catalogue: an ordered, curated subset rather than all 2 154 Lucide icons. A design tool
 * needs icons that look at home next to text and shapes, and every entry here is chosen for that;
 * the list is duplicated nowhere else, so adding an icon is one line plus a regeneration.
 */
const CATALOGUE = [
  // Essentials
  ['heart', 'Love like favorite romance', 'essentials'],
  ['star', 'Favorite rating bookmark', 'essentials'],
  ['bookmark', 'Save read later', 'essentials'],
  ['home', 'House homepage', 'essentials'],
  ['search', 'Find magnifier lookup', 'essentials'],
  ['settings', 'Gear preferences cog', 'essentials'],
  ['bell', 'Notification alert ring', 'essentials'],
  ['trash-2', 'Delete remove bin', 'essentials'],
  ['check', 'Tick done yes', 'essentials'],
  ['x', 'Close remove cross', 'essentials'],
  ['plus', 'Add new create', 'essentials'],
  ['minus', 'Remove subtract', 'essentials'],
  ['info', 'Information about', 'essentials'],
  ['help-circle', 'Question help support', 'essentials'],
  ['alert-triangle', 'Warning caution danger', 'essentials'],
  ['lock', 'Private security secure', 'essentials'],
  ['unlock', 'Open access', 'essentials'],
  ['key-round', 'Password key access', 'essentials'],
  ['eye', 'View visible watch', 'essentials'],
  ['eye-off', 'Hide hidden invisible', 'essentials'],
  ['bell-ring', 'Notification alert sound', 'essentials'],
  ['bookmark-check', 'Saved read', 'essentials'],
  ['badge-check', 'Verified approved', 'essentials'],
  ['ban', 'Block forbidden', 'essentials'],
  ['flag-triangle-right', 'Milestone report', 'essentials'],
  ['lock-keyhole', 'Secure private', 'essentials'],
  ['shield-check', 'Security safe verified', 'essentials'],
  ['scan-face', 'Face id', 'essentials'],
  ['sparkle', 'Shine new', 'essentials'],
  ['sun-medium', 'Bright daylight', 'essentials'],
  ['moon-star', 'Night clear', 'essentials'],
  ['rotate-ccw', 'Undo back', 'arrows'],
  ['rotate-cw', 'Redo forward', 'arrows'],
  ['expand', 'Fullscreen grow', 'arrows'],
  ['shrink', 'Collapse small', 'arrows'],
  ['arrow-right', 'Next direction', 'arrows'],
  ['arrow-left', 'Back direction', 'arrows'],
  ['arrow-up', 'Up direction', 'arrows'],
  ['arrow-down', 'Down direction', 'arrows'],
  ['arrow-up-right', 'External diagonal', 'arrows'],
  ['chevron-right', 'Forward next', 'arrows'],
  ['chevron-down', 'Expand more', 'arrows'],
  ['refresh-ccw', 'Reload retry', 'arrows'],
  ['repeat', 'Loop again', 'arrows'],
  ['shuffle', 'Random mix', 'arrows'],
  ['log-in', 'Sign in enter', 'essentials'],
  ['log-out', 'Sign out exit', 'essentials'],
  ['power', 'On off switch', 'essentials'],
  ['sliders-horizontal', 'Settings adjust', 'essentials'],
  ['filter', 'Filter funnel', 'essentials'],
  ['zoom-in', 'Magnify larger', 'essentials'],
  ['zoom-out', 'Magnify smaller', 'essentials'],
  ['mouse-pointer', 'Cursor click', 'essentials'],

  // People
  ['user', 'Person profile account', 'people'],
  ['users', 'People team group crowd', 'people'],
  ['user-round', 'Avatar member', 'people'],
  ['user-plus', 'Add friend invite', 'people'],
  ['smile', 'Happy face emoji', 'people'],
  ['frown', 'Sad face emoji', 'people'],
  ['laugh', 'Laugh emoji funny', 'people'],
  ['meh', 'Neutral face emoji', 'people'],
  ['thumbs-up', 'Like approve yes', 'people'],
  ['thumbs-down', 'Dislike reject no', 'people'],
  ['hand', 'Wave stop palm', 'people'],
  ['baby', 'Child kid', 'people'],
  ['accessibility', 'Wheelchair access', 'people'],
  ['graduation-cap', 'School education study', 'people'],
  ['user-check', 'Approved member', 'people'],
  ['user-x', 'Removed member', 'people'],
  ['users-round', 'Team group', 'people'],
  ['contact', 'Contact card', 'people'],
  ['handshake', 'Deal agree partnership', 'people'],
  ['person-standing', 'Human body', 'people'],
  ['footprints', 'Steps walk', 'people'],
  ['heart-handshake', 'Care support kind', 'people'],

  // Communication
  ['mail', 'Email envelope message', 'communication'],
  ['phone', 'Call telephone', 'communication'],
  ['message-circle', 'Chat comment speech', 'communication'],
  ['message-square', 'Message note', 'communication'],
  ['send', 'Send submit paper plane', 'communication'],
  ['share-2', 'Share network', 'communication'],
  ['at-sign', 'Mention email handle', 'communication'],
  ['megaphone', 'Announce marketing loud', 'communication'],
  ['rss', 'Feed subscribe blog', 'communication'],
  ['link', 'Url chain connect', 'communication'],
  ['external-link', 'Open new tab', 'communication'],
  ['reply', 'Respond answer', 'communication'],
  ['mail-open', 'Read email', 'communication'],
  ['mail-check', 'Email sent', 'communication'],
  ['phone-call', 'Call talk', 'communication'],
  ['send-horizontal', 'Submit send', 'communication'],
  ['share', 'Share social', 'communication'],
  ['bell-dot', 'Notification new', 'communication'],
  ['podcast', 'Podcast show', 'communication'],
  ['radio', 'Radio broadcast', 'communication'],
  ['hash', 'Hashtag topic', 'communication'],
  ['reply-all', 'Reply everyone', 'communication'],
  ['forward', 'Forward pass', 'arrows'],
  ['undo-2', 'Undo back', 'arrows'],
  ['redo-2', 'Redo forward', 'arrows'],

  // Time
  ['calendar', 'Date schedule event', 'time'],
  ['calendar-days', 'Plan month schedule', 'time'],
  ['clock', 'Time watch hour', 'time'],
  ['timer', 'Countdown stopwatch', 'time'],
  ['alarm-clock', 'Wake alarm reminder', 'time'],
  ['hourglass', 'Wait pending', 'time'],
  ['calendar-check', 'Booked confirmed', 'time'],
  ['calendar-plus', 'New event', 'time'],
  ['calendar-range', 'Schedule range', 'time'],
  ['history', 'Recent past', 'time'],
  ['timer-reset', 'Restart countdown', 'time'],

  // Business
  ['briefcase', 'Work job business', 'business'],
  ['building', 'Office company', 'business'],
  ['building-2', 'Corporate city', 'business'],
  ['store', 'Shop retail', 'business'],
  ['shopping-bag', 'Shopping purchase', 'business'],
  ['shopping-cart', 'Cart buy checkout', 'business'],
  ['tag', 'Price label sale', 'business'],
  ['ticket', 'Event admission', 'business'],
  ['credit-card', 'Payment card', 'business'],
  ['wallet', 'Money payment', 'business'],
  ['banknote', 'Cash money bill', 'business'],
  ['dollar-sign', 'Money price usd', 'business'],
  ['receipt', 'Invoice bill', 'business'],
  ['calculator', 'Math budget', 'business'],
  ['chart-line', 'Graph growth analytics', 'business'],
  ['chart-bar', 'Graph stats report', 'business'],
  ['chart-pie', 'Share pie analytics', 'business'],
  ['trending-up', 'Growth increase profit', 'business'],
  ['target', 'Goal aim focus', 'business'],
  ['presentation', 'Pitch slides talk', 'business'],
  ['badge-dollar-sign', 'Price paid', 'business'],
  ['badge-percent', 'Discount sale', 'business'],
  ['chart-no-axes-column', 'Bars stats', 'business'],
  ['chart-spline', 'Trend curve', 'business'],
  ['coins', 'Money coins', 'business'],
  ['hand-coins', 'Earn income', 'business'],
  ['landmark', 'Bank government', 'business'],
  ['percent', 'Discount percent', 'business'],
  ['piggy-bank', 'Savings money', 'business'],
  ['receipt-text', 'Invoice bill', 'business'],
  ['clipboard-list', 'Checklist tasks', 'business'],
  ['briefcase-business', 'Work job', 'business'],
  ['factory', 'Manufacture industry', 'business'],
  ['warehouse', 'Storage logistics', 'business'],
  ['truck', 'Delivery shipping', 'business'],
  ['package-check', 'Delivered order', 'business'],
  ['package-open', 'Unboxing order', 'business'],
  ['barcode', 'Product code', 'business'],

  // Technology
  ['monitor', 'Desktop screen computer', 'technology'],
  ['smartphone', 'Mobile phone', 'technology'],
  ['laptop', 'Computer notebook', 'technology'],
  ['tablet', 'Device touchscreen', 'technology'],
  ['keyboard', 'Typing input', 'technology'],
  ['mouse', 'Pointer click', 'technology'],
  ['printer', 'Print paper', 'technology'],
  ['wifi', 'Internet signal', 'technology'],
  ['bluetooth', 'Wireless pairing', 'technology'],
  ['battery', 'Power charge', 'technology'],
  ['plug', 'Power socket', 'technology'],
  ['cpu', 'Processor chip', 'technology'],
  ['database', 'Data storage', 'technology'],
  ['server', 'Hosting backend', 'technology'],
  ['cloud', 'Cloud storage', 'technology'],
  ['download', 'Save receive', 'technology'],
  ['upload', 'Send publish', 'technology'],
  ['refresh-cw', 'Reload sync', 'technology'],
  ['code', 'Developer programming', 'technology'],
  ['terminal', 'Console command', 'technology'],
  ['bug', 'Issue error debug', 'technology'],
  ['qr-code', 'Scan qr', 'technology'],
  ['camera', 'Photo picture', 'technology'],
  ['video', 'Film record movie', 'technology'],
  ['headphones', 'Listen audio', 'technology'],
  ['mic', 'Record voice microphone', 'technology'],
  ['speaker', 'Sound volume', 'technology'],
  ['music', 'Song note audio', 'technology'],
  ['gamepad-2', 'Game controller play', 'technology'],
  ['tv', 'Television screen', 'technology'],
  ['monitor-smartphone', 'Devices responsive', 'technology'],
  ['smartphone-charging', 'Charging battery', 'technology'],
  ['hard-drive', 'Storage disk', 'technology'],
  ['memory-stick', 'Usb drive', 'technology'],
  ['microchip', 'Chip hardware', 'technology'],
  ['server-cog', 'Server config', 'technology'],
  ['cloud-upload', 'Upload cloud', 'technology'],
  ['cloud-download', 'Download cloud', 'technology'],
  ['database-backup', 'Backup data', 'technology'],
  ['router', 'Network wifi', 'technology'],
  ['satellite-dish', 'Signal dish', 'technology'],
  ['bluetooth-connected', 'Wireless paired', 'technology'],
  ['battery-charging', 'Charging power', 'technology'],
  ['power-off', 'Shutdown off', 'technology'],
  ['usb', 'Usb port', 'technology'],
  ['cast', 'Stream screen', 'technology'],
  ['screen-share', 'Screen share', 'technology'],
  ['circle-play', 'Play start', 'technology'],
  ['circle-pause', 'Pause stop', 'technology'],

  // Travel
  ['plane', 'Flight travel airport', 'travel'],
  ['car', 'Drive vehicle auto', 'travel'],
  ['bus', 'Transit public', 'travel'],
  ['train-front', 'Rail transit', 'travel'],
  ['bike', 'Bicycle cycle', 'travel'],
  ['ship', 'Cruise boat', 'travel'],
  ['map', 'Location directions', 'travel'],
  ['map-pin', 'Place marker location', 'travel'],
  ['compass', 'Explore direction', 'travel'],
  ['navigation', 'Route gps', 'travel'],
  ['globe', 'World international', 'travel'],
  ['plane-takeoff', 'Departure flight', 'travel'],
  ['luggage', 'Suitcase travel bag', 'travel'],
  ['tent', 'Camp outdoors', 'travel'],
  ['mountain', 'Hike nature peak', 'travel'],
  ['palmtree', 'Beach tropical island', 'travel'],
  ['plane-landing', 'Arrival land', 'travel'],
  ['car-front', 'Drive car', 'travel'],
  ['caravan', 'Camper van', 'travel'],
  ['ship-wheel', 'Captain helm', 'travel'],
  ['sailboat', 'Sailing boat', 'travel'],
  ['fuel', 'Gas station', 'travel'],
  ['map-pinned', 'Pinned location', 'travel'],
  ['backpack', 'Backpacking hike', 'travel'],
  ['route', 'Travel route', 'travel'],
  ['signpost', 'Directions sign', 'travel'],
  ['mountain-snow', 'Ski peak', 'travel'],
  ['tree-pine', 'Forest pine', 'travel'],

  // Food
  ['utensils', 'Food eat restaurant', 'food'],
  ['utensils-crossed', 'Dining restaurant', 'food'],
  ['coffee', 'Cafe cup drink', 'food'],
  ['pizza', 'Food slice', 'food'],
  ['cake', 'Birthday dessert', 'food'],
  ['ice-cream-cone', 'Dessert sweet', 'food'],
  ['wine', 'Drink glass bar', 'food'],
  ['beer', 'Drink pub', 'food'],
  ['martini', 'Cocktail bar party', 'food'],
  ['chef-hat', 'Cook kitchen', 'food'],
  ['croissant', 'Bakery breakfast', 'food'],
  ['salad', 'Healthy food greens', 'food'],
  ['apple', 'Fruit healthy', 'food'],
  ['sandwich', 'Lunch food', 'food'],
  ['cooking-pot', 'Cook meal', 'food'],
  ['beef', 'Steak meat', 'food'],
  ['drumstick', 'Chicken meat', 'food'],
  ['egg-fried', 'Breakfast egg', 'food'],
  ['cookie', 'Biscuit snack', 'food'],
  ['donut', 'Sweet pastry', 'food'],
  ['popcorn', 'Cinema snack', 'food'],
  ['milk', 'Drink dairy', 'food'],
  ['cup-soda', 'Soda drink', 'food'],

  // Nature
  ['sun', 'Weather sunny bright', 'nature'],
  ['moon', 'Night dark sleep', 'nature'],
  ['cloud-rain', 'Weather rain forecast', 'nature'],
  ['snowflake', 'Winter cold snow', 'nature'],
  ['flame', 'Fire hot burn', 'nature'],
  ['droplet', 'Water liquid', 'nature'],
  ['wind', 'Breeze air', 'nature'],
  ['leaf', 'Plant eco green', 'nature'],
  ['flower', 'Bloom nature', 'nature'],
  ['trees', 'Forest nature', 'nature'],
  ['sprout', 'Grow plant start', 'nature'],
  ['rainbow', 'Color arc', 'nature'],
  ['sunrise', 'Morning dawn', 'nature'],
  ['waves', 'Sea ocean water', 'nature'],
  ['cloud-sun', 'Partly cloudy', 'nature'],
  ['cloud-moon', 'Night cloudy', 'nature'],
  ['cloud-lightning', 'Storm thunder', 'nature'],
  ['cloud-snow', 'Snow forecast', 'nature'],
  ['cloud-fog', 'Fog mist', 'nature'],
  ['sunset', 'Evening dusk', 'nature'],
  ['tornado', 'Storm wind', 'nature'],
  ['thermometer-sun', 'Hot temperature', 'nature'],

  // Animals
  ['dog', 'Pet puppy animal', 'animals'],
  ['cat', 'Pet kitten animal', 'animals'],
  ['fish', 'Sea animal', 'animals'],
  ['bird', 'Fly animal', 'animals'],
  ['rabbit', 'Bunny animal', 'animals'],
  ['paw-print', 'Pet animal track', 'animals'],
  ['squirrel', 'Animal forest', 'animals'],
  ['turtle', 'Animal slow', 'animals'],
  ['snail', 'Animal slow shell', 'animals'],
  ['bone', 'Dog bone pet', 'animals'],
  ['egg', 'Egg food', 'animals'],

  // Body & health
  ['heart-pulse', 'Health fitness rate', 'health'],
  ['activity', 'Pulse vitals', 'health'],
  ['stethoscope', 'Doctor medical', 'health'],
  ['pill', 'Medicine drug', 'health'],
  ['dumbbell', 'Gym workout fitness', 'health'],
  ['scale', 'Weight measure', 'health'],
  ['brain', 'Mind think mental', 'health'],
  ['syringe', 'Vaccine shot', 'health'],
  ['bandage', 'Injury first aid', 'health'],
  ['dna', 'Genetics science', 'health'],
  ['microscope', 'Science lab', 'health'],
  ['test-tube', 'Lab experiment', 'health'],
  ['thermometer', 'Fever temperature', 'health'],
  ['hospital', 'Clinic medical', 'health'],
  ['ambulance', 'Emergency medical', 'health'],

  // Media
  ['image', 'Picture photo', 'media'],
  ['images', 'Gallery album', 'media'],
  ['film', 'Movie cinema', 'media'],
  ['play', 'Start video', 'media'],
  ['pause', 'Stop hold', 'media'],
  ['volume-2', 'Sound audio', 'media'],
  ['book-open', 'Read book', 'media'],
  ['book', 'Read literature', 'media'],
  ['newspaper', 'News article', 'media'],
  ['palette', 'Art color design', 'media'],
  ['brush', 'Paint design art', 'media'],
  ['pen-tool', 'Vector design edit', 'media'],
  ['wand-2', 'Magic effects', 'media'],
  ['sparkles', 'Magic shiny new', 'media'],
  ['pencil', 'Edit write draw', 'media'],
  ['scissors', 'Cut trim', 'media'],
  ['ruler', 'Measure straight', 'media'],
  ['crop', 'Trim image', 'media'],
  ['move', 'Arrange drag position', 'media'],
  ['maximize', 'Fullscreen expand', 'media'],
  ['image-plus', 'Add picture', 'media'],
  ['image-play', 'Media gallery', 'media'],
  ['clapperboard', 'Film take', 'media'],
  ['music-2', 'Notes audio', 'media'],
  ['audio-lines', 'Waveform sound', 'media'],
  ['mic-vocal', 'Sing microphone', 'media'],
  ['tv-minimal', 'Flat screen', 'media'],
  ['wand-sparkles', 'Magic effects', 'media'],
  ['highlighter', 'Mark highlight', 'media'],
  ['eraser', 'Remove erase', 'media'],
  ['library', 'Books library', 'media'],
  ['book-audio', 'Audiobook read', 'media'],

  // Objects
  ['gift', 'Present surprise birthday', 'objects'],
  ['package', 'Box shipping delivery', 'objects'],
  ['watch', 'Time wrist clock', 'objects'],
  ['glasses', 'Eyewear sight', 'objects'],
  ['shirt', 'Clothing apparel', 'objects'],
  ['umbrella', 'Rain protection', 'objects'],
  ['lightbulb', 'Idea tip bright', 'objects'],
  ['lamp', 'Light home decor', 'objects'],
  ['sofa', 'Furniture living room', 'objects'],
  ['bed', 'Sleep bedroom', 'objects'],
  ['door-open', 'Exit entrance', 'objects'],
  ['hammer', 'Build repair tool', 'objects'],
  ['wrench', 'Fix tool settings', 'objects'],
  ['paint-roller', 'Paint wall decor', 'objects'],
  ['rocket', 'Launch start startup', 'objects'],
  ['trophy', 'Win award champion', 'objects'],
  ['medal', 'Award achievement', 'objects'],
  ['crown', 'Royal premium vip', 'objects'],
  ['gem', 'Diamond jewel luxury', 'objects'],
  ['flag', 'Mark milestone', 'objects'],
  ['shield', 'Security protect safe', 'objects'],
  ['zap', 'Power energy fast', 'objects'],
  ['bolt', 'Energy fast', 'objects'],
  ['puzzle', 'Solve piece game', 'objects'],
  ['dice-5', 'Game luck random', 'objects'],
  ['anchor', 'Boat stability', 'objects'],
  ['skull', 'Warning danger pirate', 'objects'],
  ['ghost', 'Spooky halloween', 'objects'],
  ['party-popper', 'Celebrate party fun', 'objects'],
  ['candy', 'Sweet treat', 'objects'],
  ['flower-2', 'Decoration bloom', 'objects'],
  ['shopping-basket', 'Basket shop', 'objects'],
  ['key', 'Key access password', 'objects'],
  ['lamp-desk', 'Desk lamp', 'objects'],
  ['bed-double', 'Double bed', 'objects'],
  ['bath', 'Bath tub', 'objects'],
  ['shower-head', 'Shower bath', 'objects'],
  ['drill', 'Power tool', 'objects'],
  ['paintbrush', 'Paint brush', 'objects'],
  ['diamond', 'Luxury jewel', 'objects'],
  ['dice-6', 'Game luck', 'objects'],
  ['balloon', 'Party celebrate', 'objects'],
  ['cake-slice', 'Dessert slice', 'objects'],
];

/** Returns the balanced `[...]` that starts at `from`, ignoring brackets inside strings. */
function readArrayLiteral(source, from) {
  let depth = 0;
  let inString = false;
  let quote = '';
  for (let i = from; i < source.length; i += 1) {
    const char = source[i];
    if (inString) {
      if (char === '\\') i += 1;
      else if (char === quote) inString = false;
      continue;
    }
    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
    } else if (char === '[') {
      depth += 1;
    } else if (char === ']') {
      depth -= 1;
      if (depth === 0) return source.slice(from, i + 1);
    }
  }
  throw new Error('Unbalanced shape array in the icon source.');
}

/**
 * Reads the shape data for one icon. Lucide ships deprecated names as one-line re-exports
 * (`home.mjs` → `house.mjs`), so follow those instead of failing on a well-known name.
 */
function readIcon(slug, depth = 0) {
  if (depth > 5) throw new Error(`Re-export chain for "${slug}" is too deep.`);
  const source = readFileSync(join(lucideDir, 'dist/esm/icons', `${slug}.mjs`), 'utf8');
  const alias = /export \{ default \} from '\.\/([\w-]+)\.mjs'/.exec(source);
  if (alias) return readIcon(alias[1], depth + 1);
  const start = source.indexOf('node: [');
  if (start < 0) throw new Error(`No shapes found for "${slug}".`);
  const literal = readArrayLiteral(source, start + 'node: '.length);
  // The generated literal is plain JSON (strings, numbers, booleans) apart from its unquoted
  // `key` properties, which are stripped rather than parsed — no eval, no dependency.
  const json = literal
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*):/g, '$1"$2":')
    .replace(/\s*key:\s*"[^"]*",?/g, '');
  const cleaned = json.replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(cleaned);
}

const SHAPE_TAGS = new Set(['path', 'circle', 'rect', 'line', 'ellipse', 'polyline', 'polygon']);

function toShapes(node) {
  if (!Array.isArray(node)) throw new Error('Unexpected icon node shape.');
  return node.map(([tag, attrs]) => {
    if (!SHAPE_TAGS.has(tag)) throw new Error(`Unsupported shape <${tag}>.`);
    const clean = {};
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'key') continue;
      clean[key] = String(value);
    }
    return [tag, clean];
  });
}

const seen = new Set();
const entries = [];
for (const [slug, keywords, family] of CATALOGUE) {
  if (seen.has(slug)) throw new Error(`Duplicate icon "${slug}" in the catalogue.`);
  seen.add(slug);
  if (entries.length >= limit) break;
  entries.push({
    id: slug,
    family,
    keywords: keywords.split(/\s+/),
    shapes: toShapes(readIcon(slug)),
  });
}

entries.sort((a, b) => a.id.localeCompare(b.id));

const header = `// Generated by scripts/generate-icons.mjs — do not edit by hand.
// Source: Lucide icons (https://lucide.dev), ISC licence, 24×24 grid.
import type { IconShape } from './types';

export interface IconEntry {
  id: string;
  /** Grouping used by the picker; also searchable. */
  family: string;
  keywords: string[];
  shapes: IconShape[];
}

export const ICON_ENTRIES: readonly IconEntry[] = `;

const body = entries
  .map(
    (entry) =>
      `  {\n    id: ${JSON.stringify(entry.id)},\n    family: ${JSON.stringify(entry.family)},\n` +
      `    keywords: ${JSON.stringify(entry.keywords)},\n` +
      `    shapes: ${JSON.stringify(entry.shapes)},\n  },`,
  )
  .join('\n');

writeFileSync(outputFile, `${header}[\n${body}\n];\n`);
// A generator is a CLI: the one place a plain `console.log` is the right output channel.
console.warn(`Wrote ${entries.length} icons to ${outputFile}`);
