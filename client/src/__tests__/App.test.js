import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import App from '../App.vue';

describe('App.vue', () => {
  it('renders without crashing', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          RouterView: true,
          Toast: true
        }
      }
    });
    expect(wrapper.exists()).toBe(true);
  });

  it('contains router-view component', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          RouterView: true,
          Toast: true
        }
      }
    });
    expect(wrapper.findComponent({ name: 'RouterView' }).exists()).toBe(true);
  });

  it('contains Toast component', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          RouterView: true,
          Toast: true
        }
      }
    });
    expect(wrapper.findComponent({ name: 'Toast' }).exists()).toBe(true);
  });
});
