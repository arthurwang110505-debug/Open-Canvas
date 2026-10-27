import { fireEvent, screen } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';

function openPanel(tabName: string) {
  const tab = screen.getByRole('tab', { name: tabName });
  if (tab.getAttribute('aria-selected') !== 'true') fireEvent.click(tab);
}

/** Activate a drawer tab without collapsing it when a test revisits the already-open panel. */
export async function activateSidebarTab(
  user: ReturnType<typeof userEvent.setup>,
  tabName: string,
) {
  const tab = screen.getByRole('tab', { name: tabName });
  if (tab.getAttribute('aria-selected') !== 'true') await user.click(tab);
}

/** Switch the editor's collapsible drawer to its selection inspector for test assertions. */
export function openPropertiesPanel() {
  openPanel('Properties');
  return screen.getByRole('complementary', { name: 'Properties' });
}

/** Open canvas dimensions and page metadata in the left drawer. */
export function openPagePropertiesPanel() {
  openPanel('Page');
  return screen.getByRole('complementary', { name: 'Page properties' });
}
