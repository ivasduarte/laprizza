/**
 * Pure helpers that read and write `content.assemblyLine` in the JSON text of the
 * kitchen configuration form (VIS03 placement, WEB06 back-end reference).
 *
 * Kept free of imports so they can be unit tested with `node --test`.
 */

export const NO_LINE = '';

const ZERO = { x: 0, y: 0, z: 0 };

/**
 * Referenced line id in the JSON text: NO_LINE when there is none, null when the text
 * is not valid JSON (the picker is then disabled).
 */
export function readSelectedLineId(contentText) {
  try {
    return JSON.parse(contentText)?.assemblyLine?.configurationId ?? NO_LINE;
  } catch {
    return null;
  }
}

/**
 * Default placement: centred against the back wall (negative z), so the line stands
 * "on one kitchen wall". The scene centres the kitchen floor on the origin.
 */
export function defaultPlacement(kitchenContent) {
  const length = Number(kitchenContent?.dimensions?.length) || 0;
  return {
    position: { x: 0, y: 0, z: length > 0 ? -length / 2 : 0 },
    rotation: { ...ZERO },
  };
}

/**
 * Returns the JSON text with the chosen line placed in the kitchen, or with the
 * placement removed when `lineId` is NO_LINE. An existing position and rotation are
 * kept, so changing the line does not undo a manual adjustment.
 *
 * @throws {SyntaxError} when `contentText` is not valid JSON.
 */
export function applyAssemblyLineSelection(contentText, lineId) {
  const content = JSON.parse(contentText);

  if (lineId === NO_LINE) {
    delete content.assemblyLine;
  } else {
    const fallback = defaultPlacement(content);
    const current = content.assemblyLine ?? {};
    content.assemblyLine = {
      configurationId: lineId,
      position: current.position ?? fallback.position,
      rotation: current.rotation ?? fallback.rotation,
    };
  }

  return JSON.stringify(content, null, 2);
}
