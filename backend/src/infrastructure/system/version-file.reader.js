import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Absolute path of the VERSION.json file written by the deploy script, at the backend root.
 * Resolved from this module's location, not from process.cwd().
 */
export const DEFAULT_VERSION_FILE = fileURLToPath(new URL('../../../VERSION.json', import.meta.url));

const UNKNOWN_VERSION = Object.freeze({ sha: 'unknown', shortSha: 'unknown' });

/**
 * Reads the deployed version from VERSION.json.
 * Returns { sha: 'unknown', shortSha: 'unknown' } when the file does not exist, or cannot be read or parsed.
 * 
 * @param {string} [filePath=DEFAULT_VERSION_FILE] - Path of the VERSION.json 
 * @returns The version information.
 */
export function loadVersionInfo(filePath = DEFAULT_VERSION_FILE) {
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn(`Could not resolve VERSION.json (${err.code}).`);
    return { ...UNKNOWN_VERSION };
  }

  try {
    const data = JSON.parse(raw);
    return {
        sha: data.sha ?? UNKNOWN_VERSION.sha,
        shortSha: data.shortSha ?? UNKNOWN_VERSION.shortSha,
        branch: data.branch,
        commitDate: data.commitDate,
        deployedAt: data.deployedAt,
    };
  } catch {
    console.warn('VERSION.json is not valid JSON; reporting the version as unknown.');
    return { ...UNKNOWN_VERSION };
  }
}
