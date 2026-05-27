import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import RecentList from './RecentList.vue';

describe('RecentList', () => {
  it('keeps inline session choice flow and back navigation', async () => {
    const wrapper = mount(RecentList, {
      props: {
        recents: [{ id: 'r1', name: 'App', path: 'C:/Repo/App', lastOpenedAt: '2026-01-01T00:00:00.000Z', status: 'ok' }],
        sessionsByPath: {
          'c:/repo/app': [{ id: 's1', title: 'Session 1', time: 'now' }]
        }
      }
    });

    await wrapper.find('button.recent-row-open').trigger('click');
    expect(wrapper.text()).toContain('Diffs');
    expect(wrapper.text()).toContain('Session');

    const sessionBtn = wrapper
      .findAll('button.recent-mode-button')
      .find((button) => button.text().includes('Session'));
    expect(sessionBtn).toBeTruthy();
    await sessionBtn!.trigger('click');

    expect(wrapper.text()).toContain('Continue');
    expect(wrapper.text()).toContain('New');

    const backToMode = wrapper.find('button.recent-back-button');
    await backToMode.trigger('click');
    expect(wrapper.text()).toContain('Diffs');
    expect(wrapper.text()).toContain('Session');
  });

  it('caps session list to five and toggles show more/less', async () => {
    const sessions = Array.from({ length: 7 }).map((_, idx) => ({
      id: `s${idx + 1}`,
      title: `Session ${idx + 1}`,
      time: `${idx + 1}m`
    }));

    const wrapper = mount(RecentList, {
      props: {
        recents: [{ id: 'r1', name: 'App', path: 'C:/Repo/App', lastOpenedAt: '2026-01-01T00:00:00.000Z', status: 'ok' }],
        sessionsByPath: { 'c:/repo/app': sessions }
      }
    });

    await wrapper.find('button.recent-row-open').trigger('click');
    await wrapper
      .findAll('button.recent-mode-button')
      .find((button) => button.text().includes('Session'))!
      .trigger('click');
    await wrapper
      .findAll('button.recent-mode-button')
      .find((button) => button.text().includes('Continue'))!
      .trigger('click');

    expect(wrapper.findAll('button.recent-session-row')).toHaveLength(5);
    const showMore = wrapper.find('button.recent-show-more');
    expect(showMore.text()).toContain('Show 2 more');
    await showMore.trigger('click');

    expect(wrapper.findAll('button.recent-session-row')).toHaveLength(7);
    expect(wrapper.find('button.recent-show-more').text()).toContain('Show less');
  });
});
