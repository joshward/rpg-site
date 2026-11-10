import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import ChecklistSection from './ChecklistSection';

const scroll = vi.fn();
const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scroll,
  });
});
afterEach(() => {
  window.history.replaceState(null, '', '/');
  if (originalScroll)
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll);
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  scroll.mockReset();
});
describe('checklist hash target', () => {
  it('scrolls when the checklist mounts after hash navigation', () => {
    window.history.replaceState(null, '', '/preferences#content-checklist');
    render(<ChecklistSection>Checklist</ChecklistSection>);
    expect(scroll).toHaveBeenCalledWith({ block: 'start' });
  });
  it('cancels the pending animation frame and removes the hash listener on unmount', () => {
    const requestFrame = vi.fn(() => 42);
    vi.stubGlobal('requestAnimationFrame', requestFrame);
    window.history.replaceState(null, '', '/preferences#content-checklist');
    const { unmount } = render(<ChecklistSection>Checklist</ChecklistSection>);

    expect(requestFrame).toHaveBeenCalledTimes(1);
    expect(scroll).not.toHaveBeenCalled();
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(42);

    act(() => {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(requestFrame).toHaveBeenCalledTimes(1);
  });
  it('leaves ordinary preferences visits at their normal position', () => {
    render(<ChecklistSection>Checklist</ChecklistSection>);
    expect(scroll).not.toHaveBeenCalled();
    act(() => {
      window.history.replaceState(null, '', '/preferences#content-checklist');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(scroll).toHaveBeenCalledTimes(1);
  });
});
