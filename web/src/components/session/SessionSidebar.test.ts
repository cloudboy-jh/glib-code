import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import SessionSidebar from './SessionSidebar.vue';

function makeSession(id: string, projectPath: string, updatedAt: string) {
  return {
    id,
    title: id,
    time: 'now',
    updatedAt,
    status: 'connected' as const,
    repo: 'repo',
    project: projectPath.split('/').at(-1) ?? 'project',
    projectPath
  };
}

describe('SessionSidebar', () => {
  it('shows current project first and toggles show more/less', async () => {
    const sessions = [
      makeSession('c1', 'C:/Repo/App', '2026-01-07T00:00:00.000Z'),
      makeSession('c2', 'C:/Repo/App', '2026-01-06T00:00:00.000Z'),
      makeSession('c3', 'C:/Repo/App', '2026-01-05T00:00:00.000Z'),
      makeSession('c4', 'C:/Repo/App', '2026-01-04T00:00:00.000Z'),
      makeSession('c5', 'C:/Repo/App', '2026-01-03T00:00:00.000Z'),
      makeSession('c6', 'C:/Repo/App', '2026-01-02T00:00:00.000Z'),
      makeSession('o1', 'D:/Else/Proj', '2026-01-01T00:00:00.000Z')
    ];

    const wrapper = mount(SessionSidebar, {
      props: {
        sessions,
        activeId: 'c1',
        currentProjectPath: 'c:\\repo\\app\\',
        currentProjectName: 'App',
        collapsed: false
      }
    });

    const text = wrapper.text();
    expect(text.indexOf('Current project')).toBeLessThan(text.indexOf('Other projects'));

    const titlesBefore = wrapper
      .findAll('span.leading-none')
      .map((node) => node.text().trim())
      .filter((text) => ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].includes(text));
    expect(titlesBefore).toHaveLength(5);

    const showMore = wrapper.findAll('button').find((button) => button.text().includes('Show 1 more'));
    expect(showMore).toBeTruthy();
    await showMore!.trigger('click');

    const titlesAfter = wrapper
      .findAll('span.leading-none')
      .map((node) => node.text().trim())
      .filter((text) => ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].includes(text));
    expect(titlesAfter).toHaveLength(6);
    expect(wrapper.text()).toContain('Show less');
  });
});
