import { ChatGPTAPI, ChatGPTAPIBrowser } from 'chatgpt';
import { Configuration, OpenAIApi } from 'openai';
import pTimeout from 'p-timeout';
import config from './config';
import { retryRequest } from './utils';

const conversationMap = new Map();

const configuration = new Configuration({ apiKey: config.apiKey });
const openai = new OpenAIApi(configuration);

function resetConversation(contactId: string) {
  if (conversationMap.has(contactId)) {
    conversationMap.delete(contactId);
  }
}

async function getChatGPTReply(prompt, contactId) {
  const { data, status } = await openai.createCompletion({
    prompt,
    model: 'text-davinci-003',
    temperature: 0.5,
    max_tokens: 2048,
  });
  if (status !== 200) {
    return '发送错误，请稍后重试';
  }
  const res = data.choices[0]?.text?.trim() ?? '';
  return res;
}

export async function replyMessage(contact, content, contactId) {
  try {
    if (
      content.trim().toLocaleLowerCase() === config.resetKey.toLocaleLowerCase()
    ) {
      resetConversation(contactId);
      await contact.say('Previous conversation has been reset.');
      return;
    }
    const message = await retryRequest(
      () => getChatGPTReply(content, contactId),
      config.retryTimes,
      500
    );

    if (
      (contact.topic && contact?.topic() && config.groupReplyMode) ||
      (!contact.topic && config.privateReplyMode)
    ) {
      const result = content + '\n-----------\n' + message;
      await contact.say(result);
      return;
    } else {
      await contact.say(message);
    }
  } catch (e: any) {
    console.error(e);
    if (e.message.includes('timed out')) {
      await contact.say(
        content +
          '\n-----------\nERROR: Please try again, ChatGPT timed out for waiting response.'
      );
    }
    conversationMap.delete(contactId);
  }
}
