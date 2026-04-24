/**
 * Host adapter singleton.
 *
 * The plugin factory (createSensoryPlugin) sets the host adapter.
 * Services import `getHost()` to read from the host (recipes, etc.).
 *
 * This is the ONLY way the plugin interacts with host data.
 */

import type { HostAdapter } from '../host';

let hostAdapter: HostAdapter | null = null;

export function setHost(host: HostAdapter): void {
  hostAdapter = host;
}

export function getHost(): HostAdapter {
  if (!hostAdapter) {
    throw new Error(
      'Sensory plugin host adapter not configured. ' +
        'Call createSensoryPlugin({ host }) before using services.'
    );
  }
  return hostAdapter;
}

export function hasHost(): boolean {
  return hostAdapter !== null;
}
