/**
 * Stigen is built in phases (docs/PLAN-HUNDRA.md) and is turned on for
 * everyone in H5. Until then it is shown only on a device that has opened the
 * app with `?stigen` once (and hidden again with `?stigen=0`). Nothing leaves
 * the device: the choice is kept in this browser's local storage.
 */
const KEY = 'mattedalen:stigen';

export function stigenEnabled(): boolean {
  try {
    const param = new URLSearchParams(location.search).get('stigen');
    if (param !== null) localStorage.setItem(KEY, param === '0' ? '0' : '1');
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
