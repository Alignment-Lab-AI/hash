import browser from "webextension-polyfill";

import { Message } from "../shared/messages";
import { createEntities } from "./background/create-entities";
import { inferEntities } from "./background/infer-entities";

/**
 * This is the service worker for the extension.
 *
 * @see https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Background_scripts
 *
 * You must click 'inspect' in chrome://extensions or about:debugging#/runtime/this-firefox to see console logs etc from this file.
 *
 * You must update the extension if you amend this file, from the extensions manager page in the browser.
 */

browser.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    // Open the options page when the extension is first installed
    void browser.tabs.create({
      url: "options.html",
    });
  }
});

browser.runtime.onMessage.addListener((message: Message, sender) => {
  if (sender.tab) {
    // We are not expecting any messages from the content script
    return;
  }

  if (message.type === "infer-entities") {
    void inferEntities(message);
  } else if (message.type === "create-entities") {
    void createEntities(message);
  }
});