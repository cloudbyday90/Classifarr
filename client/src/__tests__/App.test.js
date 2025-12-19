/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

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
