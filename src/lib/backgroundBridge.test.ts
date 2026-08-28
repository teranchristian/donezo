import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { sendBackgroundMessage } from './backgroundBridge';
import type { BackgroundResponse } from './backgroundMessages';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sendBackgroundMessage', () => {
  it('forwards a typed request and returns its matching response', async () => {
    const sendMessage = vi.fn(
      (
        message: unknown,
        callback: (response: unknown) => void,
      ) => {
        callback({ success: true, status: 'connected' });
      },
    );
    vi.stubGlobal('chrome', {
      runtime: {
        lastError: undefined,
        sendMessage,
      },
    });

    const response = await sendBackgroundMessage({
      type: 'TEST_GITHUB_CONNECTION',
      payload: {
        token: 'github-token',
      },
    });

    expect(sendMessage).toHaveBeenCalledWith(
      {
        type: 'TEST_GITHUB_CONNECTION',
        payload: {
          token: 'github-token',
        },
      },
      expect.any(Function),
    );
    expect(response).toEqual({ success: true, status: 'connected' });
    expectTypeOf(response).toEqualTypeOf<
      BackgroundResponse<'TEST_GITHUB_CONNECTION'>
    >();
  });

  it('rejects when the Chrome runtime reports a message error', async () => {
    const sendMessage = vi.fn(
      (
        message: unknown,
        callback: (response: unknown) => void,
      ) => {
        callback(undefined);
      },
    );
    vi.stubGlobal('chrome', {
      runtime: {
        lastError: {
          message: 'Background worker unavailable',
        },
        sendMessage,
      },
    });

    await expect(
      sendBackgroundMessage({
        type: 'FETCH_JIRA_ISSUES_BY_KEYS',
        payload: {
          jiraBaseUrl: 'https://donezo.atlassian.net',
          jiraEmail: 'engineer@example.com',
          jiraApiToken: 'jira-token',
          issueKeys: ['ENG-123'],
        },
      }),
    ).rejects.toThrow('Background worker unavailable');
  });
});
