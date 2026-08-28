import type {
  BackgroundMessageType,
  BackgroundRequest,
  BackgroundResponse,
} from './backgroundMessages';

export function sendBackgroundMessage<
  MessageType extends BackgroundMessageType,
>(
  message: BackgroundRequest<MessageType>,
): Promise<BackgroundResponse<MessageType>> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }

      resolve(response as BackgroundResponse<MessageType>);
    });
  });
}
