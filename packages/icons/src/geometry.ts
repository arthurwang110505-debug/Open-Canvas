import type { IconShape } from './types';

function number(attributes: Readonly<Record<string, string>>, key: string, fallback = 0): number {
  const raw = attributes[key];
  if (raw === undefined) return fallback;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

/**
 * `points` is a flat list of numbers in SVG (`"3 11 22 2"`), though `x,y` pairs also occur.
 * Both spellings reduce to the same sequence of coordinates.
 */
function points(attributes: Readonly<Record<string, string>>): string {
  const coordinates = (attributes['points'] ?? '')
    .split(/[\s,]+/)
    .filter((value) => value.length > 0)
    .map(Number);
  const commands: string[] = [];
  for (let index = 0; index + 1 < coordinates.length; index += 2) {
    commands.push(`${index === 0 ? 'M' : 'L'} ${coordinates[index]} ${coordinates[index + 1]}`);
  }
  return commands.join(' ');
}

/**
 * Converts one catalogue shape into SVG path data.
 *
 * The canvas adapter needs a single object per icon, and Fabric draws paths, not `<circle>`s. Both
 * renderers therefore agree on geometry only if this conversion is exact — it is unit-tested
 * against the equivalent primitives, and the export path keeps emitting the native SVG shape.
 */
export function iconShapeToPathData([tag, attributes]: IconShape): string {
  switch (tag) {
    case 'path':
      return attributes['d'] ?? '';
    case 'circle':
    case 'ellipse': {
      const cx = number(attributes, 'cx');
      const cy = number(attributes, 'cy');
      const rx = number(attributes, tag === 'circle' ? 'r' : 'rx');
      const ry = number(attributes, tag === 'circle' ? 'r' : 'ry');
      // Two half arcs, the standard way to express an ellipse without `A` endpoint ambiguity.
      return `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${2 * rx} 0 a ${rx} ${ry} 0 1 0 ${-2 * rx} 0`;
    }
    case 'rect': {
      const x = number(attributes, 'x');
      const y = number(attributes, 'y');
      const width = number(attributes, 'width');
      const height = number(attributes, 'height');
      const rx = Math.min(number(attributes, 'rx'), width / 2, height / 2);
      const ry = Math.min(number(attributes, 'ry', rx) || rx, width / 2, height / 2);
      if (rx <= 0 || ry <= 0) {
        return `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`;
      }
      return (
        `M ${x + rx} ${y} H ${x + width - rx} A ${rx} ${ry} 0 0 1 ${x + width} ${y + ry} ` +
        `V ${y + height - ry} A ${rx} ${ry} 0 0 1 ${x + width - rx} ${y + height} ` +
        `H ${x + rx} A ${rx} ${ry} 0 0 1 ${x} ${y + height - ry} ` +
        `V ${y + ry} A ${rx} ${ry} 0 0 1 ${x + rx} ${y} Z`
      );
    }
    case 'line':
      return `M ${number(attributes, 'x1')} ${number(attributes, 'y1')} L ${number(
        attributes,
        'x2',
      )} ${number(attributes, 'y2')}`;
    case 'polyline':
      return points(attributes);
    case 'polygon':
      return `${points(attributes)} Z`;
  }
}
